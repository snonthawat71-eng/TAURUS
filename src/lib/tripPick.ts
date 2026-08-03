// Picking which trip a place should be saved into — shared by the single-place
// dialog and the "save the whole shortlist" one, so both offer the same trips
// in the same order.
import { canonicalCountry } from './countries'
import type { Trip } from './database.types'

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase()

/** The place's location keywords (city + country) and a trip's (country +
 *  every city segment) match when any pair is equal or one contains the other —
 *  lenient enough for "Taipei" vs "New Taipei", strict enough to keep a Japan
 *  place out of a Taiwan trip. */
export function tripMatchesPlace(t: Trip, placeTokens: string[]): boolean {
  return !!matchedTokens(t, placeTokens).length
}

/** Which of a place's keywords a trip covers — the same test, but it says what
 *  matched, so the UI can explain itself ("ตรงกับทริปนี้ 7 ที่ · Shenzhen"). */
export function matchedTokens(t: Trip, placeTokens: string[]): string[] {
  const raw = [
    t.country, canonicalCountry(t.country), ...(t.cities ?? []),
    ...(t.segments ?? []).flatMap((s) => [s.city, (s as { country?: string | null }).country]),
  ]
  const tripTokens = raw.map(norm).filter(Boolean)
  return placeTokens.filter((p) => tripTokens.some((tt) => tt === p || tt.includes(p) || p.includes(tt)))
}

/** Location keywords for a set of places, deduped. The country goes in twice —
 *  as typed and folded — so a place saved as "จีน" still meets a trip that says
 *  "China". */
export function placeTokens(places: { city?: string | null; country?: string | null }[]): string[] {
  return [...new Set(places
    .flatMap((p) => [norm(p.city), norm(p.country), norm(canonicalCountry(p.country))])
    .filter(Boolean))]
}

/** The place's own city, for telling the user which city a trip matched on. */
export function cityOf(p: { city?: string | null }): string {
  return (p.city ?? '').trim()
}

/** A trip that already ended — hardly anyone saves into one, so it sinks to the
 *  bottom and is shown quietly. Same rule as the home dashboard's
 *  Upcoming/Past split (ends before today = past). */
export function isPastTrip(t: Trip): boolean {
  if (!t.start_date) return false // undated trips are still being planned
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return new Date(t.end_date || t.start_date).getTime() < today.getTime()
}

/** Upcoming/current first (soonest first), finished trips last (most recent
 *  first). Undated trips sort last among the live ones — a dated trip coming up
 *  is the likelier target — never to the very top. */
export function sortTripsForSave(trips: Trip[]): Trip[] {
  const key = (t: Trip) => (t.start_date ? new Date(t.start_date).getTime() : Number.POSITIVE_INFINITY)
  const live = trips.filter((t) => !isPastTrip(t)).sort((a, b) => key(a) - key(b))
  const past = trips.filter(isPastTrip).sort((a, b) => key(b) - key(a))
  return [...live, ...past]
}
