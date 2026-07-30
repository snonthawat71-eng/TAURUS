// Autocomplete suggestions for the manual TransitEditor / ExploreEditor: line
// names, station names and per-line station numbers, sourced from the built-in
// networks (Osaka incl. JR West, Hong Kong, Shanghai, Shenzhen, Taipei +
// Taoyuan Airport MRT, Singapore). These power the
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
import { BEIJING } from './beijing'
import { SHENZHEN } from './shenzhen'
import { TAIPEI } from './taipei'
import { SINGAPORE } from './singapore'
import { TOKYO } from './tokyo'
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
// `match` = คำที่ชี้เมืองนั้นตรงๆ · `broad` = คำระดับประเทศ ใช้เป็นตัวสำรอง
// เท่านั้น เพราะประเทศเดียวมีได้หลายเมือง (ญี่ปุ่น = โอซาก้า + โตเกียว) ถ้าเอา
// คำประเทศไปไว้ใน match ทริปโตเกียวจะดึงสายโอซาก้ามาปนทันที
interface RawNetwork { match: string[]; broad?: string[]; lines: LineSuggest[] }
const JAPAN = ['japan', 'ญี่ปุ่น', '日本']
const NETWORKS: RawNetwork[] = [
  { match: OSAKA.match, broad: JAPAN, lines: OSAKA.lines.map((l) => ({ name: l.name, color: l.color, stations: l.stations.map((s) => ({ name: s.name, num: s.num })) })) },
  { match: HK_MATCH, lines: HK_NETWORK.map((l) => ({ name: l.name, color: l.color, stations: l.stations.map((s) => ({ name: s })) })) },
  { match: SHANGHAI.match, lines: SHANGHAI.lines.map((l) => ({ name: l.name, color: l.color, stations: l.stations.map((s) => ({ name: s })) })) },
  { match: BEIJING.match, lines: BEIJING.lines.map((l) => ({ name: l.name, color: l.color, stations: l.stations.map((s) => ({ name: s })) })) },
  { match: SHENZHEN.match, lines: SHENZHEN.lines.map((l) => ({ name: l.name, color: l.color, stations: l.stations.map((s) => ({ name: s })) })) },
  { match: TAIPEI.match, lines: TAIPEI.lines.map((l) => ({ name: l.name, color: l.color, stations: l.stations.map((s) => ({ name: s.name, num: s.num })) })) },
  { match: SINGAPORE.match, lines: SINGAPORE.lines.map((l) => ({ name: l.name, color: l.color, stations: l.stations.map((s) => ({ name: s.name, num: s.num })) })) },
  { match: TOKYO.match, broad: JAPAN, lines: TOKYO.lines.map((l) => ({ name: l.name, color: l.color, stations: l.stations.map((s) => ({ name: s.name, num: s.num })) })) },
]

/** Collect line/station suggestions only for the network(s) matching the given text. */
export function suggestionsFromText(text: string): TransitSuggest {
  const h = ` ${text.toLowerCase()} `
  const hit = (ks?: string[]) => !!ks?.some((m) => h.includes(m.toLowerCase()))
  // เมืองที่ระบุชัดชนะเสมอ; ถ้าไม่เจอเมืองไหนเลยค่อยตกมาใช้คำระดับประเทศ
  // (ทริปที่เขียนแค่ "ญี่ปุ่น" ยังได้ทั้งโอซาก้าและโตเกียว ซึ่งถูกต้องแล้ว)
  let matched = NETWORKS.filter((n) => hit(n.match))
  if (!matched.length) matched = NETWORKS.filter((n) => hit(n.broad))
  const lines: LineSuggest[] = matched.flatMap((n) => n.lines)

  const set = new Set<string>()
  for (const l of lines) for (const s of l.stations) set.add(s.name)
  return { lines, stations: Array.from(set).sort() }
}

/** Collect line/station suggestions for the network(s) matching a trip. */
export function getTransitSuggestions(trip: Trip | null | undefined): TransitSuggest {
  if (!trip) return { lines: [], stations: [] }
  return suggestionsFromText([trip.country ?? '', ...(trip.cities ?? []), trip.name ?? ''].join(' '))
}

/** Look up the per-line station code (e.g. "BR09", "M16") for a line+station
 *  pair, scanning every built-in network. Returns null when unknown — networks
 *  without codes (HK/Shanghai/Shenzhen), or a custom value the user typed.
 *
 *  The stored JR codes carry a "JR-" prefix purely to keep them from colliding
 *  with Metro codes internally (New Tram P09–P18 vs JR Yumesaki P14–P17). It is
 *  dropped here so the UI shows the line symbol + station number the way the
 *  roundels expect — "O01", not "JR-O01" — which is also how JR West prints it
 *  on the actual station signs. */
export function stationCode(line: string | null | undefined, station: string | null | undefined): string | null {
  if (!line || !station) return null
  const ln = line.trim().toLowerCase()
  const sn = station.trim().toLowerCase()
  for (const n of NETWORKS) {
    const l = n.lines.find((x) => x.name.toLowerCase() === ln)
    const s = l?.stations.find((x) => x.name.toLowerCase() === sn && x.num)
    if (s?.num) return s.num.replace(/^JR-/i, '')
  }
  return null
}

/** Official colour for a known line name, scanning every built-in network.
 *  Display code prefers this over the colour stored on the row, so fixing a
 *  wrong line colour here also fixes places that were saved earlier. */
export function lineColorFor(line: string | null | undefined): string | null {
  if (!line) return null
  const ln = line.trim().toLowerCase()
  for (const n of NETWORKS) {
    const l = n.lines.find((x) => x.name.toLowerCase() === ln)
    if (l?.color) return l.color
  }
  return null
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
