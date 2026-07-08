import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { checkNoteReminders } from '@/lib/noteReminders'
import type { TripNote } from '@/lib/database.types'

/** Runs while the app is open: keeps the current user's remind-enabled notes
 *  in memory and fires their reminders when due. Mounted once (AppShell). */
// When Web Push is active on this device the server (/api/send-reminders) is
// the single source of note reminders, so the in-app engine stays silent to
// avoid firing twice.
async function hasPushSubscription(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
    const reg = await navigator.serviceWorker.ready
    return !!(await reg.pushManager.getSubscription())
  } catch { return false }
}

export function NoteReminderEngine() {
  const { trip } = useTrip()
  const { user } = useAuth()
  const notesRef = useRef<TripNote[]>([])
  const pushRef = useRef(false)

  useEffect(() => {
    if (!trip?.id || !user?.id) { notesRef.current = []; return }
    let alive = true
    async function fetchNotes() {
      const { data } = await supabase.from('trip_notes').select('*')
        .eq('trip_id', trip!.id).eq('user_id', user!.id).eq('remind', true).not('due_at', 'is', null)
      if (alive && data) notesRef.current = data as TripNote[]
    }
    async function refreshPush() { pushRef.current = await hasPushSubscription() }
    const tickNow = () => { if (!pushRef.current) checkNoteReminders(user!.id, notesRef.current) }
    fetchNotes(); refreshPush()
    const refetch = setInterval(fetchNotes, 5 * 60_000) // pick up edits from other devices
    const pushPoll = setInterval(refreshPush, 60_000)
    const tick = setInterval(tickNow, 30_000)
    const first = setTimeout(tickNow, 3000)
    return () => { alive = false; clearInterval(refetch); clearInterval(pushPoll); clearInterval(tick); clearTimeout(first) }
  }, [trip?.id, user?.id])

  return null
}
