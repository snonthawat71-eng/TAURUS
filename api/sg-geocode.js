// Vercel serverless function: /api/sg-geocode?q=<address>
// Geocodes a Singapore address via OneMap — the Singapore Land Authority's
// official, free geocoder. Building/postal-code accurate where OSM is vague, so
// a ?g_st=ic Google link (address but no coordinate) can still land on the
// right block. Called server-side to sidestep CORS and validate the response.
//
// Upstream: https://www.onemap.gov.sg/api/common/elastic/search
//   ?searchVal=<q>&returnGeom=Y&getAddrDetails=Y
// The search endpoint is public; if OneMap later requires auth, set ONEMAP_TOKEN
// and it's sent as a Bearer header. Response shape (defensively parsed):
//   { found: N, results: [ { LATITUDE: "1.28", LONGITUDE: "103.85", ... } ] }

// Singapore bounding box — reject anything outside it (client falls back to OSM).
const SG = { latMin: 1.15, latMax: 1.48, lngMin: 103.55, lngMax: 104.15 }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export default async function handler(req, res) {
  const q = req.query?.q
  if (!q || typeof q !== 'string' || !q.trim()) return res.status(400).json({ error: 'bad q' })
  const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(q.trim())}&returnGeom=Y&getAddrDetails=Y&pageNum=1`
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 6000)
    const headers = { Accept: 'application/json', 'User-Agent': UA }
    const token = process.env.ONEMAP_TOKEN
    if (token) headers.Authorization = `Bearer ${token}`
    let j = null, status = 0, raw = ''
    try {
      const r = await fetch(url, { headers, signal: ctrl.signal })
      status = r.status
      raw = await r.text().catch(() => '')
      if (r.ok) { try { j = JSON.parse(raw) } catch { /* not json */ } }
    } finally { clearTimeout(timer) }

    // ?raw=1 → dump exactly what OneMap returned, so a format mismatch is visible
    if (req.query?.raw) {
      res.setHeader('Cache-Control', 'no-store')
      return res.json({ tried: url, status, len: raw.length, snippet: raw.slice(0, 800) })
    }

    const first = Array.isArray(j?.results) ? j.results[0] : null
    const lat = Number(first?.LATITUDE), lng = Number(first?.LONGITUDE)
    const inSG = Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= SG.latMin && lat <= SG.latMax && lng >= SG.lngMin && lng <= SG.lngMax

    if (!inSG) {
      res.setHeader('Cache-Control', 'no-store')
      return res.json({ error: 'no match', status })
    }
    res.setHeader('Cache-Control', 's-maxage=604800')
    return res.json({ lat, lng })
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    const cause = e && e.cause ? (e.cause.code || e.cause.message || String(e.cause)) : ''
    return res.status(200).json({ error: String((e && e.message) || e), cause: String(cause), tried: url })
  }
}
