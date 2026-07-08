import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { checkNoteReminders } from '@/lib/noteReminders'
import type { TripNote } from '@/lib/database.types'

/** Runs while the app is open: keeps the current user's remind-enabled notes
 *  in memory and fires their reminders when due. Mounted once (AppShell). */
export function NoteReminderEngine() {
  const { trip } = useTrip()
  const { user } = useAuth()
  const notesRef = useRef<TripNote[]>([])

  useEffect(() => {
    if (!trip?.id || !user?.id) { notesRef.current = []; return }
    let alive = true
    async function fetchNotes() {
      const { data } = await supabase.from('trip_notes').select('*')
        .eq('trip_id', trip!.id).eq('user_id', user!.id).eq('remind', true).not('due_at', 'is', null)
      if (alive && data) notesRef.current = data as TripNote[]
    }
    fetchNotes()
    const refetch = setInterval(fetchNotes, 5 * 60_000) // pick up edits from other devices
    const tick = setInterval(() => checkNoteReminders(user!.id, notesRef.current), 30_000)
    const first = setTimeout(() => checkNoteReminders(user!.id, notesRef.current), 3000)
    return () => { alive = false; clearInterval(refetch); clearInterval(tick); clearTimeout(first) }
  }, [trip?.id, user?.id])

  return null
}
