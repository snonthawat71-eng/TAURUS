// Supabase Edge Function: check-flight-status
// Runs on a schedule (every ~10 min via pg_cron — see supabase/FLIGHT_STATUS_SETUP.md).
// On each trip's travel day it polls AeroDataBox for every flight whose departure
// window is near (dep−6h … dep+18h), writes the live status onto the flights row
// (the app's realtime subscription refreshes every member's card automatically),
// and Web-Pushes the trip's members when something meaningful changes:
// delayed / cancelled / diverted, back to on-time, or a gate change.
//
// Deploy:  supabase functions deploy check-flight-status --no-verify-jwt
// Secrets: RAPIDAPI_KEY (AeroDataBox via RapidAPI), VAPID_PUBLIC_KEY,
//          VAPID_PRIVATE_KEY, VAPID_SUBJECT, (optional) CRON_SECRET, REMINDER_DEFAULT_TZ

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY')!
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'
const DEFAULT_TZ = Deno.env.get('REMINDER_DEFAULT_TZ') ?? 'Asia/Bangkok'
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

const ADB_HOST = 'aerodatabox.p.rapidapi.com'
const BEFORE_MS = 6 * 3600_000  // start watching 6h before departure
const AFTER_MS = 18 * 3600_000  // stop 18h after (covers long delays + arrival)

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

// ---- timezone helpers (same approach as send-due-reminders) ----
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p: Record<string, string> = {}
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return asUTC - date.getTime()
}
function wallToUtc(dateStr: string, timeStr: string, tz: string): Date | null {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  return new Date(guess - tzOffsetMs(new Date(guess), tz))
}

// ---- AeroDataBox ----
interface AdbTime { utc?: string; local?: string }
interface AdbLeg {
  status?: string
  departure?: { airport?: { iata?: string }; scheduledTime?: AdbTime; revisedTime?: AdbTime; terminal?: string; gate?: string }
  arrival?: { airport?: { iata?: string }; scheduledTime?: AdbTime; revisedTime?: AdbTime }
}
const hhmm = (t?: AdbTime | null): string | null => t?.local?.match(/\d{2}:\d{2}/)?.[0] ?? null
const utcMs = (t?: AdbTime | null): number | null => {
  if (!t?.utc) return null
  const d = new Date(t.utc.replace(' ', 'T'))
  return isNaN(d.getTime()) ? null : d.getTime()
}

/** AeroDataBox status → our compact enum (null = nothing useful). */
function mapStatus(leg: AdbLeg): { status: string; delayMin: number } {
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

const TH: Record<string, string> = {
  ontime: 'ตามเวลา', delayed: 'ดีเลย์', cancelled: 'ถูกยกเลิก',
  diverted: 'เปลี่ยนเส้นทางลงจอด', departed: 'ออกเดินทางแล้ว', arrived: 'ถึงปลายทางแล้ว',
}

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('forbidden', { status: 403 })
  }
  const now = Date.now()

  // 1) candidate flights: have a number + date (the date filter below needs the
  //    trip tz, so fetch a 2-day window worth by date string first)
  const { data: flights } = await admin.from('flights')
    .select('id,trip_id,direction,flight_no,flight_date,dep_time,dep_code,arr_code,live_status,live_delay_min,live_gate')
    .not('flight_no', 'is', null)
    .not('flight_date', 'is', null)
  if (!flights?.length) return Response.json({ checked: 0, reason: 'no flights' })

  const tripIds = [...new Set(flights.map((f) => f.trip_id as string))]
  const { data: trips } = await admin.from('trips').select('id,owner_id,timezone').in('id', tripIds)
  const tripTz = new Map<string, string>()
  const tripOwner = new Map<string, string>()
  for (const t of trips ?? []) { tripTz.set(t.id, t.timezone ?? DEFAULT_TZ); tripOwner.set(t.id, t.owner_id) }

  // keep only flights inside the watch window (dep−6h … dep+18h)
  const due = flights.filter((f) => {
    const tz = tripTz.get(f.trip_id) ?? DEFAULT_TZ
    const dep = wallToUtc(f.flight_date as string, (f.dep_time as string) ?? '00:00', tz)
    if (!dep) return false
    return now >= dep.getTime() - BEFORE_MS && now <= dep.getTime() + AFTER_MS
  })
  if (!due.length) return Response.json({ checked: 0, reason: 'no flights in window' })

  let checked = 0, alerts = 0
  for (const f of due) {
    const num = String(f.flight_no).replace(/\s+/g, '').toUpperCase()
    let legs: AdbLeg[] | null = null
    try {
      const res = await fetch(
        `https://${ADB_HOST}/flights/number/${encodeURIComponent(num)}/${f.flight_date}?dateLocalRole=Both&withAircraftImage=false&withLocation=false`,
        { headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': ADB_HOST } },
      )
      if (res.ok) legs = await res.json()
    } catch { /* network/API hiccup — try again next tick */ }
    if (!Array.isArray(legs) || !legs.length) continue

    // pick the leg that departs from our airport (a number can have several legs)
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
    await admin.from('flights').update(patch).eq('id', f.id)
    checked++

    // 2) alert only on MEANINGFUL transitions (the card itself updates either way):
    //    became delayed/cancelled/diverted · recovered to on-time · delay moved ≥10 min · gate changed
    const was = (f.live_status as string | null) ?? null
    const wasDelay = (f.live_delay_min as number | null) ?? 0
    const wasGate = (f.live_gate as string | null) ?? null
    const statusChanged = was !== status
    const bad = ['delayed', 'cancelled', 'diverted']
    const notify =
      (statusChanged && bad.includes(status)) ||
      (statusChanged && status === 'ontime' && was != null && bad.includes(was)) ||
      (status === 'delayed' && Math.abs(delayMin - wasDelay) >= 10) ||
      (gate != null && wasGate != null && gate !== wasGate)
    if (!notify) continue

    // recipients: trip owner + members, whoever has push enabled
    const { data: members } = await admin.from('trip_members').select('user_id').eq('trip_id', f.trip_id)
    const userIds = [...new Set([tripOwner.get(f.trip_id), ...(members ?? []).map((m) => m.user_id as string)])].filter(Boolean) as string[]
    if (!userIds.length) continue
    const { data: subs } = await admin.from('push_subscriptions').select('*').eq('enabled', true).in('user_id', userIds)
    if (!subs?.length) continue

    const label = TH[status] ?? status
    const detail =
      status === 'delayed' ? `ดีเลย์ ${delayMin} นาที · ออกใหม่ ${patch.live_dep_time ?? '-'}`
        : status === 'ontime' ? `กลับมาตามเวลา · ออก ${patch.live_dep_time ?? f.dep_time ?? '-'}`
          : gate != null && wasGate != null && gate !== wasGate && !statusChanged ? `เปลี่ยนประตูขึ้นเครื่องเป็น ${gate}`
            : label
    const payload = JSON.stringify({
      title: `✈️ ${f.flight_no} ${status === 'ontime' ? 'ตามเวลา' : label}`,
      body: `${f.dep_code ?? ''}→${f.arr_code ?? ''} · ${detail}`,
      url: '/info',
      tag: `flight-${f.id}`,
    })
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        alerts++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      }
    }
  }

  return Response.json({ checked, alerts })
})
