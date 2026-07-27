import type { ItineraryStop, Place, PlaceBranch } from './database.types'

/** Branches worth showing — an entry with nothing filled in is noise. */
export function branchesOf(p: Place | null | undefined): PlaceBranch[] {
  return (p?.branches ?? []).filter((b) => !!b && !!(b.label || b.map_url || b.line || b.station))
}

/** Does this place have its OWN location (so "ที่ตั้งหลัก" is a real choice)? */
export function hasOwnLocation(p: Place | null | undefined): boolean {
  return !!(p && (p.map_url || p.station_name || p.station_line))
}

/** Human label for a branch index — for chips and toasts. */
export function branchLabel(p: Place | null | undefined, idx: number | null | undefined): string | null {
  if (idx == null) return null
  const b = branchesOf(p)[idx]
  return b ? (b.label || `สาขา ${idx + 1}`) : null
}

/** The branch chosen when this place was added to the plan (plan_branch index),
 *  or null when the plan uses the place's own/main location. Place-level: the
 *  DEFAULT for new visits. A scheduled visit's own choice lives on the stop —
 *  see stopBranchIdx. */
export function planBranch(p: Place): PlaceBranch | null {
  return p.plan_branch != null ? p.branches?.[p.plan_branch] ?? null : null
}

/** Map link the plan should open — the chosen branch's link, else the main one. */
export function planMapUrl(p: Place): string | null {
  return planBranch(p)?.map_url || p.map_url
}

/** WHICH branch a single scheduled visit goes to. The stop's own `branch_idx`
 *  wins (so one place can be visited at different branches on different days);
 *  stops saved before stop_branch.sql have none, and fall back to the place's
 *  plan_branch exactly as before — no migration of existing rows needed. */
export function stopBranchIdx(stop: Pick<ItineraryStop, 'branch_idx'> | null | undefined, place: Place | null | undefined): number | null {
  if (stop?.branch_idx != null) return stop.branch_idx
  return place?.plan_branch ?? null
}

/** The branch object for a scheduled visit (null = the place's main location). */
export function stopBranch(stop: Pick<ItineraryStop, 'branch_idx'> | null | undefined, place: Place | null | undefined): PlaceBranch | null {
  const i = stopBranchIdx(stop, place)
  return i == null ? null : branchesOf(place)[i] ?? null
}
