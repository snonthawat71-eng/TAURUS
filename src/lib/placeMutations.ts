import { supabase } from './supabase'
import { updateWithVersion } from './concurrency'
import { runOrQueue } from './offlineQueue'
import { toastDbError } from './toast'
import { latLngFromUrl, latLngFromUrlExact, isMapLink, resolveMapUrl } from './geo'
import type { Place } from './database.types'

export type PlaceInput = Partial<Omit<Place, 'id' | 'trip_id' | 'created_at'>>

// photo_path & city are optional (added by extra_columns.sql); strip whichever
// the API reports as unknown so older databases still work.
const OPTIONAL = ['photo_path', 'photo_url', 'photo_focus', 'photos', 'city', 'source_explore_id', 'routes', 'branches', 'multi_branch', 'plan_branch', 'menu_paths', 'lat', 'lng']
function stripUnknown(payload: Record<string, unknown>, msg: string) {
  const copy = { ...payload }
  let changed = false
  for (const k of OPTIONAL) if (k in copy && msg.includes(k)) { delete copy[k]; changed = true }
  return changed ? copy : null
}

/** Resolve a place's coordinates from its map link and store them — so pins
 *  are correct the moment a place is saved, never left to name-guessing.
 *  Exact in-URL coords parse instantly; short links resolve server-side.
 *  Fire-and-forget: failures are silent (the map page heals later). */
export async function syncCoordsFromLink(id: string, mapUrl: string) {
  try {
    const c = latLngFromUrlExact(mapUrl)
      ?? (isMapLink(mapUrl) ? await resolveMapUrl(mapUrl) : latLngFromUrl(mapUrl))
    // page-derived points can be a server's geo-IP default (wrong country) —
    // only the map page persists those, after its geographic sanity check
    if (c && !('pageDerived' in c && c.pageDerived)) await setPlaceCoords(id, c.lat, c.lng)
  } catch { /* offline / resolver down — nothing lost */ }
}

export async function addPlace(trip_id: string, input: PlaceInput) {
  const payload: Record<string, unknown> = { id: crypto.randomUUID(), trip_id, in_plan: false, ...input }
  const res = await runOrQueue(async () => {
    let r = await supabase.from('places').insert(payload)
    if (r.error) { const s = stripUnknown(payload, r.error.message); if (s) r = await supabase.from('places').insert(s) }
    return r
  }, { kind: 'insert', table: 'places', payload })
  if (typeof input.map_url === 'string' && input.map_url) void syncCoordsFromLink(payload.id as string, input.map_url)
  return res
}

export async function updatePlace(id: string, fields: PlaceInput, expectedVersion?: number) {
  const res = await updateWithVersion('places', id, { ...fields }, expectedVersion, (p, msg) => stripUnknown(p, msg))
  // link edited → re-derive the pin from it (the link is ground truth)
  if (typeof fields.map_url === 'string' && fields.map_url) void syncCoordsFromLink(id, fields.map_url)
  return res
}

/** Write just the map pin (lat/lng) — no version bump. Used to cache a geocode
 *  result or a manually-picked location. Silent if the columns don't exist yet. */
export async function setPlaceCoords(id: string, lat: number | null, lng: number | null) {
  const res = await supabase.from('places').update({ lat, lng }).eq('id', id)
  return res
}

export async function deletePlace(id: string) {
  return runOrQueue(() => supabase.from('places').delete().eq('id', id), { kind: 'delete', table: 'places', id })
}

/** Copy a place (from a shared trip / Explore) into one of the user's own trips.
 *  Pass `opts.id` to control the new row id (so the caller can select it right
 *  away) and `opts.inPlan` to drop it straight into the plan. */
export async function copyPlaceToTrip(
  place: Place, targetTripId: string, sourceExploreId?: string,
  opts?: { inPlan?: boolean; id?: string; planBranch?: number | null },
) {
  const payload: Record<string, unknown> = {
    id: opts?.id ?? crypto.randomUUID(), trip_id: targetTripId, group_type: place.group_type, category: place.category,
    name: place.name, station_line: place.station_line, station_color: place.station_color, station_name: place.station_name,
    routes: place.routes ?? null, branches: place.branches ?? null, multi_branch: place.multi_branch ?? null,
    plan_branch: opts?.planBranch ?? null,
    map_url: place.map_url, note: place.note, in_plan: opts?.inPlan ?? false, photo_path: place.photo_path, photo_url: place.photo_url ?? null, photo_focus: place.photo_focus ?? null, photos: place.photos ?? null, city: place.city,
    menu_paths: place.menu_paths ?? null,
    // carry the resolved pin along — the copy must not fall back to name-guessing
    lat: place.lat ?? null, lng: place.lng ?? null,
    source_explore_id: sourceExploreId ?? null,
  }
  let res = await supabase.from('places').insert(payload)
  if (res.error) { const s = stripUnknown(payload, res.error.message); if (s) res = await supabase.from('places').insert(s) }
  // no pin came along but there's a link → resolve it right now
  if (!res.error && place.lat == null && typeof place.map_url === 'string' && place.map_url) {
    void syncCoordsFromLink(payload.id as string, place.map_url)
  }
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

/** Un-save an Explore item from my trips AND delete any itinerary stops that
 *  were created from those copies (matched by place name within the same
 *  trip). Returns how many stops went with it, for the confirmation toast. */
export async function removeExploreCopiesDeep(exploreId: string, tripIds: string[]) {
  if (!tripIds.length) return { stopsRemoved: 0 }
  const { data } = await supabase.from('places')
    .select('name').eq('source_explore_id', exploreId).in('trip_id', tripIds)
  const names = [...new Set((data ?? []).map((r) => (r.name as string | null) ?? '').filter(Boolean))]
  let stopsRemoved = 0
  if (names.length) {
    const del = await supabase.from('itinerary_stops').delete()
      .in('trip_id', tripIds).in('place_name', names).select('id')
    stopsRemoved = del.data?.length ?? 0
  }
  await supabase.from('places').delete().eq('source_explore_id', exploreId).in('trip_id', tripIds)
  return { stopsRemoved }
}

/**
 * Propagate an Explore edit to every saved copy in the given trips, so a place
 * the user saved stays in sync when its Explore source is edited. RLS limits
 * the write to trips the user can edit; copies elsewhere are simply untouched.
 */
export async function updateExploreCopies(exploreId: string, fields: PlaceInput, tripIds: string[]) {
  if (!tripIds.length) return
  const payload: Record<string, unknown> = { ...fields }
  let res = await supabase.from('places').update(payload).eq('source_explore_id', exploreId).in('trip_id', tripIds)
  if (res.error) { const s = stripUnknown(payload, res.error.message); if (s) res = await supabase.from('places').update(s).eq('source_explore_id', exploreId).in('trip_id', tripIds) }
  return res
}

/** Flag a place in/out of the plan. `plan_branch` records which branch of a
 *  multi-branch place was picked (index into branches, null = main location);
 *  taking a place out of the plan clears it. Retries without the column when
 *  plan_branch.sql hasn't been applied yet. */
export async function setInPlan(id: string, in_plan: boolean, plan_branch?: number | null) {
  const payload: Record<string, unknown> = { in_plan }
  if (plan_branch !== undefined) payload.plan_branch = plan_branch
  else if (!in_plan) payload.plan_branch = null
  let res = await supabase.from('places').update(payload).eq('id', id)
  if (res.error && 'plan_branch' in payload && /plan_branch|column/i.test(res.error.message)) {
    res = await supabase.from('places').update({ in_plan }).eq('id', id)
  }
  toastDbError(res.error)
  return res
}

/** Toggle the current user's "want to go" interest for a place. */
export async function toggleInterest(place_id: string, user_id: string, currentlyInterested: boolean) {
  const res = currentlyInterested
    ? await supabase.from('place_interest').delete().eq('place_id', place_id).eq('user_id', user_id)
    : await supabase.from('place_interest').insert({ place_id, user_id })
  toastDbError(res.error)
  return res
}
