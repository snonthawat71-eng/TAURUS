// "ที่เด็ด" — the must-see shortlist for a country, worked out from what the
// pool already knows rather than hand-curated: real review scores first, then
// how many people saved it, then how many opened it.
//
// One list per COUNTRY. A country with only a couple of places doesn't get one
// — a "top 10" that is simply "everything we have" is worth nothing. Inside a
// country the list carries every place, ranked; the page slices it per filter
// (สถานที่ / ร้านอาหาร / คาเฟ่) so each filter gets a full ten of its own.
import { canonicalCountry, countryFlag, COUNTRIES } from './countries'
import { cityImage, tripCoverImage, countryImage, COUNTRY_IMAGES } from './cityImages'
import { foodGroupKey } from './placeMeta'
import type { ExplorePlace } from './database.types'
import type { PopStat } from './exploreMutations'

/** Fewest places a country needs before its shortlist means anything. */
export const MIN_PLACES = 4
/** Most entries any one filter shows. */
export const MAX_PLACES = 10

export interface RatingStat { avg: number; count: number }

/** The three cards the shortlist page filters by. */
export type TopBucket = 'place' | 'food' | 'cafe'

export const TOP_BUCKETS: { key: TopBucket; label: string }[] = [
  { key: 'place', label: 'Places' },
  { key: 'food', label: 'Food' },
  { key: 'cafe', label: 'Cafe' },
]

/** Cafés are pulled OUT of food so the three cards don't overlap — a place
 *  belongs to exactly one of them. */
export function bucketOf(e: ExplorePlace): TopBucket {
  if (e.group_type !== 'food') return 'place'
  return foodGroupKey(e.category) === 'gcafe' ? 'cafe' : 'food'
}

export interface TopEntry {
  place: ExplorePlace
  score: number
  rating: RatingStat | null
  pop: PopStat | null
  bucket: TopBucket
}

/** A city inside a country's shortlist — the rail under the filter cards. */
export interface TopCity {
  name: string
  photo: string | null
  count: number
}

export interface TopList {
  /** url-safe id used by the route */
  key: string
  country: string
  flag: string
  photo: string | null
  /** every place in the country, ranked — filtered and sliced by the page */
  entries: TopEntry[]
  /** the same places in the order they were shared, newest first */
  recent: ExplorePlace[]
  cities: TopCity[]
  /** average of the entries that carry a real rating */
  avgRating: number
  saves: number
}

/** url-safe id for a country name */
const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9ก-๙]+/gi, '-').replace(/^-|-$/g, '')

/** Rank within a country: a real review score outweighs popularity, but a place
 *  nobody has rated can still get there on saves alone. */
function scoreOf(r: RatingStat | null, p: PopStat | null): number {
  const rated = r && r.count > 0 ? r.avg * 20 + Math.min(r.count, 10) * 3 : 0
  const saved = (p?.saves ?? 0) * 4
  const liked = (p?.likes ?? 0) * 2
  const seen = Math.min(p?.views ?? 0, 60) * 0.4
  return rated + saved + liked + seen
}

/** Build every country's shortlist, strongest country first. */
export function buildTopLists(
  items: ExplorePlace[],
  pop: Map<string, PopStat>,
  ratings: Map<string, RatingStat>,
): TopList[] {
  const byCountry = new Map<string, ExplorePlace[]>()
  for (const e of items) {
    const country = canonicalCountry(e.country)
    if (!country) continue
    const arr = byCountry.get(country)
    if (arr) arr.push(e)
    else byCountry.set(country, [e])
  }

  const lists: TopList[] = []
  for (const [country, places] of byCountry) {
    if (places.length < MIN_PLACES) continue
    const scored: TopEntry[] = places
      .map((place) => {
        const rating = ratings.get(place.id) ?? null
        const p = pop.get(place.id) ?? null
        return { place, rating, pop: p, bucket: bucketOf(place), score: scoreOf(rating, p) }
      })
      .sort((a, b) => b.score - a.score)

    if (!scored.length) continue

    // the cities inside this country, biggest first — the rail under the cards
    const cityCount = new Map<string, { count: number; photo: string | null }>()
    for (const p of places) {
      const city = (p.city ?? '').trim()
      if (!city) continue
      const cur = cityCount.get(city)
      if (cur) cur.count++
      // the same photo the Explore city rail uses, so a city looks the same
      // in both places
      else cityCount.set(city, { count: 1, photo: cityImage(city) ?? p.photo_url ?? null })
    }
    const cities: TopCity[] = Array.from(cityCount.entries())
      .map(([name, v]) => ({ name, photo: v.photo, count: v.count }))
      .sort((a, b) => b.count - a.count)

    const rated = scored.filter((e) => e.rating && e.rating.count > 0)
    lists.push({
      key: slug(country),
      country,
      flag: countryFlag(country),
      photo: coverFor(country) ?? cities[0]?.photo ?? scored.find((e) => e.place.photo_url)?.place.photo_url ?? null,
      entries: scored,
      recent: places,
      cities,
      avgRating: rated.length ? rated.reduce((s, e) => s + e.rating!.avg, 0) / rated.length : 0,
      saves: scored.reduce((s, e) => s + (e.pop?.saves ?? 0), 0),
    })
  }

  // strongest country first: the one whose shortlist people actually engage with
  return lists.sort((a, b) => (b.saves + b.avgRating * 10) - (a.saves + a.avgRating * 10))
}

/** A country's own cover. Falls back to the city-cover map because a couple of
 *  countries ARE a city (Hong Kong, Singapore) and already have a photo there. */
function coverFor(country: string): string | null {
  return countryImage(country) ?? tripCoverImage(country) ?? null
}

/** Every country name we could resolve a photo for from a url slug alone. */
const KNOWN_COUNTRIES: string[] = [
  ...new Set([...Object.keys(COUNTRY_IMAGES), ...COUNTRIES.map((c) => c.name)]),
]

/** The country photo for a shortlist url, worked out from the slug alone.
 *
 *  The page can start loading (and colour-sampling) the photo on mount instead
 *  of waiting for the whole Explore list to arrive first — which is what made
 *  the status-bar tint flash one colour and then change. */
export function coverForKey(key: string): string | null {
  const country = KNOWN_COUNTRIES.find((c) => slug(c) === key)
  return country ? coverFor(country) : null
}

/** The country a shortlist url points at, before any data has loaded. */
export function countryForKey(key: string): string | null {
  return KNOWN_COUNTRIES.find((c) => slug(c) === key) ?? null
}

/** The url segment for a country — the other half of `countryForKey`. */
export const slugForCountry = (country: string) => slug(country)

/** Resolve a url segment against a known list first (so a country the app has
 *  never heard of still works), then the built-in one. */
export function countryForSlug(key: string, known: string[] = []): string | null {
  return known.find((c) => slug(c) === key) ?? countryForKey(key)
}

/** Heading over a shortlist — followed by the country name. */
export const TOP_LABEL = 'สถานที่ยอดฮิต'

/** The lists to show for the current filter: every country, or just the picked
 *  one. Returns them in display order. */
export function topListsFor(all: TopList[], country: string, city: string): TopList[] {
  if (country && country !== 'all') return all.filter((l) => canonicalCountry(l.country) === canonicalCountry(country))
  if (city && city !== 'all') return all.filter((l) => l.cities.some((c) => c.name === city))
  return all
}
