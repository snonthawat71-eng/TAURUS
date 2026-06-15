// Hong Kong MTR network (from the official station-list docx) for routing.
import type { Transit, TransitLeg } from '@/lib/database.types'

interface HKLine { id: string; name: string; color: string; stations: string[]; extra?: [string, string][] }

export const HK_NETWORK: HKLine[] = [
  { id: "Tsuen Wan", name: "Tsuen Wan", color: '#E6000F', stations: ["Tsuen Wan", "Tai Wo Hau", "Kwai Hing", "Kwai Fong", "Lai King", "Mei Foo", "Lai Chi Kok", "Cheung Sha Wan", "Sham Shui Po", "Prince Edward", "Mong Kok", "Yau Ma Tei", "Jordan", "Tsim Sha Tsui", "Admiralty", "Central"] },
  { id: "Kwun Tong", name: "Kwun Tong", color: '#00A040', stations: ["Tiu Keng Leng", "Yau Tong", "Lam Tin", "Kwun Tong", "Ngau Tau Kok", "Kowloon Bay", "Choi Hung", "Diamond Hill", "Wong Tai Sin", "Lok Fu", "Kowloon Tong", "Shek Kip Mei", "Prince Edward", "Mong Kok", "Yau Ma Tei", "Ho Man Tin", "Whampoa"] },
  { id: "Island", name: "Island", color: '#0075C2', stations: ["Kennedy Town", "HKU", "Sai Ying Pun", "Sheung Wan", "Central", "Admiralty", "Wan Chai", "Causeway Bay", "Tin Hau", "Fortress Hill", "North Point", "Quarry Bay", "Tai Koo", "Sai Wan Ho", "Shau Kei Wan", "Heng Fa Chuen", "Chai Wan"] },
  { id: "Tseung Kwan O", name: "Tseung Kwan O", color: '#7D3C93', stations: ["LOHAS Park", "Po Lam", "Hang Hau", "Tseung Kwan O", "Tiu Keng Leng", "Yau Tong", "Quarry Bay", "North Point"] },
  { id: "Tung Chung", name: "Tung Chung", color: '#F3982C', stations: ["Hong Kong", "Kowloon", "Olympic", "Nam Cheong", "Lai King", "Tsing Yi", "Sunny Bay", "Tung Chung"] },
  { id: "Airport Express", name: "Airport Express", color: '#00888E', stations: ["Hong Kong", "Kowloon", "Tsing Yi", "Airport", "AsiaWorld-Expo"] },
  { id: "Tuen Ma", name: "Tuen Ma", color: '#9C2E00', stations: ["Tuen Mun", "Siu Hong", "Tin Shui Wai", "Long Ping", "Yuen Long", "Kam Sheung Road", "Tsuen Wan West", "Mei Foo", "Nam Cheong", "Austin", "East Tsim Sha Tsui", "Hung Hom", "Ho Man Tin", "To Kwa Wan", "Sung Wong Toi", "Kai Tak", "Diamond Hill", "Hin Keng", "Tai Wai", "Che Kung Temple", "Sha Tin Wai", "City One", "Shek Mun", "Tai Shui Hang", "Heng On", "Ma On Shan", "Wu Kai Sha"] },
  { id: "East Rail", name: "East Rail", color: '#5DB7E8', stations: ["Admiralty", "Exhibition Centre", "Hung Hom", "Mong Kok East", "Kowloon Tong", "Tai Wai", "Sha Tin", "Fo Tan", "Racecourse", "University", "Tai Po Market", "Tai Wo", "Fanling", "Sheung Shui", "Lo Wu", "Lok Ma Chau"] },
  { id: "South Island", name: "South Island", color: '#CBD300', stations: ["Admiralty", "Ocean Park", "Wong Chuk Hang", "Lei Tung", "South Horizons"] },
  { id: "Disneyland Resort", name: "Disneyland Resort", color: '#EB6EA5', stations: ["Sunny Bay", "Disneyland Resort"] },
]

export const lineColor = (id: string) => HK_NETWORK.find((l) => l.id === id)?.color ?? '#666'

interface Edge { to: string; line: string }
const adj: Record<string, Edge[]> = {}
const stationLines: Record<string, Set<string>> = {}
const push = (a: string, b: string, line: string) => { (adj[a] ??= []).push({ to: b, line }) }
for (const l of HK_NETWORK) {
  for (const s of l.stations) (stationLines[s] ??= new Set()).add(l.id)
  for (let i = 0; i + 1 < l.stations.length; i++) { push(l.stations[i], l.stations[i + 1], l.id); push(l.stations[i + 1], l.stations[i], l.id) }
  for (const [a, b] of l.extra ?? []) { push(a, b, l.id); push(b, a, l.id) }
}

export const HK_STATION_LIST = Object.keys(stationLines).sort()
export const isHKStation = (name: string) => !!stationLines[name]
export const linesOf = (name: string) => Array.from(stationLines[name] ?? [])

function idxOnLine(line: string, station: string) {
  const l = HK_NETWORK.find((x) => x.id === line)!
  return l.stations.indexOf(station)
}

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
      legs.push({ line: l.name, color: l.color, from: board, to: off, direction: `ไปทาง ${terminus}`, stops: Math.abs(iT - iF), minutes: undefined, ...(i < path.length ? { transferAfter: {} } : {}) })
      seg = i
    }
  }
  return { legs }
}
