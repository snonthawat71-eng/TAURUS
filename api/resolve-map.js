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
  // AMap — lng,lat order + GCJ-02 (convert to WGS-84). Coords can be in the URL
  // params OR embedded in the page's JS, so try several shapes.
  if (/amap|gaode/i.test(s)) {
    const amapPats = [
      /[?&](?:position|location|ll|point|center)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/i, // url param lng,lat
      /[?&]lng=(-?\d+\.\d+)&lat=(-?\d+\.\d+)/i,                                   // lng,lat params
      /["'](?:position|location|center|lnglat)["']?\s*[:=]\s*["'\[]\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/i, // json lng,lat
      /["']lng["']\s*:\s*(-?\d+\.\d+)\s*,\s*["']lat["']\s*:\s*(-?\d+\.\d+)/i,      // {lng:..,lat:..}
    ]
    for (const re of amapPats) { const m = s.match(re); if (m) { const r = ok(+m[2], +m[1]); if (r) return gcj2wgs(r.lat, r.lng) } }
    // some amap pages carry lat,lng (not lng,lat) as "lat":..,"lng":..
    const m2 = s.match(/["']lat["']\s*:\s*(-?\d+\.\d+)\s*,\s*["']lng["']\s*:\s*(-?\d+\.\d+)/i)
    if (m2) { const r = ok(+m2[1], +m2[2]); if (r) return gcj2wgs(r.lat, r.lng) }
  }
  // "!3dLAT!4dLNG" is the PLACE's own point — check it before "@lat,lng",
  // which is only the viewport centre at share time (can be far off the pin)
  let m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/); if (m) { const r = ok(+m[1], +m[2]); if (r) return r }
  m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/); if (m) { const r = ok(+m[1], +m[2]); if (r) return r }
  m = s.match(/[?&](?:q|query|ll|center|destination|daddr)=(-?\d+\.\d+),(-?\d+\.\d+)/); if (m) { const r = ok(+m[1], +m[2]); if (r) return r }
  // Google embeds the point as "/data=...!3dLAT!4dLNG" or a bare "/lat,lng"
  m = s.match(/\/(-?\d{1,2}\.\d{4,}),(-?\d{1,3}\.\d{4,})/); if (m) { const r = ok(+m[1], +m[2]); if (r) return r }
  return null
}

// Last-resort scan for a China-plausible coordinate pair anywhere in the text.
// lng ∈ [73,135], lat ∈ [3,54] — the disjoint ranges let us fix the order and
// convert GCJ-02 → WGS-84 (AMap data is GCJ-02).
function scanChina(s) {
  if (!s) return null
  const re = /(\d{1,3}\.\d{4,})\s*[,%\s]{1,3}\s*(\d{1,3}\.\d{4,})/g
  let m
  while ((m = re.exec(s))) {
    const a = +m[1], b = +m[2]
    if (a >= 73 && a <= 135.5 && b >= 3 && b <= 54) return gcj2wgs(b, a) // lng,lat
    if (a >= 3 && a <= 54 && b >= 73 && b <= 135.5) return gcj2wgs(a, b) // lat,lng
  }
  return null
}

// AMap share links bury their data in params that are URL-encoded 2–3 levels
// deep (surl.amap.com → wb.amap.com/?p=… → m.amap.com/callAPP?ios=…%2526…).
// Peel the encoding until it stops changing so the p=/q= payloads are readable.
function deepDecode(s) {
  let out = s
  for (let i = 0; i < 3; i++) {
    try { const d = decodeURIComponent(out); if (d === out) break; out = d } catch { break }
  }
  return out
}

// AMap: "p=<poiid>,<lat>,<lng>,<name>,<address>" (wb.amap.com and nested inside
// callAPP's ios=/android= params); fallback "q=<lat>,<lng>,<name>,…".
function amapName(s) {
  if (!s) return null
  const d = deepDecode(s)
  const m = d.match(/[?&]p=[A-Za-z0-9]{4,},\s*-?\d+\.\d+,\s*-?\d+\.\d+,([^,]+)/)
    || d.match(/[?&]q=-?\d+\.\d+,\s*-?\d+\.\d+,([^,]+)/i)
  if (!m) return null
  const n = m[1].replace(/\+/g, ' ')
    .replace(/&(?:apos|#0?39);/gi, "'").replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ').trim()
  return n || null
}

// The q= of a shared place is often a full address — "LGF, Vission Bakery,
// 7 Staunton St, Central, ฮ่องกง". Pick the segment that looks like the NAME:
// the one right before the street address, skipping floor/unit tokens.
function pickNameFromQuery(q) {
  const parts = q.split(',').map((s) => s.trim()).filter(Boolean)
  if (!parts.length) return null
  if (parts.length === 1) return parts[0]
  const isStreet = (s) => /^\d+[\w\-/]*\s+\S/.test(s) || /\b(road|rd\.?|street|st\.?|ave\.?|avenue|lane|ln\.?|alley|soi|ถนน|ซอย)\b/i.test(s)
  const isUnit = (s) => /^(lgf|ugf|gf|g\/f|b\d|lg\d*|\d{1,2}\/?f|shop\b|unit\b|room\b|floor\b|ชั้น|no\.?\s?\d)/i.test(s)
  const iStreet = parts.findIndex(isStreet)
  if (iStreet > 0) {
    for (let i = iStreet - 1; i >= 0; i--) if (!isUnit(parts[i])) return parts[i]
  }
  return parts.find((s) => !isUnit(s) && !isStreet(s)) ?? parts[0]
}

// Place NAME from a resolved Google Maps URL — /maps/place/<name>/ first, then
// the ?q= of a "maps?q=<address>" share target.
function nameFrom(s) {
  if (!s) return null
  const m = s.match(/\/maps\/place\/([^/@?#]+)/)
  if (m) {
    try {
      const n = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim()
      if (n && !/^-?\d+(\.\d+)?\s*,/.test(n)) return n
    } catch { /* bad escape */ }
  }
  try {
    const u = new URL(s)
    const q = u.searchParams.get('q') || u.searchParams.get('query')
    if (q && !/^-?\d+(\.\d+)?\s*,/.test(q) && !/^https?:/i.test(q)) return pickNameFromQuery(q.trim())
  } catch { /* not a URL */ }
  return null
}

// Fallback: og:title / <title> of the final page ("<name> - Google Maps",
// "<name>-高德地图"). Covers links whose final URL carries no /place/ segment.
function nameFromBody(s) {
  if (!s) return null
  const m = s.match(/property=["']og:title["'][^>]*content=["']([^"']{1,120})["']/i)
    || s.match(/content=["']([^"']{1,120})["'][^>]*property=["']og:title["']/i)
    || s.match(/<title[^>]*>([^<]{1,120})<\/title>/i)
  if (!m) return null
  let n = m[1].trim()
    .replace(/\s*[-·|–]\s*Google\s*Maps?$/i, '')
    .replace(/\s*[-|·–]?\s*高德地图\s*$/, '')
    .replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .trim()
  if (!n || /^google maps$/i.test(n) || /^高德/.test(n) || /^-?\d+(\.\d+)?\s*,/.test(n)) return null
  return n
}

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'

export default async function handler(req, res) {
  try {
    const url = req.query?.url
    if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'bad url' })
    const amap = /amap|gaode/i.test(url)
    let finalUrl = url, body = '', status = 0
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 6000) // never hang the function
    try {
      const r = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': UA, 'Accept-Language': amap ? 'zh-CN,zh;q=0.9' : 'en;q=0.9,th;q=0.8', Accept: 'text/html' } })
      finalUrl = r.url || url; status = r.status
      body = await r.text().catch(() => '')
    } catch (e) { body = ''; if (req.query?.debug) return res.json({ error: String(e?.message || e), finalUrl }) }
    finally { clearTimeout(timer) }
    const coords = extract(finalUrl) || extract(body)
      || (amap ? scanChina(deepDecode(finalUrl)) || scanChina(finalUrl) || scanChina(body) : null)
    const name = (amap ? amapName(finalUrl) || amapName(body) : null) || nameFrom(finalUrl) || nameFromBody(body)
    if (req.query?.debug) {
      return res.json({ finalUrl, status, len: body.length, coords: coords || null, name, snippet: body.slice(0, 800) })
    }
    res.setHeader('Cache-Control', 's-maxage=604800') // cache a week at the edge
    return res.json({ ...(coords || {}), ...(name ? { name } : {}) })
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) })
  }
}
