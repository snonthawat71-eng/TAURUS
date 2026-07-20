// Vercel serverless function: /api/resolve-map?url=<map link>
// Resolves a short map link (maps.app.goo.gl / surl.amap.com / …) to the
// place's coordinates + name. Redirects are followed HOP BY HOP (redirect:
// 'manual'): the Location header of the first hop already carries the full
// URL with "!3dLAT!4dLNG", so coords come from redirect URLs alone — no need
// to download Google's page (datacenter IPs often get blocked/challenged
// there). Page bodies are only fetched as a last resort.
//
// Google's response for the SAME link is not deterministic in production —
// a request that gets blocked/challenged now can succeed moments later, and
// links carrying a share-tracking param (?g_st=ic and similar) correlate
// strongly with the blocked response. So a failed first attempt is retried:
// once with the tracking query string stripped, once more as a plain retry.
// Whichever attempt first turns up a URL-derived coordinate wins.

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
  // AMap — lng,lat order + GCJ-02 (convert to WGS-84).
  if (/amap|gaode/i.test(s)) {
    const amapPats = [
      /[?&](?:position|location|ll|point|center)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/i,
      /[?&]lng=(-?\d+\.\d+)&lat=(-?\d+\.\d+)/i,
      /["'](?:position|location|center|lnglat)["']?\s*[:=]\s*["'\[]\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/i,
      /["']lng["']\s*:\s*(-?\d+\.\d+)\s*,\s*["']lat["']\s*:\s*(-?\d+\.\d+)/i,
    ]
    for (const re of amapPats) { const m = s.match(re); if (m) { const r = ok(+m[2], +m[1]); if (r) return gcj2wgs(r.lat, r.lng) } }
    const m2 = s.match(/["']lat["']\s*:\s*(-?\d+\.\d+)\s*,\s*["']lng["']\s*:\s*(-?\d+\.\d+)/i)
    if (m2) { const r = ok(+m2[1], +m2[2]); if (r) return gcj2wgs(r.lat, r.lng) }
  }
  // "!3dLAT!4dLNG" is the PLACE's own point — check it before "@lat,lng",
  // which is only the viewport centre at share time (can be far off the pin)
  let m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/); if (m) { const r = ok(+m[1], +m[2]); if (r) return r }
  m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/); if (m) { const r = ok(+m[1], +m[2]); if (r) return r }
  m = s.match(/[?&](?:q|query|ll|center|destination|daddr)=(-?\d+\.\d+),(-?\d+\.\d+)/); if (m) { const r = ok(+m[1], +m[2]); if (r) return r }
  m = s.match(/\/(-?\d{1,2}\.\d{4,}),(-?\d{1,3}\.\d{4,})/); if (m) { const r = ok(+m[1], +m[2]); if (r) return r }
  return null
}

// Last-resort scan for a China-plausible coordinate pair anywhere in the text.
function scanChina(s) {
  if (!s) return null
  const re = /(\d{1,3}\.\d{4,})\s*[,%\s]{1,3}\s*(\d{1,3}\.\d{4,})/g
  let m
  while ((m = re.exec(s))) {
    const a = +m[1], b = +m[2]
    if (a >= 73 && a <= 135.5 && b >= 3 && b <= 54) return gcj2wgs(b, a)
    if (a >= 3 && a <= 54 && b >= 73 && b <= 135.5) return gcj2wgs(a, b)
  }
  return null
}

function deepDecode(s) {
  let out = s
  for (let i = 0; i < 3; i++) {
    try { const d = decodeURIComponent(out); if (d === out) break; out = d } catch { break }
  }
  return out
}

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

// Desktop UA: mobile UAs get an app-open interstitial from maps.app.goo.gl
// instead of a clean redirect; desktop gets the 302 (or a simpler page).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/** Modern short links often answer 200 with an HTML/JS interstitial instead of
 *  a 302 — the real target URL is embedded in the page (escaped JSON, a meta
 *  refresh, or a ?link=/url= param). Dig it out. */
function urlFromInterstitial(body) {
  if (!body) return null
  const un = body.replace(/\\\//g, '/').replace(/\\u003d/gi, '=').replace(/\\u0026/gi, '&').replace(/&amp;/g, '&')
  let m = un.match(/http-equiv=["']refresh["'][^>]*url=([^"'>]+)/i)
  if (m) return m[1]
  m = un.match(/https:\/\/www\.google\.[a-z.]+\/maps\/[^"'<>\s\\]+/i)
  if (m) return m[0]
  m = un.match(/[?&](?:link|url|continue)=(https?[^"'&<>\s]+)/i)
  if (m) { try { return decodeURIComponent(m[1]) } catch { return m[1] } }
  return null
}

/** Follow redirects one hop at a time, collecting every hop URL. Stops early
 *  once the total time budget is spent (the function must fit ~10s). */
async function walk(url, lang, budgetMs = 8000) {
  const hops = [url]
  let body = '', status = 0
  let current = url
  const t0 = Date.now()
  for (let i = 0; i < 6; i++) {
    if (Date.now() - t0 > budgetMs) break
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3500)
    try {
      const r = await fetch(current, {
        redirect: 'manual', signal: ctrl.signal,
        headers: { 'User-Agent': UA, 'Accept-Language': lang, Accept: 'text/html', Cookie: 'CONSENT=YES+cb.20240101-00-p0.en+FX; SOCS=CAISHAgB' },
      })
      status = r.status
      const loc = r.headers.get('location')
      if (loc && status >= 300 && status < 400) {
        try { current = new URL(loc, current).toString() } catch { break }
        hops.push(current)
        continue
      }
      body = await r.text().catch(() => '')
      break
    } catch { break } finally { clearTimeout(timer) }
  }
  return { hops, body, status, finalUrl: current }
}

/** Walk one URL and look for a coordinate — ONLY ever from a URL (a hop's
 *  Location header, a consent interstitial's ?continue=, or a target URL
 *  embedded in a 200 interstitial page), never from scraping a rendered page
 *  body. A blocked/challenged Google page can embed the REQUESTING SERVER's
 *  own approximate location instead of the place's — that poisoned pins with
 *  a data-centre address on the other side of the world. If no hop ever
 *  carries real coordinates, this returns no coordinates at all (the client
 *  falls back to name geocoding, which stays in the right country even when
 *  it picks the wrong branch). */
async function resolveOnce(url, lang, amap, budgetMs) {
  const { hops, body, status, finalUrl } = await walk(url, lang, budgetMs)
  let coords = null, src = null
  for (const h of hops) {
    coords = extract(h) || extract(deepDecode(h)) || (amap ? scanChina(deepDecode(h)) : null)
    if (coords) { src = 'url'; break }
    try {
      const cont = new URL(h).searchParams.get('continue')
      if (cont) { coords = extract(deepDecode(cont)); if (coords) { src = 'url'; break } }
    } catch { /* not a URL */ }
  }
  // 200-interstitial pages embed the target URL in the body — dig it out
  let interUrl = null
  if (!coords && body) {
    interUrl = urlFromInterstitial(body)
    if (interUrl) {
      coords = extract(interUrl) || extract(deepDecode(interUrl)) || (amap ? scanChina(deepDecode(interUrl)) : null)
      if (coords) src = 'url' // literal coords inside an embedded URL
    }
  }
  let name = null
  for (const h of [...hops, ...(interUrl ? [interUrl] : [])]) { name = (amap ? amapName(h) : null) || nameFrom(deepDecode(h)); if (name) break }
  if (!name) name = (amap ? amapName(body) : null) || nameFromBody(body)
  return { coords, src, name, hops, body, status, finalUrl, interUrl }
}

export default async function handler(req, res) {
  try {
    const url = req.query?.url
    if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'bad url' })
    const amap = /amap|gaode/i.test(url)
    const lang = amap ? 'zh-CN,zh;q=0.9' : 'en;q=0.9,th;q=0.8'

    // build the variants to try, in order: the link as given, the same link
    // with its query string (tracking params like ?g_st=ic) stripped, then
    // one more plain retry of the original — covers both the specific
    // tracking-param correlation and plain non-determinism
    const variants = [url]
    try {
      const stripped = new URL(url)
      if (stripped.search) { stripped.search = ''; variants.push(stripped.toString()) }
    } catch { /* already validated above */ }
    variants.push(url)

    const deadline = Date.now() + 8500
    let result = null
    for (const v of variants) {
      const remaining = deadline - Date.now()
      if (remaining < 800) break
      result = await resolveOnce(v, lang, amap, Math.min(remaining, 3200))
      if (result.coords) break
    }
    const { hops, body, status, finalUrl, interUrl, coords, src, name } = result

    if (req.query?.debug) {
      return res.json({ hops, interUrl, status, len: body.length, coords: coords || null, src, name, snippet: body.slice(0, 600) })
    }
    // edge-cache ONLY trustworthy url-borne successes; page-derived points
    // must stay re-checkable and failures must never be pinned for a week
    res.setHeader('Cache-Control', coords && src === 'url' ? 's-maxage=604800' : 'no-store')
    return res.json({
      ...(coords || {}), ...(coords ? { src } : {}), ...(name ? { name } : {}),
      // on failure return WHY, so the app's audit can show the reason per link
      ...(coords ? {} : { error: 'no coords', status, finalUrl, hops: hops.length }),
    })
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) })
  }
}
