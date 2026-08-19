import { supabase } from './supabase'
import type { TripNote } from './database.types'

/** The trip_notes table (with the note/todo columns) ships in
 *  supabase/notes.sql. Until the user runs it, calls error either because the
 *  table is missing or a new column is. Either way we show a "run the SQL"
 *  notice instead of a raw error. */
export function isNotesMissing(msg?: string | null) {
  if (!msg) return false
  const m = msg.toLowerCase()
  const schema = m.includes('does not exist') || m.includes('schema cache')
  return schema && (m.includes('trip_notes')
    || ["'kind'", "'title'", "'items'", "'status'", "'shared'", "'due_at'", "'remind'"].some((c) => m.includes(c)))
}

export async function listNotes(tripId: string) {
  return supabase.from('trip_notes').select('*')
    .eq('trip_id', tripId).order('created_at', { ascending: false })
}

export type NoteInsert = Pick<TripNote, 'kind' | 'title' | 'body' | 'items' | 'status' | 'shared' | 'due_at' | 'remind'>

export async function addNote(tripId: string, input: NoteInsert, authorName?: string | null, authorColor?: string | null) {
  const row: Partial<TripNote> = {
    id: crypto.randomUUID(), trip_id: tripId,
    author_name: authorName ?? null, author_color: authorColor ?? null,
    ...input,
  }
  return supabase.from('trip_notes').insert(row).select().single()
}

export async function updateNote(id: string, patch: Partial<TripNote>) {
  return supabase.from('trip_notes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
}

export async function deleteNote(id: string) {
  return supabase.from('trip_notes').delete().eq('id', id)
}
