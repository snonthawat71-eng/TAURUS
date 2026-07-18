// Vercel serverless function: /api/rail?bbox=S,W,N,E
// Fetches metro/light-rail/monorail/tram route relations (+ station nodes)
// from Overpass server-side — mobile networks often can't reach Overpass
// directly (queues/blocks), and the edge cache makes repeat views instant.
// maxDuration is raised to 60s in vercel.json (hobby-plan maximum).

const MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.osm.jp/api/interpreter', // Asia mirror — close to the data we query
  'https://overpass-api.de/api/interpreter',
]
const MIRROR_TIMEOUT_MS = 12000

export default async function handler(req, res) {
  try {
    const bbox = req.query?.bbox
    if (!/^-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?$/.test(bbox || '')) {
      return res.status(400).json({ error: 'bad bbox' })
    }
    const q = `[out:json][timeout:18];(relation["type"="route"]["route"~"^(subway|light_rail|monorail|tram)$"](${bbox});node["railway"="station"]["station"~"^(subway|light_rail|monorail)$"](${bbox});node["railway"="station"]["subway"="yes"](${bbox}););out geom(${bbox});`
    const detail = [] // per-mirror outcome, returned on failure for diagnosis
    for (const ep of MIRRORS) {
      const host = ep.replace('https://', '').split('/')[0]
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), MIRROR_TIMEOUT_MS)
      try {
        const r = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(q)}`,
          signal: ctrl.signal,
        })
        if (!r.ok) { detail.push(`${host}:${r.status}`); continue }
        const j = await r.json()
        // cache a week at the edge — rail lines don't move
        res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=86400')
        return res.json({ elements: j?.elements ?? [] })
      } catch (e) {
        detail.push(`${host}:${ctrl.signal.aborted ? 'timeout' : String((e && e.message) || e).slice(0, 60)}`)
      } finally { clearTimeout(timer) }
    }
    return res.status(502).json({ error: 'overpass unavailable', detail })
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) })
  }
}
