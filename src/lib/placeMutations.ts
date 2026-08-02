import { supabase } from './supabase'
import { updateWithVersion } from './concurrency'
import { runOrQueue } from './offlineQueue'
import { toastDbError } from './toast'
import { latLngFromUrl, latLngFromUrlExact, isMapLink, resolveMapUrl } from './geo'
import type { ItineraryStop, Place, PlaceBranch } from './database.types'

export type PlaceInput = Partial<Omit<Place, 'id' | 'trip_id' | 'created_at'>>

// photo_path & city are optional (added by extra_columns.sql); strip whichever
// the API reports as unknown so older databases still work.
const OPTIONAL = ['photo_path', 'photo_url', 'photo_focus', 'photos', 'city', 'source_explore_id', 'routes', 'branches', 'multi_branch', 'branch_label', 'plan_branch', 'menu_paths', 'lat', 'lng', 'pinned']
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

/** Persist a HAND-SET pin: writes lat/lng and sets `pinned` so the map trusts it
 *  and never re-geocodes it — WITHOUT touching map_url, so the user's real link
 *  stays intact for navigation. Pass `mapUrl` only to also set the link (e.g. a
 *  linkless place needs a coordinate URL so "นำทาง" still works). Degrades to a
 *  plain lat/lng write if the pinned column isn't there yet. */
export async function setManualPin(id: string, lat: number, lng: number, mapUrl?: string) {
  const base: Record<string, unknown> = { lat, lng }
  if (mapUrl !== undefined) base.map_url = mapUrl
  let res = await supabase.from('places').update({ ...base, pinned: true }).eq('id', id)
  if (res.error && /pinned/.test(res.error.message)) res = await supabase.from('places').update(base).eq('id', id)
  return res
}

export async function deletePlace(id: string) {
  return runOrQueue(() => supabase.from('places').delete().eq('id', id), { kind: 'delete', table: 'places', id })
}

/** The itinerary stops that were created from a place — matched by name within
 *  the same trip (a stop stores the name, not a foreign key). Used to keep the
 *  plan in sync when the place itself is deleted. */
export async function stopsForPlace(place: Place): Promise<ItineraryStop[]> {
  const name = (place.name ?? '').trim()
  if (!name || !place.trip_id) return []
  const { data } = await supabase.from('itinerary_stops')
    .select('*').eq('trip_id', place.trip_id).eq('place_name', name)
  return (data ?? []) as ItineraryStop[]
}

/** Delete a place AND the itinerary stops that came from it — deleting it from
 *  Places/Food should take it out of the plan too, otherwise the stop lingers
 *  in the Itinerary pointing at something that no longer exists. Returns the
 *  removed stops so the caller's undo can put them back with their original
 *  ids (day_id/position stay valid). */
export async function deletePlaceDeep(place: Place, known?: ItineraryStop[]): Promise<{ stops: ItineraryStop[] }> {
  // prefer the caller's already-loaded stops (matched case-insensitively, and
  // exactly what the user was warned about); fall back to a server lookup
  const stops = known ?? await stopsForPlace(place)
  if (stops.length) {
    await supabase.from('itinerary_stops').delete().in('id', stops.map((s) => s.id))
  }
  await deletePlace(place.id)
  return { stops }
}

/** How an edit rearranged a place's branch list. A branch choice is stored as a
 *  POSITION (`places.plan_branch`, `itinerary_stops.branch_idx`), so deleting a
 *  branch shifts every later one — without re-pointing them the plan silently
 *  moves to a different branch, or falls back to the main location. */
export interface BranchRemap {
  /** index in the OLD list → index in the new one; missing = branch deleted */
  map: Record<number, number>
  /** the branch list as it was before the edit, to spot links left dangling */
  before: PlaceBranch[]
}

/** Work out how an edited branch list refers back to the saved one.
 *  `kept[n]` = where the n-th surviving row sat in the SAVED list (null = added
 *  during this edit). Returns undefined when every branch stayed where it was —
 *  then there is nothing to re-point and callers can skip the work entirely. */
export function buildBranchRemap(before: PlaceBranch[], kept: (number | null)[]): BranchRemap | undefined {
  const map: Record<number, number> = {}
  kept.forEach((from, to) => { if (from != null) map[from] = to })
  if (!before.some((_, i) => map[i] !== i)) return undefined
  return { map, before }
}

/** Where a stored branch position lands after the edit — null = it was deleted,
 *  so that choice falls back to the place's main location. */
export function remappedBranch(remap: BranchRemap, i: number): number | null {
  return remap.map[i] ?? null
}

/** Re-point every branch choice that refers to `places` after their branch list
 *  was rearranged. A visit whose branch is gone falls back to the main location,
 *  and its map link is reset too — but only when the link still points at the
 *  branch that was deleted, so a hand-edited link is never clobbered.
 *  Silent when plan_branch/branch_idx don't exist yet (nothing to re-point). */
export async function remapBranchIndexes(places: Place[], remap: BranchRemap) {
  const to = (i: number) => remappedBranch(remap, i)
  for (const p of places) {
    if (p.plan_branch != null) {
      const next = to(p.plan_branch)
      if (next !== p.plan_branch) await supabase.from('places').update({ plan_branch: next }).eq('id', p.id)
    }
    const stops = await stopsForPlace(p)
    for (const s of stops) {
      if (s.branch_idx == null) continue
      const next = to(s.branch_idx)
      if (next === s.branch_idx) continue
      const fields: Record<string, unknown> = { branch_idx: next }
      const goneUrl = remap.before[s.branch_idx]?.map_url
      if (next == null && goneUrl && s.map_url === goneUrl) fields.map_url = p.map_url
      await supabase.from('itinerary_stops').update(fields).eq('id', s.id)
    }
  }
}

/** Same, for every copy of an Explore item that lives in a trip I can write to.
 *  Copies in other people's trips are left alone by RLS — same limit as
 *  `updateExploreCopies`, which propagates the branch edit itself. */
export async function remapExploreCopyBranches(exploreId: string, tripIds: string[], remap: BranchRemap) {
  if (!tripIds.length) return
  const { data } = await supabase.from('places').select('*').eq('source_explore_id', exploreId).in('trip_id', tripIds)
  await remapBranchIndexes((data ?? []) as Place[], remap)
}

/** Copy a place (from a shared trip / Explore) into one of the user's own trips.
 *  Pass `opts.id` to control the new row id (so the caller can select it right
 *  away). A copy always lands in the trip's Location list; it joins the plan
 *  later, by being put on a day. */
export async function copyPlaceToTrip(
  place: Place, targetTripId: string, sourceExploreId?: string,
  opts?: { id?: string; planBranch?: number | null },
) {
  // an Explore item carries its ONE shared coordinate → copy lat/lng and mark the
  // copy `pinned` so the map trusts it (every trip stays on the identical spot,
  // no re-geocode drift) while KEEPING the Explore item's real link for navigation
  const hasCoord = place.lat != null && place.lng != null
  const payload: Record<string, unknown> = {
    id: opts?.id ?? crypto.randomUUID(), trip_id: targetTripId, group_type: place.group_type, category: place.category,
    name: place.name, station_line: place.station_line, station_color: place.station_color, station_name: place.station_name,
    routes: place.routes ?? null, branches: place.branches ?? null, multi_branch: place.multi_branch ?? null,
    branch_label: place.branch_label ?? null,
    plan_branch: opts?.planBranch ?? null,
    map_url: place.map_url,
    note: place.note, in_plan: false, photo_path: place.photo_path, photo_url: place.photo_url ?? null, photo_focus: place.photo_focus ?? null, photos: place.photos ?? null, city: place.city,
    menu_paths: place.menu_paths ?? null,
    lat: place.lat ?? null, lng: place.lng ?? null,
    pinned: hasCoord,
    source_explore_id: sourceExploreId ?? null,
  }
  let res = await supabase.from('places').insert(payload)
  if (res.error) { const s = stripUnknown(payload, res.error.message); if (s) res = await supabase.from('places').insert(s) }
  // only re-derive when NO shared coordinate came from Explore — otherwise the
  // stamped map_url IS the pin and keeps every copy identical
  if (!res.error && !hasCoord && typeof place.map_url === 'string' && place.map_url) {
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

/** Which of these Explore items one trip already holds — the check before a
 *  bulk save, so saving a shortlist twice doesn't duplicate half of it. */
export async function savedExploreIdsInTrip(tripId: string, exploreIds: string[]) {
  if (!exploreIds.length) return new Set<string>()
  const { data } = await supabase.from('places').select('source_explore_id')
    .eq('trip_id', tripId).in('source_explore_id', exploreIds)
  return new Set((data ?? []).map((r) => r.source_explore_id as string))
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

/** Remember which branch of a multi-branch place the plan last used (index into
 *  branches, null = main location) — the default offered next time it's put on a
 *  day. Silently does nothing when plan_branch.sql hasn't been applied yet.
 *
 *  There is deliberately no setInPlan any more: a place is in the plan exactly
 *  when the itinerary has a stop for it, so the flag has no separate life. The
 *  `in_plan` column still exists but nothing writes to it and TripContext
 *  overwrites what it reads. */
export async function setPlanBranch(id: string, plan_branch: number | null) {
  const res = await supabase.from('places').update({ plan_branch }).eq('id', id)
  if (res.error && /plan_branch|column/i.test(res.error.message)) return res
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
