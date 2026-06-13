import { supabase } from './supabase'
import type { Place } from './database.types'

export type PlaceInput = Partial<Omit<Place, 'id' | 'trip_id' | 'created_at'>>

// photo_path & city are optional (added by extra_columns.sql); strip whichever
// the API reports as unknown so older databases still work.
const OPTIONAL = ['photo_path', 'photo_url', 'city']
function stripUnknown(payload: Record<string, unknown>, msg: string) {
  const copy = { ...payload }
  let changed = false
  for (const k of OPTIONAL) if (k in copy && msg.includes(k)) { delete copy[k]; changed = true }
  return changed ? copy : null
}

export async function addPlace(trip_id: string, input: PlaceInput) {
  const payload: Record<string, unknown> = { id: crypto.randomUUID(), trip_id, in_plan: false, ...input }
  let res = await supabase.from('places').insert(payload)
  if (res.error) { const s = stripUnknown(payload, res.error.message); if (s) res = await supabase.from('places').insert(s) }
  return res
}

export async function updatePlace(id: string, fields: PlaceInput) {
  const payload: Record<string, unknown> = { ...fields }
  let res = await supabase.from('places').update(payload).eq('id', id)
  if (res.error) { const s = stripUnknown(payload, res.error.message); if (s) res = await supabase.from('places').update(s).eq('id', id) }
  return res
}

export async function deletePlace(id: string) {
  return supabase.from('places').delete().eq('id', id)
}

/** Copy a place (from a shared trip) into one of the user's own trips. */
export async function copyPlaceToTrip(place: Place, targetTripId: string) {
  const payload: Record<string, unknown> = {
    id: crypto.randomUUID(), trip_id: targetTripId, group_type: place.group_type, category: place.category,
    name: place.name, station_line: place.station_line, station_color: place.station_color, station_name: place.station_name,
    map_url: place.map_url, note: place.note, in_plan: false, photo_path: place.photo_path, photo_url: place.photo_url ?? null, city: place.city,
  }
  let res = await supabase.from('places').insert(payload)
  if (res.error) { const s = stripUnknown(payload, res.error.message); if (s) res = await supabase.from('places').insert(s) }
  return res
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
