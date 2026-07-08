// Resolving map coordinates for places (hybrid: A map_url → B manual → C geocode).
// A) parse lat/lng straight out of a stored map link
// C) geocode by name + city via Nominatim (OSM, free, no key), cached per query

export interface LatLng { lat: number; lng: number }

const valid = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180

/** A) Pull coordinates out of a Google / Apple / geo: map URL if present. */
export function latLngFromUrl(url?: string | null): LatLng | null {
  if (!url) return null
  const tryPair = (a?: string, b?: string) => {
    const lat = Number(a), lng = Number(b)
    return a != null && b != null && valid(lat, lng) ? { lat, lng } : null
  }
  // Google "@lat,lng,zoom"
  let m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) { const r = tryPair(m[1], m[2]); if (r) return r }
  // "!3dLAT!4dLNG" (embedded), or "ll=", "q=lat,lng", "query=lat,lng", "destination=lat,lng"
  m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (m) { const r = tryPair(m[1], m[2]); if (r) return r }
  try {
    const u = new URL(url)
    for (const key of ['ll', 'q', 'query', 'destination', 'center', 'sll', 'daddr']) {
      const v = u.searchParams.get(key)
      if (v) { const p = v.split(','); const r = tryPair(p[0]?.trim(), p[1]?.trim()); if (r) return r }
    }
  } catch { /* not a URL */ }
  // bare "lat,lng" anywhere
  m = url.match(/(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/)
  if (m) { const r = tryPair(m[1], m[2]); if (r) return r }
  return null
}

// A2) Short Google links (maps.app.goo.gl / goo.gl/maps) carry no coordinates and
// can't be followed from the browser (CORS). Ask our serverless endpoint to
// follow the redirect and pull @lat,lng out of the final URL. Cached per link.
const linkCache = new Map<string, LatLng | null>()
export function isMapLink(url?: string | null): boolean {
  return !!url && /(goo\.gl\/maps|maps\.app\.goo\.gl|google\.[a-z.]+\/maps|g\.co\/kgs)/i.test(url)
}
export async function resolveMapUrl(url: string): Promise<LatLng | null> {
  if (linkCache.has(url)) return linkCache.get(url) ?? null
  const ls = lsGet(`url:${url}`)
  if (ls !== undefined) { linkCache.set(url, ls); return ls }
  let out: LatLng | null = null
  try {
    const res = await fetch(`/api/resolve-map?url=${encodeURIComponent(url)}`)
    if (res.ok) {
      const j = await res.json()
      if (valid(Number(j.lat), Number(j.lng))) out = { lat: Number(j.lat), lng: Number(j.lng) }
    }
  } catch { /* offline / endpoint missing */ }
  linkCache.set(url, out); lsSet(`url:${url}`, out)
  return out
}

// C) Nominatim geocoding — rate-limited (1 req/sec), so we serialize and cache.
const geoCache = new Map<string, LatLng | null>()
let chain: Promise<unknown> = Promise.resolve()

function lsGet(key: string): LatLng | null | undefined {
  try { const raw = localStorage.getItem(`geo:${key}`); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return undefined
}
function lsSet(key: string, v: LatLng | null) { try { localStorage.setItem(`geo:${key}`, JSON.stringify(v)) } catch { /* ignore */ } }

async function geocodeRaw(query: string): Promise<LatLng | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`, {
      headers: { 'Accept-Language': 'en' },
    })
    if (!res.ok) return null
    const arr = await res.json()
    const hit = Array.isArray(arr) ? arr[0] : null
    if (!hit) return null
    const lat = Number(hit.lat), lng = Number(hit.lon)
    return valid(lat, lng) ? { lat, lng } : null
  } catch { return null }
}

/** C) Geocode "name, city, country" — cached (memory + localStorage) and
 *  throttled to respect Nominatim's 1 req/sec policy. */
export function geocode(parts: (string | null | undefined)[]): Promise<LatLng | null> {
  const query = parts.map((p) => (p ?? '').trim()).filter(Boolean).join(', ')
  if (!query) return Promise.resolve(null)
  if (geoCache.has(query)) return Promise.resolve(geoCache.get(query) ?? null)
  const cached = lsGet(query)
  if (cached !== undefined) { geoCache.set(query, cached); return Promise.resolve(cached) }
  const run = chain.then(async () => {
    if (geoCache.has(query)) return geoCache.get(query) ?? null
    const r = await geocodeRaw(query)
    geoCache.set(query, r); lsSet(query, r)
    await new Promise((res) => setTimeout(res, 1100)) // be polite to Nominatim
    return r
  })
  chain = run.catch(() => {})
  return run
}
