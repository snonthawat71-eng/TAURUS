// Routing over the Osaka Metro built directly from the codes/positions we
// extracted from the official map (so the map you see and the router agree).
// Only the square (Osaka Metro) stations in GEO_LABELS are routable.
import { GEO_LABELS } from './osakaGeo'
import { GEO_INTERCHANGES } from './osakaGeo'
import { OSAKA } from './osaka'
import type { Transit, TransitLeg } from '@/lib/database.types'

export const LINE_META: Record<string, { name: string; color: string }> = {
  M: { name: 'Midosuji', color: '#E5171F' },
  T: { name: 'Tanimachi', color: '#762F8E' },
  Y: { name: 'Yotsubashi', color: '#0078BE' },
  C: { name: 'Chuo', color: '#009944' },
  S: { name: 'Sennichimae', color: '#E5007F' },
  K: { name: 'Sakaisuji', color: '#8E591F' },
  N: { name: 'Nagahori Tsurumi-ryokuchi', color: '#9DC238' },
  I: { name: 'Imazatosuji', color: '#EE7B1A' },
  P: { name: 'Nanko Port Town', color: '#00A6CF' },
}

// code → friendly station name (from the hand dataset, where present)
const NAME: Record<string, string> = {}
for (const l of OSAKA.lines) for (const s of l.stations) NAME[s.num] = s.name
export const stationName = (code: string) => NAME[code] ?? code

interface Node { code: string; line: string; num: number; x: number; y: number; cl: number }
const nodes: Node[] = GEO_LABELS.map((l) => ({ code: l.code, line: l.code[0], num: parseInt(l.code.slice(1)), x: l.x, y: l.y, cl: -1 }))
const byCode = new Map(nodes.map((n) => [n.code, n]))

// cluster codes into physical stations using the explicit interchange groups;
// every other station is its own cluster.
const clusterOf = new Map<string, number>()
let nc = 0
for (const grp of GEO_INTERCHANGES) {
  for (const code of grp) if (byCode.has(code)) clusterOf.set(code, nc)
  nc++
}
for (const n of nodes) {
  if (clusterOf.has(n.code)) n.cl = clusterOf.get(n.code)!
  else { n.cl = nc++ }
}
// cluster → { line: code }
const clusterCodes: Record<number, Record<string, string>> = {}
for (const n of nodes) (clusterCodes[n.cl] ??= {})[n.line] = n.code

// per-line ordered clusters (by station number)
const lineClusters: Record<string, number[]> = {}
{
  const byLine: Record<string, Node[]> = {}
  for (const n of nodes) (byLine[n.line] ??= []).push(n)
  for (const line in byLine) {
    byLine[line].sort((a, b) => a.num - b.num)
    lineClusters[line] = byLine[line].map((n) => n.cl)
  }
}
// adjacency: edges between consecutive clusters along each line
interface Edge { to: number; line: string }
const adj: Record<number, Edge[]> = {}
const push = (a: number, b: number, line: string) => { (adj[a] ??= []).push({ to: b, line }) }
for (const line in lineClusters) {
  const seq = lineClusters[line]
  for (let i = 0; i + 1 < seq.length; i++) { push(seq[i], seq[i + 1], line); push(seq[i + 1], seq[i], line) }
}

export const isStation = (code: string) => byCode.has(code)

function indexOnLine(line: string, cl: number) { return lineClusters[line].indexOf(cl) }

/** Compute a route between two station codes (min transfers), as Transit legs. */
export function computeRouteByCode(fromCode: string, toCode: string): Transit | null {
  const a = byCode.get(fromCode), b = byCode.get(toCode)
  if (!a || !b || a.cl === b.cl) return null
  const from = a.cl, to = b.cl
  const TRANSFER = 6
  const key = (c: number, l: string) => `${c}|${l}`
  const dist = new Map<string, number>()
  const prev = new Map<string, { c: number; l: string } | null>()
  const pq: { c: number; l: string; d: number }[] = []
  for (const e of adj[from] ?? []) { dist.set(key(from, e.line), 0); prev.set(key(from, e.line), null); pq.push({ c: from, l: e.line, d: 0 }) }
  if (!pq.length) return null
  let best: { c: number; l: string } | null = null
  while (pq.length) {
    pq.sort((x, y) => x.d - y.d)
    const cur = pq.shift()!
    if (cur.d > (dist.get(key(cur.c, cur.l)) ?? Infinity)) continue
    if (cur.c === to) { best = { c: cur.c, l: cur.l }; break }
    for (const e of adj[cur.c] ?? []) {
      const cost = cur.d + 1 + (e.line !== cur.l ? TRANSFER : 0)
      const k = key(e.to, e.line)
      if (cost < (dist.get(k) ?? Infinity)) { dist.set(k, cost); prev.set(k, { c: cur.c, l: cur.l }); pq.push({ c: e.to, l: e.line, d: cost }) }
    }
  }
  if (!best) return null
  const path: { c: number; l: string }[] = []
  let node: { c: number; l: string } | null = best
  while (node) { path.unshift(node); node = prev.get(key(node.c, node.l)) ?? null }

  const legs: TransitLeg[] = []
  let seg = 0
  for (let i = 1; i <= path.length; i++) {
    if (i === path.length || path[i].l !== path[seg].l) {
      const line = path[seg].l
      const boardCl = seg === 0 ? path[0].c : path[seg - 1].c
      const offCl = path[i - 1].c
      const fc = clusterCodes[boardCl][line], tc = clusterCodes[offCl][line]
      const seq = lineClusters[line]
      const iF = indexOnLine(line, boardCl), iT = indexOnLine(line, offCl)
      const terminusCl = iT > iF ? seq[seq.length - 1] : seq[0]
      const terminusCode = clusterCodes[terminusCl][line]
      const meta = LINE_META[line]
      legs.push({
        line: meta.name,
        color: meta.color,
        from: `${stationName(fc)} (${fc})`,
        to: `${stationName(tc)} (${tc})`,
        direction: `ไปทาง ${stationName(terminusCode)}`,
        stops: Math.abs(iT - iF),
        minutes: undefined,
        ...(i < path.length ? { transferAfter: {} } : {}),
      })
      seg = i
    }
  }
  return { legs }
}

/** Searchable list of routable stations. */
export const STATION_LIST = GEO_LABELS.map((l) => ({ code: l.code, name: stationName(l.code) }))
