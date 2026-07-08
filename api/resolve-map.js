// Vercel serverless function: /api/resolve-map?url=<map link>
// Follows a Google short link (maps.app.goo.gl / goo.gl/maps) server-side —
// where CORS doesn't apply — and pulls the "@lat,lng" out of the final URL or
// page so places pinned only with a short link can still show on the map.

// GCJ-02 (China, used by AMap) → WGS-84; no-op outside China.
const GCJ_A = 6378245.0, GCJ_EE = 0.00669342162296594323
const outOfChina = (lat, lng) => lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
function tLat(x, y) { let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x)); r += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3; r += ((20 * Math.sin(y * Math.PI) + 40 * Math.sin((y / 3) * Math.PI)) * 2) / 3; r += ((160 * Math.sin((y / 12) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30)) * 2) / 3; return r }
function tLng(x, y) { let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x)); r += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3; r += ((20 * Math.sin(x * Math.PI) + 40 * Math.sin((x / 3) * Math.PI)) * 2) / 3; r += ((150 * Math.sin((x / 12) * Math.PI) + 300 * Math.sin((x / 30) * Math.PI)) * 2) / 3; return r }
function gcj2wgs(lat, lng) {
  if (outOfChina(lat, lng)) return { lat, lng }
  let dLat = tLat(lng - 105, lat - 35), dLng = tLng(lng - 105, lat - 35)
  const radLat = (lat / 180) * Math.PI
  let magic = Math.sin(radLat); magic = 1 - GCJ_EE * magic * magic
  const sm = Math.sqrt(magic)
  dLat = (dLat * 180) / (((GCJ_A * (1 - GCJ_EE)) / (magic * sm)) * Math.PI)
  dLng = (dLng * 180) / ((GCJ_A / sm) * Math.cos(radLat) * Math.PI)
  return { lat: lat - dLat, lng: lng - dLng }
}

function extract(s) {
  if (!s) return null
  const ok = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lng: b } : null)
  // AMap first — lng,lat order + GCJ-02 (convert to WGS-84)
  if (/amap|gaode|ditu\.amap|uri\.amap/i.test(s)) {
    let m = s.match(/[?&](?:position|location|ll|point|center)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/i) || s.match(/[?&]lng=(-?\d+\.\d+)&lat=(-?\d+\.\d+)/i)
    if (m) { const r = ok(+m[2], +m[1]); if (r) return gcj2wgs(r.lat, r.lng) } // note: lng,lat → swap
  }
  let m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/); if (m) { const r = ok(+m[1], +m[2]); if (r) return r }
  m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/); if (m) { const r = ok(+m[1], +m[2]); if (r) return r }
  m = s.match(/[?&](?:q|query|ll|center|destination|daddr)=(-?\d+\.\d+),(-?\d+\.\d+)/); if (m) { const r = ok(+m[1], +m[2]); if (r) return r }
  // Google embeds the point as "/data=...!3dLAT!4dLNG" or a bare "/lat,lng"
  m = s.match(/\/(-?\d{1,2}\.\d{4,}),(-?\d{1,3}\.\d{4,})/); if (m) { const r = ok(+m[1], +m[2]); if (r) return r }
  return null
}

export default async function handler(req, res) {
  try {
    const url = req.query?.url
    if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'bad url' })
    let finalUrl = url, body = ''
    try {
      const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TaurusMap/1.0)' } })
      finalUrl = r.url || url
      body = await r.text().catch(() => '')
    } catch { /* fall through to whatever we have */ }
    const coords = extract(finalUrl) || extract(body)
    res.setHeader('Cache-Control', 's-maxage=604800') // cache a week at the edge
    return res.json(coords || {})
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) })
  }
}
