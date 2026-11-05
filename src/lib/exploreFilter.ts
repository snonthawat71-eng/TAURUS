import { catTabKey, FOOD_CATEGORIES } from './placeMeta'
import { canonicalCountry } from './countries'
import { cityMatchKey } from './cities'
import type { PopStat } from './exploreMutations'
import type { ExplorePlace } from './database.types'

/** Shared filter/search state for the Explore + "my shares" pages. */
export interface ExploreFilterState {
  group: 'all' | 'place' | 'food'
  cat: string
  /** canonical country name ('all' = every country, '' = the "ไม่ระบุ" bucket).
   *  Doubles as the browser's drill-down state: a country other than 'all' means
   *  the city rail is showing that country's cities. */
  country: string
  city: string
  sort: 'new' | 'old' | 'popular' | 'rating'
  q: string
}

export const initialExploreFilter: ExploreFilterState = { group: 'all', cat: 'all', country: 'all', city: 'all', sort: 'new', q: '' }

/** Does an item match the chosen subcategory? Food filters by the *detailed*
 *  category (ร้านอาหาร, คาเฟ่, …); places by their category tab. */
function matchCat(e: ExplorePlace, f: ExploreFilterState): boolean {
  if (f.cat === 'all') return true
  if (f.group === 'food') {
    if (f.cat === 'gother') return !FOOD_CATEGORIES.includes(e.category ?? '')
    return e.category === f.cat
  }
  return catTabKey(e.category, f.group) === f.cat
}

/** Apply the group/category/city/text filters, then order the result.
 *  `ratings` (real star averages) is only needed for the 'rating' sort. */
export function filterExplore(
  items: ExplorePlace[], f: ExploreFilterState, pop: Map<string, PopStat>,
  ratings?: Map<string, { avg: number; count: number }>,
): ExplorePlace[] {
  const q = f.q.trim().toLowerCase()
  const filtered = items
    .filter((e) => f.group === 'all' || e.group_type === f.group)
    .filter((e) => matchCat(e, f))
    .filter((e) => f.country === 'all' || canonicalCountry(e.country) === f.country)
    .filter((e) => f.city === 'all' || cityMatchKey(e.city) === cityMatchKey(f.city))
    .filter((e) => !q || [e.name, e.note, e.city, e.country].some((v) => (v ?? '').toLowerCase().includes(q)))
  if (f.sort === 'popular') return [...filtered].sort((a, b) => (pop.get(b.id)?.score ?? 0) - (pop.get(a.id)?.score ?? 0))
  if (f.sort === 'rating') {
    // unrated places sink to the bottom; among equal averages the one more
    // people agreed on wins, so a lone 5★ can't outrank a well-reviewed 4.8
    const key = (id: string) => ratings?.get(id) ?? { avg: 0, count: 0 }
    return [...filtered].sort((a, b) => {
      const x = key(a.id), y = key(b.id)
      return y.avg - x.avg || y.count - x.count
    })
  }
  if (f.sort === 'old') return [...filtered].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  return filtered // 'new' — items already arrive newest-first from the query
}
