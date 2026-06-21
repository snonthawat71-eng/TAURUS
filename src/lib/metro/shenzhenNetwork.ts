// Shenzhen Metro network for routing — built from the line/station data in
// shenzhen.ts (same source the manual suggestions use). Mirrors shanghaiNetwork:
// a Dijkstra over (station, line) states that penalises transfers, returning a
// Transit broken into per-line legs. Interchanges are stations that appear (by
// name) on more than one line.
import { SHENZHEN } from './shenzhen'
import type { Transit, TransitLeg } from '@/lib/database.types'

interface SZLine { id: string; name: string; color: string; stations: string[] }

export const SZ_NETWORK: SZLine[] = SHENZHEN.lines.map((l) => ({
  id: l.name, name: l.name, color: l.color, stations: l.stations,
}))

export const lineColor = (id: string) => SZ_NETWORK.find((l) => l.id === id)?.color ?? '#666'

interface Edge { to: string; line: string }
const adj: Record<string, Edge[]> = {}
const stationLines: Record<string, Set<string>> = {}
const push = (a: string, b: string, line: string) => { (adj[a] ??= []).push({ to: b, line }) }
for (const l of SZ_NETWORK) {
  for (const s of l.stations) (stationLines[s] ??= new Set()).add(l.id)
  for (let i = 0; i + 1 < l.stations.length; i++) { push(l.stations[i], l.stations[i + 1], l.id); push(l.stations[i + 1], l.stations[i], l.id) }
}

export const SZ_STATION_LIST = Object.keys(stationLines).sort()
export const isSZStation = (name: string) => !!stationLines[name]
export const linesOf = (name: string) => Array.from(stationLines[name] ?? [])

function idxOnLine(line: string, station: string) {
  return SZ_NETWORK.find((x) => x.id === line)!.stations.indexOf(station)
}

export function computeRouteShenzhen(fromName: string, toName: string): Transit | null {
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
      const l = SZ_NETWORK.find((x) => x.id === line)!
      const iF = idxOnLine(line, board), iT = idxOnLine(line, off)
      const terminus = iT > iF ? l.stations[l.stations.length - 1] : l.stations[0]
      legs.push({ line: l.name, color: l.color, from: board, to: off, direction: `ไปทาง ${terminus}`, stops: Math.abs(iT - iF), minutes: undefined, ...(i < path.length ? { transferAfter: {} } : {}) })
      seg = i
    }
  }
  return { legs }
}
