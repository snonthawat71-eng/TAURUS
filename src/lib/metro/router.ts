import type { BuiltNetwork } from './types'
import type { Transit, TransitLeg } from '@/lib/database.types'

interface Edge { to: string; lineId: string }

function adjacency(net: BuiltNetwork): Record<string, Edge[]> {
  const adj: Record<string, Edge[]> = {}
  const push = (a: string, b: string, lineId: string) => {
    ;(adj[a] ??= []).push({ to: b, lineId })
  }
  for (const line of net.lines) {
    for (let i = 0; i < line.stations.length - 1; i++) {
      const a = line.stations[i].id
      const b = line.stations[i + 1].id
      push(a, b, line.id)
      push(b, a, line.id)
    }
  }
  return adj
}

/** Dijkstra over (station,line) states; transfers cost extra so the route uses
 *  as few line changes as possible. Returns the ordered list of (station,line). */
function shortestPath(net: BuiltNetwork, from: string, to: string): { station: string; line: string | null }[] | null {
  const adj = adjacency(net)
  const TRANSFER = 6
  const key = (s: string, l: string) => `${s}|${l}`
  const dist = new Map<string, number>()
  const prev = new Map<string, { s: string; l: string } | null>()
  // priority queue (simple array)
  const pq: { s: string; l: string; d: number }[] = []
  for (const e of adj[from] ?? []) {
    dist.set(key(from, e.lineId), 0)
    prev.set(key(from, e.lineId), null)
    pq.push({ s: from, l: e.lineId, d: 0 })
  }
  if (pq.length === 0) return null

  let best: { s: string; l: string } | null = null
  while (pq.length) {
    pq.sort((a, b) => a.d - b.d)
    const cur = pq.shift()!
    if (cur.d > (dist.get(key(cur.s, cur.l)) ?? Infinity)) continue
    if (cur.s === to) { best = { s: cur.s, l: cur.l }; break }
    for (const e of adj[cur.s] ?? []) {
      const cost = cur.d + 1 + (e.lineId !== cur.l ? TRANSFER : 0)
      const k = key(e.to, e.lineId)
      if (cost < (dist.get(k) ?? Infinity)) {
        dist.set(k, cost)
        prev.set(k, { s: cur.s, l: cur.l })
        pq.push({ s: e.to, l: e.lineId, d: cost })
      }
    }
  }
  if (!best) return null

  const path: { station: string; line: string | null }[] = []
  let node: { s: string; l: string } | null = best
  while (node) {
    path.unshift({ station: node.s, line: node.l })
    node = prev.get(key(node.s, node.l)) ?? null
  }
  // path starts at `from` (line of first hop). prepend origin marker handled by grouping.
  return path
}

const label = (name: string, num?: string) => (num ? `${name} (${num})` : name)

/** Compute a Transit (legs) between two station ids, or null if no route. */
export function computeRoute(net: BuiltNetwork, fromId: string, toId: string): Transit | null {
  if (fromId === toId) return null
  const path = shortestPath(net, fromId, toId)
  if (!path || path.length < 2) return null

  // group consecutive stations by line into legs
  const legs: TransitLeg[] = []
  let segStart = 0
  for (let i = 1; i <= path.length; i++) {
    const endOfSeg = i === path.length || path[i].line !== path[segStart].line
    if (endOfSeg) {
      const lineId = path[segStart].line!
      const line = net.lineById[lineId]
      // board at the transfer station (= last station of the previous leg), or the origin
      const boardId = segStart === 0 ? path[0].station : path[segStart - 1].station
      const fromStation = net.stationById[boardId]
      const toStation = net.stationById[path[i - 1].station]
      // direction = the line's terminus toward travel
      const idxFrom = line.stations.findIndex((s) => s.id === fromStation.id)
      const idxTo = line.stations.findIndex((s) => s.id === toStation.id)
      const terminus = idxTo > idxFrom ? line.stations[line.stations.length - 1] : line.stations[0]
      legs.push({
        line: line.name,
        color: line.color,
        from: label(fromStation.name, fromStation.numbers[lineId]),
        to: label(toStation.name, toStation.numbers[lineId]),
        direction: `ทาง ${terminus.name}`,
        stops: Math.abs(idxTo - idxFrom),
        minutes: undefined,
        ...(i < path.length ? { transferAfter: {} } : {}),
      })
      segStart = i
    }
  }
  return { legs }
}
