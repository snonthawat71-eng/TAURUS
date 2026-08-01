// "ที่เด็ด" — the must-see shortlist for a city, worked out from what the pool
// already knows rather than hand-curated: real review scores first, then how
// many people saved it, then how many opened it.
//
// One list per city. A city with only a couple of places doesn't get one — a
// "top 10" that is simply "everything we have" is worth nothing.
import { canonicalCountry, countryFlag } from './countries'
import { tripCoverImage } from './cityImages'
import type { ExplorePlace } from './database.types'
import type { PopStat } from './exploreMutations'

/** Fewest places a city needs before its shortlist means anything. */
export const MIN_PLACES = 4
/** Most entries any one shortlist shows. */
export const MAX_PLACES = 10

export interface RatingStat { avg: number; count: number }

export interface TopEntry {
  place: ExplorePlace
  score: number
  rating: RatingStat | null
  pop: PopStat | null
  /** why it made the list — shown as a badge, or null when it just ranked well */
  reason: string | null
}

export interface TopList {
  /** url-safe id used by the route */
  key: string
  city: string
  country: string
  flag: string
  photo: string | null
  entries: TopEntry[]
  /** average of the entries that carry a real rating */
  avgRating: number
  saves: number
}

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9ก-๙]+/gi, '-').replace(/^-|-$/g, '')

/** Rank within a city: a real review score outweighs popularity, but a place
 *  nobody has rated can still get there on saves alone. */
function scoreOf(r: RatingStat | null, p: PopStat | null): number {
  const rated = r && r.count > 0 ? r.avg * 20 + Math.min(r.count, 10) * 3 : 0
  const saved = (p?.saves ?? 0) * 4
  const liked = (p?.likes ?? 0) * 2
  const seen = Math.min(p?.views ?? 0, 60) * 0.4
  return rated + saved + liked + seen
}

/** Build every city's shortlist, strongest city first. */
export function buildTopLists(
  items: ExplorePlace[],
  pop: Map<string, PopStat>,
  ratings: Map<string, RatingStat>,
): TopList[] {
  const byCity = new Map<string, ExplorePlace[]>()
  for (const e of items) {
    const city = (e.city ?? '').trim()
    if (!city) continue
    const arr = byCity.get(city)
    if (arr) arr.push(e)
    else byCity.set(city, [e])
  }

  const lists: TopList[] = []
  for (const [city, places] of byCity) {
    if (places.length < MIN_PLACES) continue
    const scored = places
      .map((place) => {
        const rating = ratings.get(place.id) ?? null
        const p = pop.get(place.id) ?? null
        return { place, rating, pop: p, score: scoreOf(rating, p), reason: null as string | null }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_PLACES)

    if (!scored.length) continue
    // one badge each, and only where it says something the ranking doesn't
    const bestRated = scored.filter((e) => e.rating && e.rating.count > 0)
      .sort((a, b) => b.rating!.avg - a.rating!.avg)[0]
    const mostSaved = scored.filter((e) => (e.pop?.saves ?? 0) > 0)
      .sort((a, b) => (b.pop!.saves) - (a.pop!.saves))[0]
    const mostTalked = scored.filter((e) => (e.pop?.comments ?? 0) > 0)
      .sort((a, b) => (b.pop!.comments) - (a.pop!.comments))[0]
    if (bestRated) bestRated.reason = `🏆 คะแนนสูงสุดในเมืองนี้`
    if (mostSaved && !mostSaved.reason) mostSaved.reason = `🔥 ${mostSaved.pop!.saves} คนเซฟ`
    if (mostTalked && !mostTalked.reason) mostTalked.reason = `💬 คุยกันเยอะที่สุด`

    const rated = scored.filter((e) => e.rating && e.rating.count > 0)
    const country = canonicalCountry(places.find((p) => p.country)?.country) || ''
    lists.push({
      key: slug(city),
      city,
      country,
      flag: countryFlag(country),
      // the same cover the trip cards use, so a city looks the same everywhere
      photo: tripCoverImage(city) ?? scored.find((e) => e.place.photo_url)?.place.photo_url ?? null,
      entries: scored,
      avgRating: rated.length ? rated.reduce((s, e) => s + e.rating!.avg, 0) / rated.length : 0,
      saves: scored.reduce((s, e) => s + (e.pop?.saves ?? 0), 0),
    })
  }

  // strongest city first: the one whose shortlist people actually engage with
  return lists.sort((a, b) => (b.saves + b.avgRating * 10) - (a.saves + a.avgRating * 10))
}

/** "ที่เด็ดในโตเกียว" for a Thai city name, "ที่เด็ดใน Tokyo" for a Latin one —
 *  Thai doesn't space its words, but running it straight into Latin letters
 *  reads as one broken word. */
export function topTitle(city: string): string {
  return `ที่เด็ดใน${/^[\u0E00-\u0E7F]/.test(city.trim()) ? '' : ' '}${city}`
}

/** The lists to show for the current filter: every city, or just the picked
 *  country/city. Returns them in display order. */
export function topListsFor(all: TopList[], country: string, city: string): TopList[] {
  if (city && city !== 'all') return all.filter((l) => l.city === city)
  if (country && country !== 'all') return all.filter((l) => canonicalCountry(l.country) === canonicalCountry(country))
  return all
}
