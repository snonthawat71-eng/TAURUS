// Vercel serverless function: /api/resolve-map?url=<map link>
// Follows a Google short link (maps.app.goo.gl / goo.gl/maps) server-side —
// where CORS doesn't apply — and pulls the "@lat,lng" out of the final URL or
// page so places pinned only with a short link can still show on the map.

function extract(s) {
  if (!s) return null
  const ok = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lng: b } : null)
  let m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/); if (m) { const r = ok(+m[1], +m[2]); if (r) return r }
  m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/); if (m) { const r = ok(+m[1], +m[2]); if (r) return r }
  m = s.match(/[?&](?:q|query|ll|center|destination|daddr)=(-?\d+\.\d+),(-?\d+\.\d+)/); if (m) { const r = ok(+m[1], +m[2]); if (r) return r }
  // Google embeds the point as "/data=...!3dLAT!4dLNG" or in a "cid"/"ftid" blob
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
