// Hong Kong MTR network (station names + order + interchanges) for routing.
// Interchanges are stations that share the same name across lines.
import type { Transit, TransitLeg } from '@/lib/database.types'

interface HKLine { id: string; name: string; color: string; stations: string[]; extra?: [string, string][] }

export const HK_NETWORK: HKLine[] = [
  { id: 'TWL', name: 'Tsuen Wan', color: '#E6000F', stations: [
    'Central', 'Admiralty', 'Tsim Sha Tsui', 'Jordan', 'Yau Ma Tei', 'Mong Kok', 'Prince Edward',
    'Sham Shui Po', 'Cheung Sha Wan', 'Lai Chi Kok', 'Mei Foo', 'Lai King', 'Kwai Fong', 'Kwai Hing', 'Tai Wo Hau', 'Tsuen Wan'] },
  { id: 'KTL', name: 'Kwun Tong', color: '#00A040', stations: [
    'Whampoa', 'Ho Man Tin', 'Yau Ma Tei', 'Mong Kok', 'Prince Edward', 'Shek Kip Mei', 'Kowloon Tong',
    'Lok Fu', 'Wong Tai Sin', 'Diamond Hill', 'Choi Hung', 'Kowloon Bay', 'Ngau Tau Kok', 'Kwun Tong', 'Lam Tin', 'Yau Tong', 'Tiu Keng Leng'] },
  { id: 'ISL', name: 'Island', color: '#0075C2', stations: [
    'Kennedy Town', 'HKU', 'Sai Ying Pun', 'Sheung Wan', 'Central', 'Admiralty', 'Wan Chai', 'Causeway Bay',
    'Tin Hau', 'Fortress Hill', 'North Point', 'Quarry Bay', 'Tai Koo', 'Sai Wan Ho', 'Shau Kei Wan', 'Heng Fa Chuen', 'Chai Wan'] },
  { id: 'TKL', name: 'Tseung Kwan O', color: '#7D3C93', stations: [
    'North Point', 'Quarry Bay', 'Yau Tong', 'Tiu Keng Leng', 'Tseung Kwan O', 'Hang Hau', 'Po Lam'],
    extra: [['Tseung Kwan O', 'LOHAS Park']] },
  { id: 'TCL', name: 'Tung Chung', color: '#F3982C', stations: [
    'Hong Kong', 'Kowloon', 'Olympic', 'Nam Cheong', 'Lai King', 'Tsing Yi', 'Sunny Bay', 'Tung Chung'] },
  { id: 'AEL', name: 'Airport Express', color: '#00888E', stations: [
    'Hong Kong', 'Kowloon', 'Tsing Yi', 'Airport', 'AsiaWorld-Expo'] },
  { id: 'TML', name: 'Tuen Ma', color: '#9C2E00', stations: [
    'Wu Kai Sha', 'Ma On Shan', 'Heng On', 'Tai Shui Hang', 'Shek Mun', 'City One', 'Sha Tin Wai', 'Che Kung Temple',
    'Tai Wai', 'Hin Keng', 'Diamond Hill', 'Kai Tak', 'Sung Wong Toi', 'To Kwa Wan', 'Ho Man Tin', 'Hung Hom',
    'East Tsim Sha Tsui', 'Austin', 'Nam Cheong', 'Mei Foo', 'Tsuen Wan West', 'Kam Sheung Road', 'Yuen Long',
    'Long Ping', 'Tin Shui Wai', 'Siu Hong', 'Tuen Mun'] },
  { id: 'EAL', name: 'East Rail', color: '#5DB7E8', stations: [
    'Admiralty', 'Exhibition Centre', 'Hung Hom', 'Mong Kok East', 'Kowloon Tong', 'Tai Wai', 'Sha Tin', 'Fo Tan',
    'University', 'Tai Po Market', 'Tai Wo', 'Fanling', 'Sheung Shui', 'Lo Wu'],
    extra: [['Sheung Shui', 'Lok Ma Chau']] },
  { id: 'SIL', name: 'South Island', color: '#CBD300', stations: [
    'Admiralty', 'Ocean Park', 'Wong Chuk Hang', 'Lei Tung', 'South Horizons'] },
  { id: 'DRL', name: 'Disneyland Resort', color: '#EB6EA5', stations: ['Sunny Bay', 'Disneyland Resort'] },
]

export const lineColor = (id: string) => HK_NETWORK.find((l) => l.id === id)?.color ?? '#666'
export const lineName = (id: string) => HK_NETWORK.find((l) => l.id === id)?.name ?? id

// ---- graph: state = (station, line) ----
interface Edge { to: string; line: string }
const adj: Record<string, Edge[]> = {}
const stationLines: Record<string, Set<string>> = {}
const push = (a: string, b: string, line: string) => { (adj[a] ??= []).push({ to: b, line }) }
for (const l of HK_NETWORK) {
  for (const s of l.stations) (stationLines[s] ??= new Set()).add(l.id)
  for (let i = 0; i + 1 < l.stations.length; i++) { push(l.stations[i], l.stations[i + 1], l.id); push(l.stations[i + 1], l.stations[i], l.id) }
  for (const [a, b] of l.extra ?? []) { push(a, b, l.id); push(b, a, l.id); (stationLines[b] ??= new Set()).add(l.id) }
}

export const HK_STATION_LIST = Object.keys(stationLines).sort()
export const isHKStation = (name: string) => !!stationLines[name]

/** Index of a station on a line (for direction/stop counting). */
function idxOnLine(line: string, station: string) {
  const l = HK_NETWORK.find((x) => x.id === line)!
  return l.stations.indexOf(station)
}

/** Compute an MTR route (min transfers) between two station names. */
export function computeRouteHK(fromName: string, toName: string): Transit | null {
  if (fromName === toName || !stationLines[fromName] || !stationLines[toName]) return null
  const TRANSFER = 6
  const key = (s: string, l: string) => `${s}|${l}`
  const dist = new Map<string, number>()
  const prev = new Map<string, { s: string; l: string } | null>()
  const pq: { s: string; l: string; d: number }[] = []
  for (const e of adj[fromName] ?? []) { dist.set(key(fromName, e.line), 0); prev.set(key(fromName, e.line), null); pq.push({ s: fromName, l: e.line, d: 0 }) }
  if (!pq.length) return null
  let best: { s: string; l: string } | null = null
  while (pq.length) {
    pq.sort((a, b) => a.d - b.d)
    const cur = pq.shift()!
    if (cur.d > (dist.get(key(cur.s, cur.l)) ?? Infinity)) continue
    if (cur.s === toName) { best = { s: cur.s, l: cur.l }; break }
    for (const e of adj[cur.s] ?? []) {
      const cost = cur.d + 1 + (e.line !== cur.l ? TRANSFER : 0)
      const k = key(e.to, e.line)
      if (cost < (dist.get(k) ?? Infinity)) { dist.set(k, cost); prev.set(k, { s: cur.s, l: cur.l }); pq.push({ s: e.to, l: e.line, d: cost }) }
    }
  }
  if (!best) return null
  const path: { s: string; l: string }[] = []
  let node: { s: string; l: string } | null = best
  while (node) { path.unshift(node); node = prev.get(key(node.s, node.l)) ?? null }

  const legs: TransitLeg[] = []
  let seg = 0
  for (let i = 1; i <= path.length; i++) {
    if (i === path.length || path[i].l !== path[seg].l) {
      const line = path[seg].l
      const board = seg === 0 ? path[0].s : path[seg - 1].s
      const off = path[i - 1].s
      const l = HK_NETWORK.find((x) => x.id === line)!
      const iF = idxOnLine(line, board), iT = idxOnLine(line, off)
      const terminus = iT > iF ? l.stations[l.stations.length - 1] : l.stations[0]
      legs.push({
        line: l.name, color: l.color, from: board, to: off,
        direction: `ไปทาง ${terminus}`,
        stops: Math.abs(iT - iF),
        minutes: undefined,
        ...(i < path.length ? { transferAfter: {} } : {}),
      })
      seg = i
    }
  }
  return { legs }
}
