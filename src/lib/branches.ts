import type { Place, PlaceBranch } from './database.types'

/** The branch chosen when this place was added to the plan (plan_branch index),
 *  or null when the plan uses the place's own/main location. */
export function planBranch(p: Place): PlaceBranch | null {
  return p.plan_branch != null ? p.branches?.[p.plan_branch] ?? null : null
}

/** Map link the plan should open — the chosen branch's link, else the main one. */
export function planMapUrl(p: Place): string | null {
  return planBranch(p)?.map_url || p.map_url
}
