// Vercel serverless function: /api/hk-geocode?q=<address>
// Geocodes a Hong Kong address via the HK Government's official Address Lookup
// Service (ALS / OGCIO) — the authoritative HK address→coordinate database,
// free and key-less. Far more accurate for HK street addresses than OSM, so
// a ?g_st=ic Google link (which gives us an address but no coordinate) can
// still land on the exact building. Called server-side to avoid any CORS
// question and to validate/normalise the response before the client trusts it.
//
// Response shape (from ALS, defensively parsed):
//   { SuggestedAddress: [ { Address: { PremisesAddress: {
//       GeospatialInformation: { Latitude, Longitude, Northing, Easting } } },
//     ValidationInformation: { Score } } ] }

// Hong Kong bounding box — reject anything outside it, so a bad/empty ALS
// answer can never place a pin in the wrong place (the client falls back to OSM).
const HK = { latMin: 22.1, latMax: 22.6, lngMin: 113.8, lngMax: 114.5 }

// Browser-ish UA + Accept: a few government endpoints refuse the default
// Node/undici client outright.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export default async function handler(req, res) {
  const q = req.query?.q
  if (!q || typeof q !== 'string' || !q.trim()) return res.status(400).json({ error: 'bad q' })
  const url = `https://www.als.ogcio.gov.hk/lookup?q=${encodeURIComponent(q.trim())}&n=1`
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

    // ?raw=1 → dump exactly what ALS returned, so a format mismatch is visible
    if (req.query?.raw) {
      res.setHeader('Cache-Control', 'no-store')
      return res.json({ tried: url, status, len: raw.length, snippet: raw.slice(0, 800) })
    }

    const first = Array.isArray(j?.SuggestedAddress) ? j.SuggestedAddress[0] : null
    const gi = first?.Address?.PremisesAddress?.GeospatialInformation
    const lat = Number(gi?.Latitude), lng = Number(gi?.Longitude)
    const score = Number(first?.ValidationInformation?.Score)
    const inHK = Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= HK.latMin && lat <= HK.latMax && lng >= HK.lngMin && lng <= HK.lngMax

    if (!inHK) {
      res.setHeader('Cache-Control', 'no-store')
      return res.json({ error: 'no match', status })
    }
    // official address data is stable — safe to edge-cache a hit for a week
    res.setHeader('Cache-Control', 's-maxage=604800')
    return res.json({ lat, lng, ...(Number.isFinite(score) ? { score } : {}) })
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    // surface the REAL reason (DNS/TLS/refused live in e.cause, not e.message)
    const cause = e && e.cause ? (e.cause.code || e.cause.message || String(e.cause)) : ''
    return res.status(200).json({ error: String((e && e.message) || e), cause: String(cause), tried: url })
  }
}
