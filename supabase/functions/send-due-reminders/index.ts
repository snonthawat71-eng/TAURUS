// Supabase Edge Function: send-due-reminders
// Runs on a schedule (every ~5 min via pg_cron — see supabase/PUSH_SETUP.md).
// Finds itinerary stops whose start time minus each subscriber's lead time falls
// in the current window, and sends a Web Push reminder to that trip's members.
//
// Deploy:  supabase functions deploy send-due-reminders --no-verify-jwt
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, (optional)
//          CRON_SECRET, REMINDER_DEFAULT_TZ

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'
const DEFAULT_TZ = Deno.env.get('REMINDER_DEFAULT_TZ') ?? 'Asia/Bangkok'
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

const WINDOW_MS = 6 * 60 * 1000 // tolerate cron cadence (~5 min) + slack

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

// offset (ms) of a timezone from UTC at a given instant
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

// the UTC instant whose wall-clock time in `tz` equals dateStr + timeStr
function wallToUtc(dateStr: string, timeStr: string, tz: string): Date | null {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  return new Date(guess - tzOffsetMs(new Date(guess), tz))
}

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('forbidden', { status: 403 })
  }

  const now = Date.now()

  // 1) enabled subscriptions
  const { data: subs } = await admin.from('push_subscriptions').select('*').eq('enabled', true)
  if (!subs?.length) return Response.json({ sent: 0, reason: 'no subscriptions' })
  const userIds = [...new Set(subs.map((s) => s.user_id as string))]
  const subsByUser = new Map<string, typeof subs>()
  for (const s of subs) {
    const arr = subsByUser.get(s.user_id) ?? []
    arr.push(s); subsByUser.set(s.user_id, arr)
  }

  // 2) which trips each subscribed user belongs to (owner + member)
  const [{ data: owned }, { data: members }] = await Promise.all([
    admin.from('trips').select('id,owner_id,timezone').in('owner_id', userIds),
    admin.from('trip_members').select('trip_id,user_id').in('user_id', userIds),
  ])
  const tripUsers = new Map<string, Set<string>>() // trip_id -> user_ids to notify
  const tripTz = new Map<string, string>()
  const addTripUser = (tripId: string, userId: string) => {
    const set = tripUsers.get(tripId) ?? new Set<string>()
    set.add(userId); tripUsers.set(tripId, set)
  }
  for (const t of owned ?? []) { tripTz.set(t.id, t.timezone ?? DEFAULT_TZ); addTripUser(t.id, t.owner_id) }
  for (const m of members ?? []) addTripUser(m.trip_id, m.user_id)
  const tripIds = [...tripUsers.keys()]
  if (!tripIds.length) return Response.json({ sent: 0, reason: 'no trips' })

  // fill any missing timezones for member-only trips
  const missingTz = tripIds.filter((id) => !tripTz.has(id))
  if (missingTz.length) {
    const { data: more } = await admin.from('trips').select('id,timezone').in('id', missingTz)
    for (const t of more ?? []) tripTz.set(t.id, t.timezone ?? DEFAULT_TZ)
  }

  // 3) days + stops for those trips
  const { data: days } = await admin.from('itinerary_days').select('id,trip_id,day_date').in('trip_id', tripIds)
  const dayById = new Map<string, { trip_id: string; day_date: string | null }>()
  for (const d of days ?? []) dayById.set(d.id, { trip_id: d.trip_id, day_date: d.day_date })
  const { data: stops } = await admin.from('itinerary_stops').select('id,day_id,trip_id,time,place_name').in('trip_id', tripIds).not('time', 'is', null)
  if (!stops?.length) return Response.json({ sent: 0, reason: 'no timed stops' })

  // 4) for each stop, notify each subscribed trip member whose lead window is now
  let sent = 0
  for (const stop of stops) {
    const day = dayById.get(stop.day_id)
    if (!day?.day_date) continue
    const tz = tripTz.get(stop.trip_id) ?? DEFAULT_TZ
    const target = wallToUtc(day.day_date, stop.time as string, tz)
    if (!target) continue
    const targetMs = target.getTime()

    const recipients = tripUsers.get(stop.trip_id)
    if (!recipients) continue
    for (const userId of recipients) {
      const userSubs = subsByUser.get(userId)
      if (!userSubs) continue
      // devices may have different lead times but sent_reminders dedupes per
      // (stop, user) — so fire once at the user's EARLIEST requested lead
      // (max minutes) and deliver to every device, rather than trusting the
      // arbitrary first row's setting
      const lead = Math.max(...userSubs.map((s) => s.lead_minutes ?? 30)) * 60_000
      const fireAt = targetMs - lead
      if (now < fireAt || now >= fireAt + WINDOW_MS) continue

      // dedupe
      const { error: dupeErr } = await admin.from('sent_reminders').insert({ stop_id: stop.id, user_id: userId })
      if (dupeErr) continue // already sent (PK conflict) or insert failed

      const payload = JSON.stringify({
        title: '⏰ ใกล้ถึงเวลาตามแผน',
        body: `${stop.time} · ${stop.place_name ?? 'กิจกรรมถัดไป'}`,
        url: '/itinerary',
        tag: `stop-${stop.id}`,
      })
      for (const s of userSubs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
          sent++
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode
          if (code === 404 || code === 410) {
            await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
          }
        }
      }
    }
  }

  return Response.json({ sent })
})
