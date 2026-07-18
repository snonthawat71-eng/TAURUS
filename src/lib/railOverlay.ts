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

const MIRRORS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter', // most generous limits
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]

/** fetch with a per-attempt timeout, chained to the caller's master signal so
 *  a superseded load still cancels everything immediately. */
async function timedFetch(url: string, init: RequestInit, ms: number, outer: AbortSignal): Promise<Response> {
  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  outer.addEventListener('abort', onAbort)
  const t = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { ...init, signal: ctrl.signal }) }
  finally { clearTimeout(t); outer.removeEventListener('abort', onAbort) }
}

/** Fetch rail elements for a bbox: our edge-cached serverless proxy first,
 *  then direct Overpass mirrors as a fallback (covers a missing/failed
 *  function deploy or a proxy outage). Every hop reports through onStep so
 *  the test page can show exactly where the chain fails. Returns null when
 *  everything failed. */
export async function fetchRailElements(bbox: string, signal: AbortSignal, onStep?: (s: string) => void): Promise<OverpassEl[] | null> {
  try {
    onStep?.('API ของแอป…')
    const res = await timedFetch(`/api/rail?bbox=${encodeURIComponent(bbox)}`, {}, 12000, signal)
    if (res.ok) {
      const j = await res.json()
      if (Array.isArray(j?.elements)) { onStep?.(`API สำเร็จ · ${j.elements.length} รายการ`); return j.elements }
      onStep?.('API ตอบรูปแบบไม่ถูกต้อง')
    } else onStep?.(`API ตอบ ${res.status}`)
  } catch (e) {
    if (signal.aborted) throw e
    onStep?.('API ต่อไม่ได้/หมดเวลา')
  }
  const body = `data=${encodeURIComponent(railQuery(bbox))}`
  for (const ep of MIRRORS) {
    const host = ep.replace(/^https:\/\//, '').split('/')[0]
    try {
      onStep?.(`ตรง: ${host}…`)
      const res = await timedFetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }, 10000, signal)
      if (!res.ok) { onStep?.(`${host} ตอบ ${res.status}`); continue }
      const j = await res.json()
      if (Array.isArray(j?.elements)) { onStep?.(`${host} สำเร็จ · ${j.elements.length} รายการ`); return j.elements }
      onStep?.(`${host} ตอบรูปแบบไม่ถูกต้อง`)
    } catch (e) {
      if (signal.aborted) throw e
      onStep?.(`${host} ต่อไม่ได้/หมดเวลา`)
    }
  }
  return null
}
