import { supabase } from './supabase'
import { updateWithVersion } from './concurrency'
import { runOrQueue } from './offlineQueue'
import type { Place } from './database.types'

export type PlaceInput = Partial<Omit<Place, 'id' | 'trip_id' | 'created_at'>>

// photo_path & city are optional (added by extra_columns.sql); strip whichever
// the API reports as unknown so older databases still work.
const OPTIONAL = ['photo_path', 'photo_url', 'photo_focus', 'city', 'source_explore_id', 'routes', 'branches', 'multi_branch', 'menu_paths']
function stripUnknown(payload: Record<string, unknown>, msg: string) {
  const copy = { ...payload }
  let changed = false
  for (const k of OPTIONAL) if (k in copy && msg.includes(k)) { delete copy[k]; changed = true }
  return changed ? copy : null
}

export async function addPlace(trip_id: string, input: PlaceInput) {
  const payload: Record<string, unknown> = { id: crypto.randomUUID(), trip_id, in_plan: false, ...input }
  return runOrQueue(async () => {
    let res = await supabase.from('places').insert(payload)
    if (res.error) { const s = stripUnknown(payload, res.error.message); if (s) res = await supabase.from('places').insert(s) }
    return res
  }, { kind: 'insert', table: 'places', payload })
}

export async function updatePlace(id: string, fields: PlaceInput, expectedVersion?: number) {
  return updateWithVersion('places', id, { ...fields }, expectedVersion, (p, msg) => stripUnknown(p, msg))
}

export async function deletePlace(id: string) {
  return runOrQueue(() => supabase.from('places').delete().eq('id', id), { kind: 'delete', table: 'places', id })
}

/** Copy a place (from a shared trip / Explore) into one of the user's own trips. */
export async function copyPlaceToTrip(place: Place, targetTripId: string, sourceExploreId?: string) {
  const payload: Record<string, unknown> = {
    id: crypto.randomUUID(), trip_id: targetTripId, group_type: place.group_type, category: place.category,
    name: place.name, station_line: place.station_line, station_color: place.station_color, station_name: place.station_name,
    routes: place.routes ?? null, branches: place.branches ?? null, multi_branch: place.multi_branch ?? null,
    map_url: place.map_url, note: place.note, in_plan: false, photo_path: place.photo_path, photo_url: place.photo_url ?? null, photo_focus: place.photo_focus ?? null, city: place.city,
    menu_paths: place.menu_paths ?? null,
    source_explore_id: sourceExploreId ?? null,
  }
  let res = await supabase.from('places').insert(payload)
  if (res.error) { const s = stripUnknown(payload, res.error.message); if (s) res = await supabase.from('places').insert(s) }
  return res
}

/** Which of my trips have saved a given Explore item (returns trip_ids). */
export async function exploreSavedInTrips(exploreId: string, tripIds: string[]) {
  if (!tripIds.length) return [] as string[]
  const { data } = await supabase.from('places').select('trip_id').eq('source_explore_id', exploreId).in('trip_id', tripIds)
  return (data ?? []).map((r) => r.trip_id as string)
}

/** Fetch the set of Explore ids already saved into any of my trips. */
export async function savedExploreIds(tripIds: string[]) {
  if (!tripIds.length) return new Set<string>()
  const { data, error } = await supabase.from('places').select('source_explore_id').in('trip_id', tripIds).not('source_explore_id', 'is', null)
  if (error) return new Set<string>()
  return new Set((data ?? []).map((r) => r.source_explore_id as string))
}

/** Remove all copies of an Explore item from my trips (unsave). */
export async function removeExploreCopies(exploreId: string, tripIds: string[]) {
  if (!tripIds.length) return
  return supabase.from('places').delete().eq('source_explore_id', exploreId).in('trip_id', tripIds)
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
