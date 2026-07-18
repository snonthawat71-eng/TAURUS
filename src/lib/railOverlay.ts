// Pure transform for the TripMap rail overlay: Overpass `out geom` elements →
// drawable shapes. Kept free of Leaflet/DOM so it can be unit-tested in Node
// (scripts/test-rail.mjs) — this is the layer that silently broke before.

export interface OverpassEl {
  type: 'relation' | 'node' | 'way'
  id: number
  lat?: number
  lon?: number
  tags?: Record<string, string>
  members?: { type: string; role?: string; geometry?: { lat: number; lon: number }[] }[]
}

export interface RailShapes {
  lines: { color: string; points: [number, number][] }[]
  stations: [number, number][]
}

/** Overpass elements → coloured polylines + station dots.
 *  - relation colour comes from its `colour` tag (bare hex tolerated), grey fallback
 *  - the two per-direction relations of a line dedupe by ref+colour
 *  - platform/stop members and clipped-out (geometry-less) members are skipped */
export function railShapes(els: OverpassEl[]): RailShapes {
  const lines: RailShapes['lines'] = []
  const stations: RailShapes['stations'] = []
  const seen = new Set<string>()
  for (const el of els) {
    if (el.type === 'relation') {
      const t = el.tags ?? {}
      const raw = (t.colour ?? '').trim()
      const color = raw ? (/^[0-9a-f]{3,8}$/i.test(raw) ? `#${raw}` : raw) : '#7A8699'
      const key = `${t.ref ?? t.name ?? el.id}|${color}`
      if (seen.has(key)) continue
      seen.add(key)
      for (const m of el.members ?? []) {
        if (m.type !== 'way' || !m.geometry?.length) continue
        if (/platform|stop/i.test(m.role ?? '')) continue
        lines.push({ color, points: m.geometry.map((g) => [g.lat, g.lon] as [number, number]) })
      }
    } else if (el.type === 'node' && el.lat != null && el.lon != null) {
      stations.push([el.lat, el.lon])
    }
  }
  return { lines, stations }
}

/** The Overpass QL query for one bbox — must stay identical to the copy in
 *  api/rail.js (Vercel functions build separately from src/).
 *  NB: `out geom(bbox)` — `out tags geom` strips members and draws nothing. */
export function railQuery(bbox: string): string {
  return `[out:json][timeout:18];(relation["type"="route"]["route"~"^(subway|light_rail|monorail|tram)$"](${bbox});node["railway"="station"]["station"~"^(subway|light_rail|monorail)$"](${bbox});node["railway"="station"]["subway"="yes"](${bbox}););out geom(${bbox});`
}

const MIRRORS = ['https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter']

/** Fetch rail elements for a bbox: our edge-cached serverless proxy first,
 *  then direct Overpass mirrors as a fallback (covers a missing/failed
 *  function deploy or a proxy outage). Returns null when everything failed. */
export async function fetchRailElements(bbox: string, signal: AbortSignal): Promise<OverpassEl[] | null> {
  try {
    const res = await fetch(`/api/rail?bbox=${encodeURIComponent(bbox)}`, { signal })
    if (res.ok) {
      const j = await res.json()
      if (Array.isArray(j?.elements)) return j.elements
    }
  } catch (e) {
    if (signal.aborted) throw e
  }
  const body = `data=${encodeURIComponent(railQuery(bbox))}`
  for (const ep of MIRRORS) {
    try {
      const res = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal })
      if (!res.ok) continue
      const j = await res.json()
      if (Array.isArray(j?.elements)) return j.elements
    } catch (e) {
      if (signal.aborted) throw e
    }
  }
  return null
}
