import { supabase } from './supabase'
import type { TripNote } from './database.types'

/** The trip_notes table ships in supabase/notes.sql — until the user runs it,
 *  every call errors with "relation ... does not exist". Callers use this to
 *  show a friendly "run the SQL first" notice instead of a raw error. */
export const isNotesMissing = (msg?: string | null) =>
  !!msg && msg.includes('trip_notes') && (msg.includes('does not exist') || msg.includes('schema cache'))

export async function listNotes(tripId: string) {
  return supabase.from('trip_notes').select('*')
    .eq('trip_id', tripId).order('created_at', { ascending: false })
}

export async function addNote(tripId: string, body: string, authorName?: string | null, authorColor?: string | null) {
  const row: Partial<TripNote> = {
    id: crypto.randomUUID(), trip_id: tripId, body,
    author_name: authorName ?? null, author_color: authorColor ?? null,
  }
  return supabase.from('trip_notes').insert(row)
}

export async function updateNote(id: string, body: string) {
  return supabase.from('trip_notes').update({ body, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function deleteNote(id: string) {
  return supabase.from('trip_notes').delete().eq('id', id)
}
