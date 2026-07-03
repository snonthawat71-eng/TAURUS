// Vercel serverless function: /api/check-flights
// Live flight status + push alerts. pg_cron calls this every 15 minutes with
// the x-cron-secret header. Deployed automatically with the app.
//
// For every flight whose departure is near (6h before … 18h after, in the
// trip's timezone) it asks AeroDataBox once, writes the result onto the
// flights row (the Personal-page card recolors in realtime), and pushes to
// every trip member with notifications on (system default — no extra switch):
//   • summary once ~3h before departure: on time / delayed + gate
//   • the moment anything changes: delayed (new time) / cancelled / diverted /
//     back on time / delay moved ≥10 min / gate change
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RAPIDAPI_KEY,
//      VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const ADB_HOST = 'aerodatabox.p.rapidapi.com'
const DEFAULT_TZ = 'Asia/Bangkok'
const BEFORE_MS = 6 * 3600_000   // start watching 6h before departure
const AFTER_MS = 18 * 3600_000   // stop 18h after (long delays + arrival)
const SUMMARY_FROM_MIN = 180     // pre-flight summary fires once inside
const SUMMARY_TO_MIN = 150       // the 3h .. 2.5h-before window

// ---- timezone helpers ----
function tzOffsetMs(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p = {}
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return asUTC - date.getTime()
}
function wallToUtc(dateStr, timeStr, tz) {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  const [hh, mm] = String(timeStr).split(':').map(Number)
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  return new Date(guess - tzOffsetMs(new Date(guess), tz))
}

// ---- AeroDataBox ----
const hhmm = (t) => t?.local?.match(/\d{2}:\d{2}/)?.[0] ?? null
const utcMs = (t) => {
  if (!t?.utc) return null
  const d = new Date(t.utc.replace(' ', 'T'))
  return isNaN(d.getTime()) ? null : d.getTime()
}
function mapStatus(leg) {
  const sched = utcMs(leg.departure?.scheduledTime)
  const rev = utcMs(leg.departure?.revisedTime)
  const delayMin = sched != null && rev != null ? Math.round((rev - sched) / 60_000) : 0
  const s = (leg.status ?? '').toLowerCase()
  if (s.includes('cancel')) return { status: 'cancelled', delayMin }
  if (s.includes('divert')) return { status: 'diverted', delayMin }
  if (s.includes('arrived')) return { status: 'arrived', delayMin }
  if (s.includes('departed') || s.includes('enroute') || s.includes('en route')) return { status: 'departed', delayMin }
  if (s.includes('delay') || delayMin >= 10) return { status: 'delayed', delayMin }
  return { status: 'ontime', delayMin }
}
const TH = {
  ontime: 'ตามเวลา', delayed: 'ดีเลย์', cancelled: 'ถูกยกเลิก',
  diverted: 'เปลี่ยนเส้นทางลงจอด', departed: 'ออกเดินทางแล้ว', arrived: 'ถึงปลายทางแล้ว',
}

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

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RAPIDAPI_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' })
  if (!RAPIDAPI_KEY) return res.status(500).json({ error: 'missing RAPIDAPI_KEY' })
  const canPush = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
  if (canPush) {
    let subject = (VAPID_SUBJECT || 'mailto:admin@example.com').trim()
    if (!/^(mailto:|https?:\/\/)/i.test(subject)) subject = `mailto:${subject}`
    webpush.setVapidDetails(subject, VAPID_PUBLIC_KEY.trim(), VAPID_PRIVATE_KEY.trim())
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const now = Date.now()

  const { data: flights, error: flErr } = await admin.from('flights')
    .select('id,trip_id,direction,flight_no,flight_date,dep_time,dep_code,arr_code,live_status,live_delay_min,live_gate')
    .not('flight_no', 'is', null)
    .not('flight_date', 'is', null)
  if (flErr) return res.status(500).json({ error: `flights: ${flErr.message} (รัน supabase/flight_status.sql หรือยัง?)` })
  if (!flights?.length) return res.json({ checked: 0, reason: 'no flights' })

  const tripIds = [...new Set(flights.map((f) => f.trip_id))]
  const { data: trips } = await admin.from('trips').select('id,owner_id,timezone').in('id', tripIds)
  const tripTz = new Map(), tripOwner = new Map()
  for (const t of trips ?? []) { tripTz.set(t.id, t.timezone || DEFAULT_TZ); tripOwner.set(t.id, t.owner_id) }

  // only flights inside the watch window (also keep the departure Date around)
  const due = []
  for (const f of flights) {
    const tz = tripTz.get(f.trip_id) ?? DEFAULT_TZ
    let dep
    try { dep = wallToUtc(f.flight_date, f.dep_time ?? '00:00', tz) } catch { dep = null }
    if (!dep) continue
    if (now >= dep.getTime() - BEFORE_MS && now <= dep.getTime() + AFTER_MS) due.push({ f, dep })
  }
  if (!due.length) return res.json({ checked: 0, reason: 'no flights in window' })

  // recipients per trip: owner + members with an enabled push subscription
  const dueTripIds = [...new Set(due.map((d) => d.f.trip_id))]
  const { data: members } = await admin.from('trip_members').select('trip_id,user_id').in('trip_id', dueTripIds)
  const usersByTrip = new Map()
  for (const id of dueTripIds) usersByTrip.set(id, new Set([tripOwner.get(id)].filter(Boolean)))
  for (const m of members ?? []) usersByTrip.get(m.trip_id)?.add(m.user_id)
  const allUserIds = [...new Set(dueTripIds.flatMap((id) => [...(usersByTrip.get(id) ?? [])]))]
  const { data: subs } = canPush && allUserIds.length
    ? await admin.from('push_subscriptions').select('*').eq('enabled', true).in('user_id', allUserIds)
    : { data: [] }
  const subsByUser = new Map()
  for (const s of subs ?? []) {
    if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, [])
    subsByUser.get(s.user_id).push(s)
  }

  let checked = 0, sent = 0
  const dead = [], errors = []

  async function pushTo(userIds, payloadObj) {
    const payload = JSON.stringify(payloadObj)
    for (const uid of userIds) {
      for (const s of subsByUser.get(uid) ?? []) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
          sent++
        } catch (e) {
          const code = e?.statusCode
          errors.push(code ?? String(e?.message ?? e).slice(0, 80))
          if ([400, 401, 403, 404, 410].includes(code)) dead.push(s.endpoint)
        }
      }
    }
  }

  for (const { f, dep } of due) {
    const num = String(f.flight_no).replace(/\s+/g, '').toUpperCase()
    let legs = null
    try {
      const r = await fetch(
        `https://${ADB_HOST}/flights/number/${encodeURIComponent(num)}/${f.flight_date}?dateLocalRole=Both&withAircraftImage=false&withLocation=false`,
        { headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': ADB_HOST } },
      )
      if (r.ok) legs = await r.json()
      else errors.push(`adb:${r.status}`)
    } catch { /* network hiccup — next tick retries */ }
    if (!Array.isArray(legs) || !legs.length) continue

    const leg = legs.find((l) => l.departure?.airport?.iata?.toUpperCase() === String(f.dep_code ?? '').toUpperCase()) ?? legs[0]
    const { status, delayMin } = mapStatus(leg)
    const gate = leg.departure?.gate ?? null
    const patch = {
      live_status: status,
      live_delay_min: delayMin > 0 ? delayMin : null,
      live_dep_time: hhmm(leg.departure?.revisedTime) ?? hhmm(leg.departure?.scheduledTime),
      live_arr_time: hhmm(leg.arrival?.revisedTime) ?? hhmm(leg.arrival?.scheduledTime),
      live_gate: gate,
      live_terminal: leg.departure?.terminal ?? null,
      live_checked_at: new Date().toISOString(),
    }
    const upd = await admin.from('flights').update(patch).eq('id', f.id)
    if (upd.error) { errors.push(`update:${upd.error.message.slice(0, 60)}`); continue }
    checked++

    const userIds = [...(usersByTrip.get(f.trip_id) ?? [])].filter((u) => subsByUser.has(u))
    if (!userIds.length || !canPush) continue
    const route = `${f.dep_code ?? ''}→${f.arr_code ?? ''}`
    const depShown = patch.live_dep_time ?? f.dep_time ?? '-'

    // 1) pre-flight summary — once per user, ~3h before departure (default on)
    const minsToDep = Math.round((dep.getTime() - now) / 60_000)
    if (minsToDep <= SUMMARY_FROM_MIN && minsToDep > SUMMARY_TO_MIN) {
      const claims = userIds.map((uid) => ({ stop_id: f.id, user_id: uid, kind: 'flt-sum' }))
      const { data: wonRows } = await admin.from('sent_reminders')
        .upsert(claims, { onConflict: 'stop_id,user_id,kind', ignoreDuplicates: true }).select()
      const winners = (wonRows ?? []).map((w) => w.user_id)
      if (winners.length) {
        await pushTo(winners, {
          title: `🛫 ${f.flight_no} ${TH[status] ?? status}`,
          body: `${route} · ออก ${depShown}${gate ? ` · Gate ${gate}` : ''}`,
          url: '/info', tag: `flt-sum-${f.id}`,
        })
      }
    }

    // 2) status-change alerts (transition-based, so they fire exactly once)
    const was = f.live_status ?? null
    const wasDelay = f.live_delay_min ?? 0
    const wasGate = f.live_gate ?? null
    const statusChanged = was !== status
    const bad = ['delayed', 'cancelled', 'diverted']
    const notify =
      (statusChanged && bad.includes(status)) ||
      (statusChanged && status === 'ontime' && was != null && bad.includes(was)) ||
      (status === 'delayed' && Math.abs(delayMin - wasDelay) >= 10) ||
      (gate != null && wasGate != null && gate !== wasGate)
    if (!notify) continue

    const label = TH[status] ?? status
    const detail =
      status === 'delayed' ? `ดีเลย์ ${delayMin} นาที · ออกใหม่ ${depShown}`
        : status === 'ontime' ? `กลับมาตามเวลา · ออก ${depShown}`
          : gate != null && wasGate != null && gate !== wasGate && !statusChanged ? `เปลี่ยนประตูขึ้นเครื่องเป็น ${gate}`
            : label
    await pushTo(userIds, {
      title: `✈️ ${f.flight_no} ${label}`,
      body: `${route} · ${detail}`,
      url: '/info', tag: `flt-${f.id}`,
    })
  }

  if (dead.length) await admin.from('push_subscriptions').delete().in('endpoint', [...new Set(dead)])
  return res.json({ checked, sent, ...(errors.length ? { errors: errors.slice(0, 5) } : {}) })
}
