// Personal on-device reminders for notes with a due date+time. Mirrors
// planReminders: while the app is open we tick every 30s and, when a note's
// due_at passes, show an in-app toast (+ a system notification if permission
// was granted). Fired marks live in localStorage so each note fires once.

import { toast } from './toast'
import type { TripNote } from './database.types'

const FIRED_KEY = 'taurus:noteRemind:fired'
const WINDOW_MS = 10 * 60_000 // catch-up window after due_at

function loadFired(): string[] {
  try { return JSON.parse(localStorage.getItem(FIRED_KEY) ?? '[]') } catch { return [] }
}
function saveFired(ids: string[]) {
  try { localStorage.setItem(FIRED_KEY, JSON.stringify(ids.slice(-200))) } catch { /* ignore */ }
}

/** Called on an interval. `notes` should be the current user's remind-enabled
 *  notes (with due_at). Fires each due note exactly once per device. */
export function checkNoteReminders(uid: string | undefined, notes: TripNote[], nowMs = Date.now()) {
  if (!uid || !notes.length) return
  const fired = new Set(loadFired())
  let changed = false
  for (const n of notes) {
    if (!n.remind || !n.due_at || n.status === 'done') continue
    const t = new Date(n.due_at).getTime()
    if (!Number.isFinite(t)) continue
    if (nowMs >= t && nowMs <= t + WINDOW_MS && !fired.has(n.id)) {
      fired.add(n.id); changed = true
      announce(n)
    }
  }
  if (changed) saveFired([...fired])
}

/** Clear a note's fired mark so an edited due date can fire again. */
export function resetNoteReminder(id: string) {
  const fired = loadFired().filter((x) => x !== id)
  saveFired(fired)
}

function announce(note: TripNote) {
  const title = note.title || (note.kind === 'todo' ? 'To-do' : 'โน้ต')
  toast.action(`🔔 ถึงเวลา · ${title}`, { label: 'รับทราบ', run: () => { /* dismiss */ } }, { ttl: 30_000, key: `note-${note.id}` })
  try { navigator.vibrate?.([200, 100, 200]) } catch { /* unsupported */ }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    navigator.serviceWorker?.ready
      .then((reg) => reg.showNotification(`🔔 ${title}`, {
        body: 'ถึงเวลาที่ตั้งเตือนไว้ในโน้ต',
        tag: `note-${note.id}`,
        icon: '/taurus-01.svg',
        badge: '/taurus-01.svg',
      }))
      .catch(() => { /* SW not ready — toast already shown */ })
  }
}
