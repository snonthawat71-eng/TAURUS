import type { BuiltNetwork, MetroNetwork, StationNode } from './types'

function lerp(a: [number, number], b: [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

/** Compute station coordinates from explicit hub coords by interpolating the
 *  stations between hubs along each line (interchanges must be hubs). */
export function buildNetwork(net: MetroNetwork): BuiltNetwork {
  const coords: Record<string, [number, number]> = { ...net.hubs }

  for (const line of net.lines) {
    const ids = line.stations.map((s) => s.id)
    const anchorIdx = ids.map((id, i) => (coords[id] ? i : -1)).filter((i) => i >= 0)
    if (anchorIdx.length === 0) continue

    // between consecutive anchors
    for (let a = 0; a < anchorIdx.length - 1; a++) {
      const i0 = anchorIdx[a]
      const i1 = anchorIdx[a + 1]
      const c0 = coords[ids[i0]]
      const c1 = coords[ids[i1]]
      for (let k = i0 + 1; k < i1; k++) {
        coords[ids[k]] = lerp(c0, c1, (k - i0) / (i1 - i0))
      }
    }
    // extrapolate ends using the nearest anchor segment direction
    const first = anchorIdx[0]
    const last = anchorIdx[anchorIdx.length - 1]
    const stepBefore: [number, number] = anchorIdx.length > 1
      ? dirStep(coords[ids[anchorIdx[1]]], coords[ids[first]])
      : [0, -26]
    for (let k = first - 1; k >= 0; k--) coords[ids[k]] = [coords[ids[k + 1]][0] + stepBefore[0], coords[ids[k + 1]][1] + stepBefore[1]]
    const stepAfter: [number, number] = anchorIdx.length > 1
      ? dirStep(coords[ids[anchorIdx[anchorIdx.length - 2]]], coords[ids[last]])
      : [0, 26]
    for (let k = last + 1; k < ids.length; k++) coords[ids[k]] = [coords[ids[k - 1]][0] + stepAfter[0], coords[ids[k - 1]][1] + stepAfter[1]]
  }

  // assemble station nodes
  const byId: Record<string, StationNode> = {}
  for (const line of net.lines) {
    for (const s of line.stations) {
      const c = coords[s.id] ?? [0, 0]
      if (!byId[s.id]) byId[s.id] = { id: s.id, name: s.name, x: c[0], y: c[1], lineIds: [], numbers: {} }
      if (!byId[s.id].lineIds.includes(line.id)) byId[s.id].lineIds.push(line.id)
      byId[s.id].numbers[line.id] = s.num
    }
  }
  const stations = Object.values(byId)
  const xs = stations.map((s) => s.x)
  const ys = stations.map((s) => s.y)
  const pad = 40
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  for (const s of stations) { s.x = s.x - minX + pad; s.y = s.y - minY + pad }

  const lineById = Object.fromEntries(net.lines.map((l) => [l.id, l]))
  return {
    id: net.id, name: net.name, lines: net.lines, lineById,
    stations, stationById: byId,
    width: Math.max(...stations.map((s) => s.x)) + pad,
    height: Math.max(...stations.map((s) => s.y)) + pad,
  }
}

function dirStep(from: [number, number], to: [number, number]): [number, number] {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const len = Math.hypot(dx, dy) || 1
  const step = 26
  return [(dx / len) * step, (dy / len) * step]
}
