// Autocomplete suggestions for the manual TransitEditor / ExploreEditor: line
// names, station names and per-line station numbers, sourced from the built-in
// networks (Osaka Metro + Hong Kong MTR + Shanghai Metro). These power the
// Combobox dropdowns so users can pick from known data without retyping — while
// still being free to type any custom value (including stations not listed).
//
// The built-in ("system") data is matched to the trip's country/city: only the
// network(s) whose keywords appear in the trip are offered, so lines/stations
// from different cities never get mixed together. A trip with no matching
// network simply gets no suggestions (users type their own values freely).
import { OSAKA } from './osaka'
import { HK_NETWORK } from './hkNetwork'
import { SHANGHAI } from './shanghai'
import type { Trip } from '@/lib/database.types'

export interface StationSuggest { name: string; num?: string }
export interface LineSuggest { name: string; color: string; stations: StationSuggest[] }
export interface TransitSuggest {
  lines: LineSuggest[]
  /** de-duplicated, sorted list of every station name across all lines */
  stations: string[]
}

const HK_MATCH = ['hong kong', 'hongkong', 'ฮ่องกง', ' hk', 'mtr']

// Every built-in network normalised to a common { match, lines } shape.
interface RawNetwork { match: string[]; lines: LineSuggest[] }
const NETWORKS: RawNetwork[] = [
  { match: OSAKA.match, lines: OSAKA.lines.map((l) => ({ name: l.name, color: l.color, stations: l.stations.map((s) => ({ name: s.name, num: s.num })) })) },
  { match: HK_MATCH, lines: HK_NETWORK.map((l) => ({ name: l.name, color: l.color, stations: l.stations.map((s) => ({ name: s })) })) },
  { match: SHANGHAI.match, lines: SHANGHAI.lines.map((l) => ({ name: l.name, color: l.color, stations: l.stations.map((s) => ({ name: s })) })) },
]

/** Collect line/station suggestions only for the network(s) matching the given text. */
export function suggestionsFromText(text: string): TransitSuggest {
  const h = ` ${text.toLowerCase()} `
  const lines: LineSuggest[] = []
  for (const n of NETWORKS) {
    if (n.match.some((m) => h.includes(m.toLowerCase()))) lines.push(...n.lines)
  }

  const set = new Set<string>()
  for (const l of lines) for (const s of l.stations) set.add(s.name)
  return { lines, stations: Array.from(set).sort() }
}

/** Collect line/station suggestions for the network(s) matching a trip. */
export function getTransitSuggestions(trip: Trip | null | undefined): TransitSuggest {
  if (!trip) return { lines: [], stations: [] }
  return suggestionsFromText([trip.country ?? '', ...(trip.cities ?? []), trip.name ?? ''].join(' '))
}

/** Find a suggested line by its (case-insensitive) name. */
export function findLine(sug: TransitSuggest, name: string): LineSuggest | undefined {
  const n = name.trim().toLowerCase()
  if (!n) return undefined
  return sug.lines.find((l) => l.name.toLowerCase() === n)
}

/** If both stations sit on the same known line, return the stop count + terminus. */
export function legBetween(line: LineSuggest, from: string, to: string): { stops: number; terminus: string } | null {
  const iF = line.stations.findIndex((s) => s.name.toLowerCase() === from.trim().toLowerCase())
  const iT = line.stations.findIndex((s) => s.name.toLowerCase() === to.trim().toLowerCase())
  if (iF < 0 || iT < 0 || iF === iT) return null
  const terminus = iT > iF ? line.stations[line.stations.length - 1].name : line.stations[0].name
  return { stops: Math.abs(iT - iF), terminus }
}
