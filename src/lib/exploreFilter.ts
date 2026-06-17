import { foodGroupKey } from './placeMeta'
import type { PopStat } from './exploreMutations'
import type { ExplorePlace } from './database.types'

/** Shared filter/search state for the Explore + "my shares" pages. */
export interface ExploreFilterState {
  group: 'all' | 'place' | 'food'
  cat: string
  city: string
  sort: 'new' | 'popular'
  q: string
}

export const initialExploreFilter: ExploreFilterState = { group: 'all', cat: 'all', city: 'all', sort: 'new', q: '' }

/** Apply the group/category/city/text filters, then order by recency or popularity. */
export function filterExplore(items: ExplorePlace[], f: ExploreFilterState, pop: Map<string, PopStat>): ExplorePlace[] {
  const q = f.q.trim().toLowerCase()
  const filtered = items
    .filter((e) => f.group === 'all' || e.group_type === f.group)
    .filter((e) => f.cat === 'all' || (f.group === 'food' ? foodGroupKey(e.category) === f.cat : e.category === f.cat))
    .filter((e) => f.city === 'all' || e.city === f.city)
    .filter((e) => !q || [e.name, e.note, e.city, e.country].some((v) => (v ?? '').toLowerCase().includes(q)))
  return f.sort === 'popular'
    ? [...filtered].sort((a, b) => (pop.get(b.id)?.score ?? 0) - (pop.get(a.id)?.score ?? 0))
    : filtered
}
