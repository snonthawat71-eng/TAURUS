// Personal on-device plan reminders — no server, no push setup required.
// While the app is open we check twice a minute: `lead` minutes before each
// timed stop of TODAY's plan (trip timezone) the device shows an in-app toast
// and — when notification permission was granted — a system notification too.
// Settings and fired-marks live in localStorage, so everything is per device &
// per signed-in account: each member tunes their own reminders and nobody
// else's phone goes off.

import { toast } from './toast'
import type { ItineraryDay, ItineraryStop, Trip } from './database.types'

const onKey = (uid: string) => `taurus:remind:on:${uid}`
const leadKey = (uid: string) => `taurus:remind:lead:${uid}`
const firedKey = (tripId: string) => `taurus:remind:fired:${tripId}`

export const DEFAULT_LEAD = 15
// 0 = แจ้งตรงเวลาอย่างเดียว (the on-time alert always fires either way)
export const LEAD_CHOICES = [0, 5, 10, 15, 30, 45, 60]
export const leadLabel = (m: number) => (m === 0 ? 'ตรงเวลา' : m === 60 ? '1 ชั่วโมง' : `${m} นาที`)

export function remindersEnabled(uid: string): boolean {
  try { return (localStorage.getItem(onKey(uid)) ?? '1') === '1' } catch { return true }
}
export function setRemindersEnabled(uid: string, on: boolean) {
  try { localStorage.setItem(onKey(uid), on ? '1' : '0') } catch { /* ignore */ }
}
export function reminderLead(uid: string): number {
  try {
    const raw = localStorage.getItem(leadKey(uid))
    if (raw == null) return DEFAULT_LEAD
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_LEAD // 0 = ตรงเวลาอย่างเดียว
  } catch { return DEFAULT_LEAD }
}
export function setReminderLead(uid: string, minutes: number) {
  try { localStorage.setItem(leadKey(uid), String(minutes)) } catch { /* ignore */ }
}

/** Ask for system-notification permission (safe no-op where unsupported).
 *  In-app toasts work either way — this only adds OS-level banners. */
export async function ensureNotifyPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try { return (await Notification.requestPermission()) === 'granted' } catch { return false }
}

function nowInTz(tz?: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date())
  const p: Record<string, string> = {}
  for (const x of parts) p[x.type] = x.value
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: +p.hour * 60 + +p.minute }
}

/** Called on an interval by TripContext. Fires each due reminder exactly once
 *  per device (marks reset daily). */
// When Web Push is active on this device, the server (/api/send-reminders) is
// the SINGLE source of reminders — the in-app engine must stay silent, otherwise
// each stop notifies twice (server push + this). Cached; refreshed each tick.
let pushActive = false
async function refreshPushActive() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { pushActive = false; return }
    const reg = await navigator.serviceWorker.ready
    pushActive = !!(await reg.pushManager.getSubscription())
  } catch { pushActive = false }
}
// probe once at load so the very first tick already knows (avoids a one-off dup)
refreshPushActive()

export function checkPlanReminders(uid: string | undefined, trip: Trip | null, days: ItineraryDay[], stops: ItineraryStop[]) {
  refreshPushActive() // keep fresh for subsequent ticks
  if (pushActive) return // push subscribed → server handles it, stay silent
  if (!uid || !trip || !remindersEnabled(uid)) return
  const lead = reminderLead(uid)
  let now: { date: string; minutes: number }
  try { now = nowInTz(trip.timezone ?? undefined) } catch { now = nowInTz() } // bad tz string → device tz

  const todayDayIds = new Set(days.filter((d) => d.day_date === now.date).map((d) => d.id))
  if (todayDayIds.size === 0) return

  let fired: { date: string; ids: string[] }
  try { fired = JSON.parse(localStorage.getItem(firedKey(trip.id)) ?? 'null') ?? { date: now.date, ids: [] } }
  catch { fired = { date: now.date, ids: [] } }
  if (fired.date !== now.date) fired = { date: now.date, ids: [] }

  let changed = false
  for (const s of stops) {
    if (!todayDayIds.has(s.day_id) || !s.time || s.done) continue
    const hh = +s.time.slice(0, 2), mm = +s.time.slice(3, 5)
    if (Number.isNaN(hh) || Number.isNaN(mm)) continue
    const t = hh * 60 + mm
    // exactly ONE alert per stop, at the chosen moment (trip timezone):
    // lead = 0 → on time · lead > 0 → `lead` minutes before, no repeat.
    // Opening the app long after the time passed stays silent.
    const events: { kind: 'lead' | 'ontime'; due: boolean; minutesLeft: number }[] = [
      { kind: 'lead', due: lead > 0 && now.minutes >= t - lead && now.minutes < t, minutesLeft: t - now.minutes },
      { kind: 'ontime', due: lead === 0 && now.minutes >= t && now.minutes <= t + 3, minutesLeft: 0 },
    ]
    for (const ev of events) {
      if (!ev.due) continue
      const mark = `${uid}:${s.id}:${ev.kind}`
      if (fired.ids.includes(mark)) continue
      fired.ids.push(mark)
      changed = true
      announce(s, ev.kind, ev.minutesLeft)
    }
  }
  if (changed) { try { localStorage.setItem(firedKey(trip.id), JSON.stringify(fired)) } catch { /* ignore */ } }
}

function announce(stop: ItineraryStop, kind: 'lead' | 'ontime', minutesLeft: number) {
  const name = stop.place_name || 'แพลนถัดไป'
  const time = stop.time?.slice(0, 5) ?? ''
  const head = kind === 'ontime' ? '🕑 ถึงเวลาแล้ว' : `⏰ อีก ${minutesLeft} นาที`
  toast.action(`${head} · ${time} ${name}`, { label: 'รับทราบ', run: () => { /* dismiss */ } }, { ttl: 30_000, key: `remind-${stop.id}-${kind}` })
  try { navigator.vibrate?.([200, 100, 200]) } catch { /* unsupported */ }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    navigator.serviceWorker?.ready
      .then((reg) => reg.showNotification(`${head} — ${name}`, {
        body: `ตามแพลนเวลา ${time}`,
        tag: `plan-${stop.id}-${kind}`,
        icon: '/taurus-01.svg',
        badge: '/taurus-01.svg',
      }))
      .catch(() => { /* SW not ready / unsupported — toast already shown */ })
  }
}
