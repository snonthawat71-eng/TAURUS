// Resolving map coordinates for places (hybrid: A map_url → B manual → C geocode).
// A) parse lat/lng straight out of a stored map link
// C) geocode by name + city via Nominatim (OSM, free, no key), cached per query

export interface LatLng { lat: number; lng: number }

const valid = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180

// --- GCJ-02 (China) → WGS-84. AMap/Gaode links use GCJ-02, which is offset ~500m
// from the WGS-84 that OSM/Leaflet use. The conversion self-guards outside China. ---
const GCJ_A = 6378245.0, GCJ_EE = 0.00669342162296594323
const outOfChina = (lat: number, lng: number) => lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
function tLat(x: number, y: number) {
  let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  r += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3
  r += ((20 * Math.sin(y * Math.PI) + 40 * Math.sin((y / 3) * Math.PI)) * 2) / 3
  r += ((160 * Math.sin((y / 12) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30)) * 2) / 3
  return r
}
function tLng(x: number, y: number) {
  let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  r += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3
  r += ((20 * Math.sin(x * Math.PI) + 40 * Math.sin((x / 3) * Math.PI)) * 2) / 3
  r += ((150 * Math.sin((x / 12) * Math.PI) + 300 * Math.sin((x / 30) * Math.PI)) * 2) / 3
  return r
}
export function gcj02ToWgs84(lat: number, lng: number): LatLng {
  if (outOfChina(lat, lng)) return { lat, lng }
  let dLat = tLat(lng - 105, lat - 35), dLng = tLng(lng - 105, lat - 35)
  const radLat = (lat / 180) * Math.PI
  let magic = Math.sin(radLat); magic = 1 - GCJ_EE * magic * magic
  const sm = Math.sqrt(magic)
  dLat = (dLat * 180) / (((GCJ_A * (1 - GCJ_EE)) / (magic * sm)) * Math.PI)
  dLng = (dLng * 180) / ((GCJ_A / sm) * Math.cos(radLat) * Math.PI)
  return { lat: lat - dLat, lng: lng - dLng }
}

export const isAmap = (url?: string | null) => !!url && /amap\.com|gaode|ditu\.amap|uri\.amap|surl\.amap/i.test(url)

/** AMap share links URL-encode their params 2–3 levels deep — peel until stable. */
function deepDecode(s: string): string {
  let out = s
  for (let i = 0; i < 3; i++) {
    try { const d = decodeURIComponent(out); if (d === out) break; out = d } catch { break }
  }
  return out
}

/** AMap uses `lng,lat` order (in position=/location=) and GCJ-02 coords.
 *  Share targets instead carry "p=<poiid>,<lat>,<lng>,<name>,<address>". */
export function amapLatLng(url?: string | null): LatLng | null {
  if (!url) return null
  const grab = (re: RegExp) => { const m = url.match(re); return m ? { lng: Number(m[1]), lat: Number(m[2]) } : null }
  const p = grab(/[?&](?:position|location|ll|point|center)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/i)
    || grab(/[?&]lng=(-?\d+\.\d+)&lat=(-?\d+\.\d+)/i)
  if (p && valid(p.lat, p.lng)) return gcj02ToWgs84(p.lat, p.lng)
  const mp = deepDecode(url).match(/[?&]p=[A-Za-z0-9]{4,},\s*(-?\d+\.\d+),\s*(-?\d+\.\d+)/)
  if (mp) {
    const a = Number(mp[1]), b = Number(mp[2])
    // p= is lat,lng — but disambiguate by China's disjoint ranges just in case
    if (a >= 3 && a <= 54 && b >= 73 && b <= 135.5) return gcj02ToWgs84(a, b)
    if (b >= 3 && b <= 54 && a >= 73 && a <= 135.5) return gcj02ToWgs84(b, a)
    if (valid(a, b)) return gcj02ToWgs84(a, b)
  }
  return null
}

/** Place NAME from an AMap share target — "p=<poiid>,<lat>,<lng>,<name>,<addr>"
 *  (wb.amap.com, or nested inside m.amap.com/callAPP params). */
export function amapNameFromUrl(url?: string | null): string | null {
  if (!url || !isAmap(url)) return null
  const d = deepDecode(url)
  const m = d.match(/[?&]p=[A-Za-z0-9]{4,},\s*-?\d+\.\d+,\s*-?\d+\.\d+,([^,]+)/)
    || d.match(/[?&]q=-?\d+\.\d+,\s*-?\d+\.\d+,([^,]+)/i)
  if (!m) return null
  const n = m[1].replace(/\+/g, ' ')
    .replace(/&(?:apos|#0?39);/gi, "'").replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ').trim()
  return n || null
}

/** A) Pull coordinates out of a Google / Apple / AMap / geo: map URL if present. */
export function latLngFromUrl(url?: string | null): LatLng | null {
  if (!url) return null
  if (isAmap(url)) { const r = amapLatLng(url); if (r) return r }
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
  return !!url && /(goo\.gl\/maps|maps\.app\.goo\.gl|share\.google|google\.[a-z.]+\/maps|g\.co\/kgs|amap\.com|gaode|surl\.amap|uri\.amap|ditu\.amap)/i.test(url)
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

/** The `q=` of a shared place is often a full address — "LGF, Vission Bakery,
 *  7 Staunton St, Central, ฮ่องกง". Pick the segment that looks like the NAME:
 *  the one right before the street address, skipping floor/unit tokens. */
export function pickNameFromQuery(q: string): string | null {
  const parts = q.split(',').map((s) => s.trim()).filter(Boolean)
  if (!parts.length) return null
  if (parts.length === 1) return parts[0]
  const isStreet = (s: string) => /^\d+[\w\-/]*\s+\S/.test(s) || /\b(road|rd\.?|street|st\.?|ave\.?|avenue|lane|ln\.?|alley|soi|ถนน|ซอย)\b/i.test(s)
  const isUnit = (s: string) => /^(lgf|ugf|gf|g\/f|b\d|lg\d*|\d{1,2}\/?f|shop\b|unit\b|room\b|floor\b|ชั้น|no\.?\s?\d)/i.test(s)
  const iStreet = parts.findIndex(isStreet)
  if (iStreet > 0) {
    for (let i = iStreet - 1; i >= 0; i--) if (!isUnit(parts[i])) return parts[i]
  }
  return parts.find((s) => !isUnit(s) && !isStreet(s)) ?? parts[0]
}

/** Pull the place NAME out of a full map URL (AMap p=, /maps/place/<name>/ or ?q=). */
export function nameFromMapUrl(url?: string | null): string | null {
  if (!url) return null
  const am = amapNameFromUrl(url)
  if (am) return am
  const m = url.match(/\/maps\/place\/([^/@?#]+)/)
  if (m) {
    try {
      const s = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim()
      if (s && !/^-?\d+(\.\d+)?\s*,/.test(s)) return s
    } catch { /* bad escape */ }
  }
  try {
    const u = new URL(url)
    const q = u.searchParams.get('q') || u.searchParams.get('query')
    if (q && !/^-?\d+(\.\d+)?\s*,/.test(q) && !/^https?:/i.test(q)) return pickNameFromQuery(q.trim())
  } catch { /* not a URL */ }
  return null
}

/** Name for a SHORT map link — our serverless endpoint follows the redirect and
 *  returns the name found in the final URL. Quiet null on failure. */
const nameCache = new Map<string, string | null>()
export async function resolveMapName(url: string): Promise<string | null> {
  const direct = nameFromMapUrl(url)
  if (direct) return direct
  if (!isMapLink(url)) return null
  if (nameCache.has(url)) return nameCache.get(url) ?? null
  let out: string | null = null
  try {
    const res = await fetch(`/api/resolve-map?url=${encodeURIComponent(url)}`)
    if (res.ok) {
      const j = await res.json()
      if (typeof j.name === 'string' && j.name.trim()) out = j.name.trim()
    }
  } catch { /* offline / endpoint missing */ }
  nameCache.set(url, out)
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Strip the decorations that break geocoders: parentheticals, emoji, branch
 *  suffixes ("สาขา…", "Branch …"), leftover punctuation runs. */
export function cleanPlaceName(name: string): string {
  return name
    .replace(/\([^)]*\)|（[^）]*）/g, ' ')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, ' ')
    .replace(/\b(?:สาขา|branch)\b[\s\S]*$/i, ' ')
    .replace(/[|·•~*]+/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

// Photon (komoot) — free OSM geocoder, fuzzy/typo-tolerant where Nominatim
// wants near-exact matches. No key, CORS-open.
async function photonRaw(query: string): Promise<LatLng | null> {
  try {
    const res = await fetch(`https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(query)}`)
    if (!res.ok) return null
    const j = await res.json()
    const c = j?.features?.[0]?.geometry?.coordinates
    const lng = Number(c?.[0]), lat = Number(c?.[1])
    return valid(lat, lng) ? { lat, lng } : null
  } catch { return null }
}

export interface GeoHit extends LatLng { approx?: boolean }

/** C+) Multi-step geocode for a place. Tries, in order:
 *  1. Nominatim — full name + city + country, then the cleaned name
 *  2. Photon    — fuzzy match on name + city (handles typos/decorations)
 *  3. the transit STATION as a stand-in → returned with approx: true
 *  Cached (memory + localStorage) under one key per place. */
const smartCache = new Map<string, GeoHit | null>()
export function geocodeSmart(o: { name?: string | null; station?: string | null; city?: string | null; country?: string | null }): Promise<GeoHit | null> {
  const name = (o.name ?? '').trim(), station = (o.station ?? '').trim()
  const city = (o.city ?? '').trim(), country = (o.country ?? '').trim()
  if (!name && !station) return Promise.resolve(null)
  const key = `smart:${[name, station, city, country].join('|')}`
  if (smartCache.has(key)) return Promise.resolve(smartCache.get(key) ?? null)
  const cached = lsGet(key) as GeoHit | null | undefined
  if (cached !== undefined) { smartCache.set(key, cached); return Promise.resolve(cached) }
  const run = chain.then(async (): Promise<GeoHit | null> => {
    if (smartCache.has(key)) return smartCache.get(key) ?? null
    const cleaned = cleanPlaceName(name)
    const tryNom = async (parts: string[]) => {
      const q = parts.filter(Boolean).join(', ')
      if (!q) return null
      const r = await geocodeRaw(q)
      await sleep(1100) // be polite to Nominatim
      return r
    }
    let hit: GeoHit | null = null
    // 1) Nominatim ladder
    let r = name ? await tryNom([name, city, country]) : null
    if (!r && cleaned && cleaned !== name) r = await tryNom([cleaned, city, country])
    // 2) Photon fuzzy
    if (!r && name) r = await photonRaw([name, city].filter(Boolean).join(' '))
    if (!r && cleaned && cleaned !== name) r = await photonRaw([cleaned, city, country].filter(Boolean).join(' '))
    // 3) station stand-in — approximate, flagged so the UI can say so
    if (r) hit = { ...r, approx: false }
    else if (station) {
      const s = await tryNom([`${station} station`, city, country])
        || await tryNom([station, city, country])
        || await photonRaw([station, city, country].filter(Boolean).join(' '))
      if (s) hit = { ...s, approx: true }
    }
    smartCache.set(key, hit); lsSet(key, hit)
    return hit
  })
  chain = run.catch(() => {})
  return run
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
