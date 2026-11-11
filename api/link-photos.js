// Vercel serverless function: /api/link-photos?url=<any link>
//
// Reads the preview images a page publishes about itself — og:image,
// twitter:image, <link rel="image_src">, JSON-LD "image" — so the Explore
// editor can offer "ดึงรูปจากลิงก์" next to the map-link field. Those tags
// exist precisely so other sites can show the picture, which is why we read
// them and nothing else: no crawling a photo gallery, no lifting images a
// page never offered for sharing.
//
// Same hop-by-hop redirect walk as resolve-map, for the same reason — a
// shortened link (maps.app.goo.gl, bit.ly, instagr.am) has to be followed
// before there is a page to read. Google often answers a datacenter IP with a
// consent wall or a challenge instead of the place page, so a Google Maps
// link legitimately returns nothing fairly often; the client says so and the
// user picks a photo from their device as before.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/** Follow redirects one hop at a time and return the final page body. */
async function walk(url, budgetMs = 7000) {
  let body = '', status = 0, current = url
  const t0 = Date.now()
  for (let i = 0; i < 6; i++) {
    if (Date.now() - t0 > budgetMs) break
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3500)
    try {
      const r = await fetch(current, {
        redirect: 'manual', signal: ctrl.signal,
        headers: { 'User-Agent': UA, 'Accept-Language': 'en;q=0.9,th;q=0.8', Accept: 'text/html', Cookie: 'CONSENT=YES+cb.20240101-00-p0.en+FX; SOCS=CAISHAgB' },
      })
      status = r.status
      const loc = r.headers.get('location')
      if (loc && status >= 300 && status < 400) {
        try { current = new URL(loc, current).toString() } catch { break }
        continue
      }
      body = await r.text().catch(() => '')
      break
    } catch { break } finally { clearTimeout(timer) }
  }
  return { body, status, finalUrl: current }
}

const decode = (s) => s
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
  .replace(/\\u0026/gi, '&').replace(/\\u003d/gi, '=').replace(/\\\//g, '/')

// A page's declared preview images, best first. Each pattern is written both
// ways round because the order of `property` and `content` is not fixed.
const META = [
  /<meta[^>]+property=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/gi,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url|:url)?["']/gi,
  /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/gi,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/gi,
  /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/gi,
  /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/gi,
  /"image"\s*:\s*"([^"]+)"/gi,                 // JSON-LD, single
]

// JSON-LD often lists a gallery — "image": ["…a.jpg", "…b.jpg"] — so pull
// every entry out of the array, not just the first.
const LD_ARRAY = /"image"\s*:\s*\[([^\]]{0,2000})\]/gi

// A Google Maps place page declares a MAP of the place as its preview image —
// a static map tile or a Street View frame — which is useless as a place photo
// and is what this filter is mainly here for. Same for the sprites, spacers,
// tracking pixels and logos every page carries.
const MAPPY = /(staticmap|streetview|\/maps\/vt|mapbox|tile\.openstreetmap|cbk\d*\.google|maps\.googleapis\.com)/i
// gstatic is Google's own asset host — map tiles, the "G" a consent wall
// shows, UI chrome. Never a photo of a place.
const GOOGLE_CHROME = /(gstatic\.com|googlelogo|googleg_)/i

function usable(u) {
  if (!/^https?:\/\//i.test(u)) return false
  if (/\.svg(\?|$)/i.test(u)) return false
  if (MAPPY.test(u) || GOOGLE_CHROME.test(u)) return false
  if (/(sprite|spacer|pixel|blank|1x1|favicon|logo_|_logo|placeholder|avatar_default)/i.test(u)) return false
  return true
}

// The place's OWN photos on a Google Maps page. Google serves them from its
// photo CDN under a stable id, so the id is what we match; the "=w203-h152"
// suffix on the copy embedded in the page is a thumbnail, so it is replaced
// with a size worth showing on a card.
const G_PHOTO = /https:\/\/(?:lh\d+\.googleusercontent\.com\/p|gps-cs-s\.googleusercontent\.com|gps-proxy\.googleusercontent\.com|streetviewpixels-pa\.googleapis\.com\/v1\/thumbnail)\/[A-Za-z0-9_\-]{20,}/g

function googlePhotos(body) {
  const out = []
  const seen = new Set()
  for (const m of body.matchAll(G_PHOTO)) {
    const base = m[0]
    if (/streetviewpixels/i.test(base)) continue // a Street View frame, not a photo of the place
    if (seen.has(base)) continue
    seen.add(base)
    out.push(`${base}=w1000-h800-k-no`)
    if (out.length >= 8) break
  }
  return out
}

function imagesFrom(body, baseUrl) {
  const out = []
  const seen = new Set()
  const add = (raw) => {
    if (!raw || out.length >= 8) return
    let u = decode(raw.trim())
    try { u = new URL(u, baseUrl).toString() } catch { return }
    if (!usable(u)) return
    const k = u.split('#')[0]
    if (seen.has(k)) return
    seen.add(k)
    out.push(u)
  }
  // a Google Maps page's own photos first — its declared preview is a map
  if (/google\.[a-z.]+\/maps|googleusercontent\.com\/p\//i.test(body.slice(0, 200000)) || /google\./i.test(baseUrl)) {
    for (const u of googlePhotos(body)) add(u)
  }
  for (const re of META) { let m; re.lastIndex = 0; while ((m = re.exec(body))) add(m[1]) }
  LD_ARRAY.lastIndex = 0
  let arr
  while ((arr = LD_ARRAY.exec(body))) for (const m of arr[1].matchAll(/"([^"]+)"/g)) add(m[1])
  return out
}

export default async function handler(req, res) {
  try {
    const url = req.query?.url
    if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'bad url' })

    const { body, status, finalUrl } = await walk(url)
    const photos = body ? imagesFrom(body, finalUrl) : []

    // cache briefly: the editor re-asks whenever the field is re-focused
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600')
    return res.status(200).json({ photos, status, finalUrl })
  } catch (e) {
    return res.status(200).json({ photos: [], error: String(e?.message ?? e) })
  }
}
