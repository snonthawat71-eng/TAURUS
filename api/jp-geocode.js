// Vercel serverless function: /api/jp-geocode?q=<address>
// Geocodes a Japanese address via the GSI (Geospatial Information Authority of
// Japan) Address Search — the government's official, free, key-less geocoder.
// Far more accurate for Japanese street addresses than OSM, so a ?g_st=ic
// Google link (which gives us an address but no coordinate) can still land on
// the right block. Called server-side to sidestep CORS and to validate the
// response (bounds-check) before the client trusts it.
//
// Upstream: https://msearch.gsi.go.jp/address-search/AddressSearch?q=<q>
// Response shape (GeoJSON FeatureCollection, defensively parsed):
//   [ { geometry: { coordinates: [lng, lat] }, properties: { title } }, ... ]

// Japan bounding box — reject anything outside it, so a bad/empty answer can
// never place a pin in the wrong place (the client falls back to OSM).
const JP = { latMin: 20.0, latMax: 46.5, lngMin: 122.0, lngMax: 154.5 }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export default async function handler(req, res) {
  const q = req.query?.q
  if (!q || typeof q !== 'string' || !q.trim()) return res.status(400).json({ error: 'bad q' })
  const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q.trim())}`
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 6000)
    let j = null, status = 0, raw = ''
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: ctrl.signal })
      status = r.status
      raw = await r.text().catch(() => '')
      if (r.ok) { try { j = JSON.parse(raw) } catch { /* not json */ } }
    } finally { clearTimeout(timer) }

    // ?raw=1 → dump exactly what GSI returned, so a format mismatch is visible
    if (req.query?.raw) {
      res.setHeader('Cache-Control', 'no-store')
      return res.json({ tried: url, status, len: raw.length, snippet: raw.slice(0, 800) })
    }

    // GSI ranks best-first; coordinates are [lng, lat] in WGS84
    const first = Array.isArray(j) ? j[0] : null
    const c = first?.geometry?.coordinates
    const lng = Number(c?.[0]), lat = Number(c?.[1])
    const inJP = Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= JP.latMin && lat <= JP.latMax && lng >= JP.lngMin && lng <= JP.lngMax

    if (!inJP) {
      res.setHeader('Cache-Control', 'no-store')
      return res.json({ error: 'no match', status })
    }
    // official address data is stable — safe to edge-cache a hit for a week
    res.setHeader('Cache-Control', 's-maxage=604800')
    return res.json({ lat, lng })
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    const cause = e && e.cause ? (e.cause.code || e.cause.message || String(e.cause)) : ''
    return res.status(200).json({ error: String((e && e.message) || e), cause: String(cause), tried: url })
  }
}
