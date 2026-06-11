import { supabase } from './supabase'
import type { Place } from './database.types'

export type PlaceInput = Partial<Omit<Place, 'id' | 'trip_id' | 'created_at'>>

// photo_path is optional (added by extra_columns.sql); strip it if the column
// isn't there yet so older databases still work.
function stripPhoto(payload: Record<string, unknown>) {
  const { photo_path: _omit, ...rest } = payload
  void _omit
  return rest
}

export async function addPlace(trip_id: string, input: PlaceInput) {
  const payload: Record<string, unknown> = { id: crypto.randomUUID(), trip_id, in_plan: false, ...input }
  let res = await supabase.from('places').insert(payload)
  if (res.error && res.error.message.includes('photo_path')) res = await supabase.from('places').insert(stripPhoto(payload))
  return res
}

export async function updatePlace(id: string, fields: PlaceInput) {
  const payload: Record<string, unknown> = { ...fields }
  let res = await supabase.from('places').update(payload).eq('id', id)
  if (res.error && res.error.message.includes('photo_path')) res = await supabase.from('places').update(stripPhoto(payload)).eq('id', id)
  return res
}

export async function deletePlace(id: string) {
  return supabase.from('places').delete().eq('id', id)
}

export async function setInPlan(id: string, in_plan: boolean) {
  return supabase.from('places').update({ in_plan }).eq('id', id)
}

/** Toggle the current user's "want to go" interest for a place. */
export async function toggleInterest(place_id: string, user_id: string, currentlyInterested: boolean) {
  if (currentlyInterested) {
    return supabase.from('place_interest').delete().eq('place_id', place_id).eq('user_id', user_id)
  }
  return supabase.from('place_interest').insert({ place_id, user_id })
}
