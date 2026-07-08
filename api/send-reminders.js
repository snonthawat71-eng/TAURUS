// Vercel serverless function: /api/send-reminders
// Sends Web Push plan reminders — deployed automatically with the app, so
// there is nothing to deploy by hand. pg_cron (Supabase) calls this URL every
// 5 minutes with the x-cron-secret header; see the setup steps in chat /
// supabase/PUSH_SETUP.md.
//
// Per member ("ของใครของมัน"): only users who turned on push get anything, at
// their own lead time (max across their devices). Two events per timed stop of
// TODAY in the trip's timezone:
//   lead   — `lead` minutes before the stop's time
//   ontime — exactly at the stop's time (10-min catch-up window covers a
//            missed cron tick)
// Dedupe: sent_reminders (stop_id, user_id, kind) — each fires once per user.
//
// Env (Vercel → Settings → Environment Variables):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_TZ = 'Asia/Bangkok'
const CATCHUP_MIN = 10

function nowInTz(tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date())
  const p = {}
  for (const x of parts) p[x.type] = x.value
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: +p.hour * 60 + +p.minute }
}

// Multi-city trips carry ordered `segments` with a handover datetime (`until`,
// local 'YYYY-MM-DDTHH:mm'); the effective timezone is the ACTIVE segment's.
function tripTzOf(trip) {
  const base = trip.timezone || DEFAULT_TZ
  const segs = Array.isArray(trip.segments) ? trip.segments : null
  if (!segs || !segs.length) return base
  for (const s of segs) {
    if (!s) continue
    const tz = s.tz || base
    if (!s.until) return tz
    let now
    try { now = nowInTz(tz) } catch { now = nowInTz(DEFAULT_TZ) }
    const nowStr = `${now.date}T${String(Math.floor(now.minutes / 60)).padStart(2, '0')}:${String(now.minutes % 60).padStart(2, '0')}`
    if (nowStr < s.until) return tz
  }
  return segs[segs.length - 1].tz || base
}

// Crash-proof wrapper: any unexpected error comes back as JSON in the HTTP
// response, so it shows up readable in Supabase's net._http_response table
// instead of an opaque FUNCTION_INVOCATION_FAILED page.
export default async function handler(req, res) {
  try {
    return await main(req, res)
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) })
  }
}

async function main(req, res) {
  const secret = process.env.CRON_SECRET ?? ''
  const given = req.headers['x-cron-secret'] ?? req.query?.secret
  if (secret && given !== secret) return res.status(403).json({ error: 'forbidden' })

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' })
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return res.status(500).json({ error: 'missing VAPID keys' })
  // subject must be a mailto:/https URL — auto-prefix a bare email address
  let subject = (VAPID_SUBJECT || 'mailto:admin@example.com').trim()
  if (!/^(mailto:|https?:\/\/)/i.test(subject)) subject = `mailto:${subject}`
  webpush.setVapidDetails(subject, VAPID_PUBLIC_KEY.trim(), VAPID_PRIVATE_KEY.trim())
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // ---- NOTE reminders — personal, keyed on an absolute due_at (independent of
  //      trip dates, so run this BEFORE the stop pass's early returns). Sent to
  //      the note owner only; deduped via sent_reminders (kind='note'). ----
  const noteSent = await sendNoteReminders(admin)

  // date window ±1 day around UTC today covers "today" in every timezone
  const utcNow = Date.now()
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10)
  const { data: days, error: daysErr } = await admin
    .from('itinerary_days').select('id,trip_id,day_date')
    .gte('day_date', iso(utcNow - 86400000)).lte('day_date', iso(utcNow + 86400000))
  if (daysErr) return res.status(500).json({ error: daysErr.message })
  if (!days?.length) return res.json({ sent: 0, reason: 'no days in window' })

  const tripIds = [...new Set(days.map((d) => d.trip_id))]
  const { data: trips } = await admin.from('trips').select('*').in('id', tripIds)

  // today's day ids per trip, evaluated in each trip's own timezone
  const nowByTrip = new Map()
  const tripByDay = new Map()
  const dueDayIds = []
  for (const t of trips ?? []) {
    let now
    try { now = nowInTz(tripTzOf(t)) } catch { now = nowInTz(DEFAULT_TZ) }
    nowByTrip.set(t.id, now)
    for (const d of days) {
      if (d.trip_id === t.id && d.day_date === now.date) { dueDayIds.push(d.id); tripByDay.set(d.id, t) }
    }
  }
  if (!dueDayIds.length) return res.json({ sent: 0, reason: 'no trip is on today' })

  const { data: stops } = await admin
    .from('itinerary_stops').select('*')
    .in('day_id', dueDayIds).not('time', 'is', null)
  const active = (stops ?? []).filter((s) => !s.done && s.role !== 'backup')
  if (!active.length) return res.json({ sent: 0, reason: 'no timed stops today' })

  // recipients: trip owner + members, but ONLY those with an enabled push sub
  const activeTripIds = [...new Set(active.map((s) => s.trip_id))]
  const { data: members } = await admin.from('trip_members').select('trip_id,user_id').in('trip_id', activeTripIds)
  const usersByTrip = new Map()
  for (const t of trips ?? []) usersByTrip.set(t.id, new Set([t.owner_id]))
  for (const m of members ?? []) usersByTrip.get(m.trip_id)?.add(m.user_id)
  const allUserIds = [...new Set(activeTripIds.flatMap((id) => [...(usersByTrip.get(id) ?? [])]))]
  const { data: subs } = await admin.from('push_subscriptions').select('*').eq('enabled', true).in('user_id', allUserIds)
  if (!subs?.length) return res.json({ sent: 0, reason: 'no push subscriptions' })
  const subsByUser = new Map()
  for (const s of subs) {
    if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, [])
    subsByUser.get(s.user_id).push(s)
  }

  // events due right now
  const due = []
  for (const s of active) {
    const trip = tripByDay.get(s.day_id)
    if (!trip) continue
    const now = nowByTrip.get(trip.id)
    const hh = +String(s.time).slice(0, 2), mm = +String(s.time).slice(3, 5)
    if (Number.isNaN(hh) || Number.isNaN(mm)) continue
    const t = hh * 60 + mm
    const hhmm = String(s.time).slice(0, 5)
    const name = s.place_name || 'แพลนถัดไป'
    for (const uid of usersByTrip.get(trip.id) ?? []) {
      const mySubs = subsByUser.get(uid)
      if (!mySubs?.length) continue
      // exactly ONE alert per stop per user, at their chosen moment:
      // lead = 0 → on time · lead > 0 → lead minutes before, no repeat
      const lead = Math.max(...mySubs.map((x) => x.lead_minutes ?? 15))
      if (lead > 0 && now.minutes >= t - lead && now.minutes < t) {
        due.push({ stop: s, uid, kind: 'lead', title: `⏰ อีก ${t - now.minutes} นาที — ${name}`, body: `ตามแพลนเวลา ${hhmm}` })
      }
      if (lead === 0 && now.minutes >= t && now.minutes <= t + CATCHUP_MIN) {
        due.push({ stop: s, uid, kind: 'ontime', title: `🕑 ถึงเวลาแล้ว — ${name}`, body: `ตามแพลนเวลา ${hhmm} (เวลาท้องถิ่นทริป)` })
      }
    }
  }
  if (!due.length) return res.json({ sent: 0, reason: 'nothing due' })

  // claim rows in sent_reminders first — ON CONFLICT DO NOTHING means only one
  // run ever wins a given (stop, user, kind), so nobody gets double-notified
  const claims = due.map((d) => ({ stop_id: d.stop.id, user_id: d.uid, kind: d.kind }))
  const { data: claimed, error: claimErr } = await admin
    .from('sent_reminders')
    .upsert(claims, { onConflict: 'stop_id,user_id,kind', ignoreDuplicates: true })
    .select()
  if (claimErr) return res.status(500).json({ error: `sent_reminders: ${claimErr.message} (ยังไม่ได้รัน SQL อัปเกรดตาราง?)` })
  const won = new Set((claimed ?? []).map((c) => `${c.stop_id}:${c.user_id}:${c.kind}`))

  let sent = 0
  const dead = []
  const errors = []
  for (const d of due) {
    if (!won.has(`${d.stop.id}:${d.uid}:${d.kind}`)) continue
    const payload = JSON.stringify({ title: d.title, body: d.body, url: '/itinerary', tag: `plan-${d.stop.id}-${d.kind}` })
    for (const s of subsByUser.get(d.uid) ?? []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        sent++
      } catch (e) {
        const code = e?.statusCode
        errors.push(code ?? String(e?.message ?? e).slice(0, 120))
        // 404/410 endpoint expired · 400/401/403 subscription bound to a
        // different VAPID key — either way this row can never succeed, drop it
        // (the app re-subscribes automatically with the current key on open)
        if ([400, 401, 403, 404, 410].includes(code)) dead.push(s.endpoint)
      }
    }
  }
  if (dead.length) await admin.from('push_subscriptions').delete().in('endpoint', dead)
  return res.json({ sent, notesSent: noteSent, due: due.length, ...(errors.length ? { errors: errors.slice(0, 5) } : {}) })
}

// Send push for notes whose due_at just passed (within the catch-up window),
// to the owner's enabled devices. Best-effort: never throws (so it can't block
// the stop reminders). Returns how many pushes were sent.
async function sendNoteReminders(admin) {
  try {
    const nowMs = Date.now()
    const WINDOW_MS = 15 * 60000 // covers a missed 5-min cron tick
    const { data: notes } = await admin.from('trip_notes')
      .select('id,user_id,title,due_at,status,remind')
      .eq('remind', true).neq('status', 'done').not('due_at', 'is', null)
      .lte('due_at', new Date(nowMs).toISOString())
      .gte('due_at', new Date(nowMs - WINDOW_MS).toISOString())
    const dueNotes = (notes ?? []).filter((n) => n.user_id)
    if (!dueNotes.length) return 0

    const owners = [...new Set(dueNotes.map((n) => n.user_id))]
    const { data: subs } = await admin.from('push_subscriptions').select('*').eq('enabled', true).in('user_id', owners)
    const byUser = new Map()
    for (const s of subs ?? []) { if (!byUser.has(s.user_id)) byUser.set(s.user_id, []); byUser.get(s.user_id).push(s) }

    const claims = dueNotes.filter((n) => byUser.has(n.user_id)).map((n) => ({ stop_id: n.id, user_id: n.user_id, kind: 'note' }))
    if (!claims.length) return 0
    const { data: claimed } = await admin.from('sent_reminders')
      .upsert(claims, { onConflict: 'stop_id,user_id,kind', ignoreDuplicates: true }).select()
    const won = new Set((claimed ?? []).map((c) => `${c.stop_id}:${c.user_id}`))

    let sent = 0
    const dead = []
    for (const n of dueNotes) {
      if (!won.has(`${n.id}:${n.user_id}`)) continue
      const title = n.title || 'โน้ต'
      const payload = JSON.stringify({ title: `🔔 ${title}`, body: 'ถึงเวลาที่ตั้งเตือนไว้ในโน้ต', url: '/', tag: `note-${n.id}` })
      for (const s of byUser.get(n.user_id) ?? []) {
        try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload); sent++ }
        catch (e) { const code = e?.statusCode; if ([400, 401, 403, 404, 410].includes(code)) dead.push(s.endpoint) }
      }
    }
    if (dead.length) await admin.from('push_subscriptions').delete().in('endpoint', dead)
    return sent
  } catch { return 0 }
}
