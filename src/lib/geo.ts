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

const tryPair = (a?: string, b?: string) => {
  const lat = Number(a), lng = Number(b)
  return a != null && b != null && valid(lat, lng) ? { lat, lng } : null
}

/** A-exact) Coordinates that mark the PLACE itself (not the map view):
 *  AMap params, Google's "!3dLAT!4dLNG", and explicit lat,lng URL params.
 *  Excludes "@lat,lng" — that is the viewport centre at share time and can
 *  sit hundreds of metres off the actual pin. */
export function latLngFromUrlExact(url?: string | null): LatLng | null {
  if (!url) return null
  if (isAmap(url)) { const r = amapLatLng(url); if (r) return r }
  const m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (m) { const r = tryPair(m[1], m[2]); if (r) return r }
  try {
    const u = new URL(url)
    for (const key of ['ll', 'q', 'query', 'destination', 'sll', 'daddr']) {
      const v = u.searchParams.get(key)
      if (v) { const p = v.split(','); const r = tryPair(p[0]?.trim(), p[1]?.trim()); if (r) return r }
    }
  } catch { /* not a URL */ }
  return null
}

/** A) Pull coordinates out of a Google / Apple / AMap / geo: map URL if present.
 *  Exact place coordinates take priority; the "@lat,lng" viewport centre and a
 *  bare number pair are last-resort fallbacks. */
export function latLngFromUrl(url?: string | null): LatLng | null {
  if (!url) return null
  const exact = latLngFromUrlExact(url)
  if (exact) return exact
  // Google "@lat,lng,zoom" — the view centre, roughly right, not the pin
  let m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) { const r = tryPair(m[1], m[2]); if (r) return r }
  try {
    const u = new URL(url)
    const v = u.searchParams.get('center')
    if (v) { const p = v.split(','); const r = tryPair(p[0]?.trim(), p[1]?.trim()); if (r) return r }
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
// why the last resolution of a link failed — the audit panel shows this so a
// broken link is never a silent mystery again
const failNotes = new Map<string, string>()
export const resolveFailNote = (url?: string | null) => (url ? failNotes.get(url) : undefined)
// Google's canonical place name from the resolved link (available even when
// coords aren't) — the fallback geocode anchor
const linkNames = new Map<string, string>()
export const resolvedLinkName = (url?: string | null) => (url ? linkNames.get(url) : undefined)
// Google's canonical ADDRESS (name + street + district) from a ?q= search
// redirect — present for ?g_st=ic links that carry no coordinate in the URL.
// Geocoding this pins the right building far better than the bare name.
const linkAddresses = new Map<string, string>()
export const resolvedLinkAddress = (url?: string | null) => (url ? linkAddresses.get(url) : undefined)

/** A resolved link point. pageDerived marks coordinates dug out of a PAGE
 *  body rather than a URL — those can be a server's geo-IP default (wrong
 *  country!) and must pass the caller's geographic sanity check before use. */
export interface ResolvedPoint extends LatLng { pageDerived?: boolean }

export async function resolveMapUrl(url: string): Promise<ResolvedPoint | null> {
  if (linkCache.has(url)) return linkCache.get(url) ?? null
  // "url5:" + "&v=5" bust every earlier cache generation — including any
  // already-cached page-derived points from before the resolver stopped
  // trusting scraped page bodies (those could be a data-centre's own address)
  const ls = lsGet(`url5:${url}`) as ResolvedPoint | null | undefined
  if (ls !== undefined) { linkCache.set(url, ls); return ls }
  let out: ResolvedPoint | null = null
  try {
    const res = await fetch(`/api/resolve-map?url=${encodeURIComponent(url)}&v=5`)
    if (res.ok) {
      const j = await res.json()
      if (typeof j.name === 'string' && j.name.trim()) linkNames.set(url, j.name.trim())
      if (typeof j.address === 'string' && j.address.trim()) linkAddresses.set(url, j.address.trim())
      if (valid(Number(j.lat), Number(j.lng))) {
        out = { lat: Number(j.lat), lng: Number(j.lng), ...(j.src === 'page' ? { pageDerived: true } : {}) }
      } else {
        let host = ''
        try { host = j?.finalUrl ? new URL(j.finalUrl).hostname : '' } catch { /* ignore */ }
        failNotes.set(url, `ปลายทางตอบ ${j?.status ?? '?'}${host ? ` · ${host}` : ''}`)
      }
    } else failNotes.set(url, `API ตอบ ${res.status}`)
  } catch { failNotes.set(url, 'ต่อ API ไม่ได้') }
  // cache successes durably; failures only for this session — a blocked or
  // flaky resolver must be retried on the next load, not remembered forever
  linkCache.set(url, out)
  if (out) lsSet(`url5:${url}`, out)
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

/** `near` biases ranking toward a bounding box around that point (Nominatim's
 *  viewbox) WITHOUT excluding matches outside it — this is what actually fixes
 *  "search 'Jollibee' → get a random branch anywhere on Earth": with no bias
 *  Nominatim has nothing to prefer the trip's city with. ±0.6° is roughly a
 *  60-70km box, wide enough to cover a whole metro area. */
async function geocodeRaw(query: string, near?: LatLng): Promise<LatLng | null> {
  try {
    let url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
    if (near) {
      const d = 0.6
      url += `&viewbox=${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`
    }
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
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

/** Google's shared-link address comes LOCALIZED: CJK unit/building tokens and a
 *  Thai (or other-script) country word tangled up with the Latin street +
 *  district — e.g. "A座地下F-G舖 ICHIRAN Hong Kong, Causeway Bay, 駱克大廈 440號
 *  Jaffe Rd, Causeway Bay, ฮ่องกง". Nominatim can't read that mixed string, but
 *  the street + district ("440 Jaffe Rd, Causeway Bay") ARE geocodable — so
 *  drop the non-Latin noise and let the trip's country anchor it. */
export function cleanAddress(address: string, country?: string): string {
  const s = address
    .replace(/[　-〿㐀-鿿豈-﫿]/g, ' ') // CJK ideographs & symbols
    .replace(/[฀-๿]+/g, ' ')                          // Thai (the localized country word)
    .replace(/\s+/g, ' ')
    .split(',').map((x) => x.trim()).filter(Boolean).join(', ') // drop segments the strip emptied
    .trim()
  const c = (country ?? '').trim()
  // make sure a country anchors the query when the localized one was stripped
  return c && !new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(s) ? `${s}, ${c}` : s
}

// ALS free-text lookup nails a CLEAN street address ("440 Jaffe Rd, Causeway
// Bay") — that's exactly what our health probe sends — but a leading business
// name ("ICHIRAN Hong Kong, Causeway Bay, 440 Jaffe Rd, …") throws its parser
// off and it returns the wrong building. So reduce a full Google address to
// what ALS can actually resolve:
//   • has a house number ("440 Jaffe Rd") → the street→district tail wins
//   • no house number, but a building name ("Lockhart House, …, Lockhart Rd")
//     → keep the BUILDING NAME + road + district, so ALS pins the building
//     instead of the middle of the road (the Lau Haa case)
// Drops the bare country token ALS doesn't need. Returns '' when nothing
// street-like is present (caller then skips ALS / uses the full string).
const ROAD_WORD = /\b(rd|road|st|street|ave|avenue|lane|ln|path|terr|terrace|praya|crescent|circuit|square|plaza|drive|dr|hill|way|estate|street)\b/i
const BUILDING_WORD = /\b(house|mansion|building|bldg|tower|centre|center|plaza|court|mall|garden|estate|block|arcade|apartments?|heights|villas?)\b/i
const isCountryTok = (s: string) => /^(hong\s?kong|hongkong|hk|china|prc)$/i.test(s)
export function alsQuery(addrClean: string): string {
  const segs = addrClean.split(',').map((s) => s.trim()).filter(Boolean)
  if (!segs.length) return ''
  // 1) a real house number is the strongest signal — take the street tail as-is
  const num = segs.findIndex((s) => /^\d{1,4}[a-z]?\b/i.test(s) && !/^\d+\.\d/.test(s))
  if (num >= 0) return segs.slice(num).filter((s) => !isCountryTok(s)).join(', ')
  // 2) no number: anchor on the building name (if any) + the road + district, so
  // ALS resolves the actual building rather than defaulting to the road centre
  const road = segs.findIndex((s) => ROAD_WORD.test(s))
  const bldg = segs.findIndex((s) => BUILDING_WORD.test(s))
  const picks: string[] = []
  if (bldg >= 0) picks.push(segs[bldg])
  if (road >= 0) for (const s of segs.slice(road)) if (!isCountryTok(s) && s !== segs[bldg]) picks.push(s)
  return picks.join(', ')
}

// HK Government official Address Lookup Service (ALS/OGCIO), via our own
// serverless proxy (/api/hk-geocode) to sidestep CORS. The authoritative HK
// address→coordinate database — building-accurate where OSM is vague — free,
// no key, no card. Returns null off-HK or on any miss, so callers fall through
// to OSM. This is the closest-to-Google free result for HK street addresses.
async function alsRaw(query: string): Promise<LatLng | null> {
  try {
    const res = await fetch(`/api/hk-geocode?q=${encodeURIComponent(query)}`)
    if (!res.ok) return null
    const j = await res.json()
    const lat = Number(j?.lat), lng = Number(j?.lng)
    return valid(lat, lng) ? { lat, lng } : null
  } catch { return null }
}

// In-app health check for the HK ALS engine, so the audit panel can report
// whether it's actually working WITHOUT the user ever copying a URL or pasting
// debug JSON. Probes one known-good HK address and interprets the endpoint's
// own reply. `ok:false` just means HK places fall back to OSM (right district,
// not building-exact) — never a worse pin than before.
export async function alsHealth(): Promise<{ ok: boolean; note: string }> {
  const probe = '440 Jaffe Road Causeway Bay'
  try {
    const res = await fetch(`/api/hk-geocode?q=${encodeURIComponent(probe)}`)
    let j: Record<string, unknown> = {}
    try { j = await res.json() } catch { /* non-JSON body */ }
    const lat = Number(j?.lat), lng = Number(j?.lng)
    if (valid(lat, lng)) return { ok: true, note: 'ทำงานปกติ (พิกัดระดับตึกจาก ALS)' }
    if (j?.error === 'no match') return { ok: false, note: 'ALS ตอบกลับ แต่หาที่อยู่ทดสอบไม่เจอ' }
    if (j?.cause || j?.error) return { ok: false, note: `ต่อ ALS ไม่ได้: ${String(j.cause || j.error)}` }
    return { ok: false, note: `ไม่เข้าใจคำตอบจาก ALS (HTTP ${res.status})` }
  } catch (e) {
    return { ok: false, note: `เรียก endpoint ไม่ได้: ${String((e as Error)?.message || e)}` }
  }
}

// Photon (komoot) — free OSM geocoder, fuzzy/typo-tolerant where Nominatim
// wants near-exact matches. No key, CORS-open. Optional proximity bias.
async function photonRaw(query: string, near?: LatLng): Promise<LatLng | null> {
  try {
    const bias = near ? `&lat=${near.lat}&lon=${near.lng}` : ''
    const res = await fetch(`https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(query)}${bias}`)
    if (!res.ok) return null
    const j = await res.json()
    const c = j?.features?.[0]?.geometry?.coordinates
    const lng = Number(c?.[0]), lat = Number(c?.[1])
    return valid(lat, lng) ? { lat, lng } : null
  } catch { return null }
}

// Mapbox geocoding — a REAL places API: strong business/POI coverage and a
// proximity bias, which together nail the exact branch of a chain far better
// than OSM. Needs a free token (VITE_MAPBOX_TOKEN); no-op without one, so the
// OSM fallbacks below still run. Public URL-restricted tokens are safe client-
// side (that's what Mapbox tokens are designed for).
const MAPBOX_TOKEN = (import.meta.env?.VITE_MAPBOX_TOKEN as string | undefined)?.trim()
export const hasPlacesApi = !!MAPBOX_TOKEN
async function mapboxRaw(query: string, near?: LatLng): Promise<LatLng | null> {
  if (!MAPBOX_TOKEN || !query.trim()) return null
  try {
    const params = new URLSearchParams({ access_token: MAPBOX_TOKEN, limit: '1', types: 'poi,address,place' })
    if (near) params.set('proximity', `${near.lng},${near.lat}`)
    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`)
    if (!res.ok) return null
    const j = await res.json()
    const c = j?.features?.[0]?.center // [lng, lat]
    const lng = Number(c?.[0]), lat = Number(c?.[1])
    return valid(lat, lng) ? { lat, lng } : null
  } catch { return null }
}

export interface GeoHit extends LatLng { approx?: boolean; precise?: boolean }

/** Great-circle distance in km. */
export function distKm(a: LatLng, b: LatLng): number {
  const R = 6371, toR = Math.PI / 180
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** C+) Multi-step geocode for a place. Tries, in order:
 *  1. Nominatim — full name + city + country, then the cleaned name
 *  2. Photon    — fuzzy match on name + city (handles typos/decorations)
 *  3. the transit STATION as a stand-in → returned with approx: true
 *  A name hit further than 2km from the place's own transit station is
 *  rejected as the WRONG BRANCH (chain restaurants!) — it retries near the
 *  station, else falls back to the station point.
 *  Cached (memory + localStorage) under one key per place. */
const smartCache = new Map<string, GeoHit | null>()
export function geocodeSmart(o: { name?: string | null; address?: string | null; station?: string | null; city?: string | null; country?: string | null; near?: LatLng | null }): Promise<GeoHit | null> {
  const name = (o.name ?? '').trim(), station = (o.station ?? '').trim()
  const city = (o.city ?? '').trim(), country = (o.country ?? '').trim()
  const address = (o.address ?? '').trim()
  const near = o.near ?? undefined
  if (!name && !station && !address) return Promise.resolve(null)
  // smart11: HK official address DB (ALS) added ahead of OSM — bust prior results
  const nk = near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : ''
  const key = `smart11:${[name, address, station, city, country, nk].join('|')}`
  if (smartCache.has(key)) return Promise.resolve(smartCache.get(key) ?? null)
  const cached = lsGet(key) as GeoHit | null | undefined
  if (cached !== undefined) { smartCache.set(key, cached); return Promise.resolve(cached) }
  const run = chain.then(async (): Promise<GeoHit | null> => {
    if (smartCache.has(key)) return smartCache.get(key) ?? null
    const cleaned = cleanPlaceName(name)
    // NB: `near` (the trip's own centre) biases Nominatim toward the right
    // city/branch without it — this is what actually fixes "search a chain's
    // name → get a random branch anywhere on Earth"; free, keyless.
    const tryNom = async (parts: string[], biasAt?: LatLng) => {
      const q = parts.filter(Boolean).join(', ')
      if (!q) return null
      const r = await geocodeRaw(q, biasAt ?? near)
      await sleep(1100) // be polite to Nominatim
      return r
    }
    // the station's own point — the anchor for the wrong-branch check AND the
    // last-resort stand-in; resolved lazily, at most once
    let sp: LatLng | null | undefined
    const stationPoint = async (): Promise<LatLng | null> => {
      if (sp !== undefined) return sp
      sp = station
        ? await mapboxRaw([`${station} station`, city].filter(Boolean).join(' '), near)
          || await tryNom([`${station} station`, city, country])
          || await tryNom([station, city, country])
          || await photonRaw([station, city, country].filter(Boolean).join(' '), near)
        : null
      return sp
    }
    // 0) Google's OWN canonical address (name + street + district) is the most
    // precise signal there is — geocode it proximity-biased, before anything
    // else. Google localizes it (CJK unit/building tokens + a Thai country word
    // tangled with the Latin street), which Nominatim can't read — so try a
    // cleaned/latinized form first, then the raw string as a backstop. This is
    // what lands a ?g_st=ic link (which carries an address but no coordinate) on
    // the right building instead of a bare-name wrong branch or the station.
    const addrClean = address ? cleanAddress(address, country) : ''
    // Hong Kong? then the official HK address DB is the most accurate free
    // source — try it first. (Off-HK it returns null and we fall through.)
    const isHK = /hong\s?kong|hongkong|\bhk\b/i.test([addrClean, city, country].join(' '))
    // ALS first — but with the street→district tail (no business name), which is
    // what it can actually parse; only fall back to the full string if that misses
    const alsQ = addrClean && isHK ? alsQuery(addrClean) : ''
    // ALS is the authoritative HK address DB — a hit here is building-accurate,
    // flagged `precise` so the audit force-applies it over a stale wrong pin
    // (the coarse 250m "don't churn" guard would otherwise freeze the old point)
    let fromAls = false
    let r: LatLng | null = alsQ ? await alsRaw(alsQ) : null
    if (!r && addrClean && isHK && addrClean !== alsQ) r = await alsRaw(addrClean)
    if (r) fromAls = true
    if (!r && addrClean) r = await tryNom([addrClean])
    if (!r && addrClean) r = await photonRaw(addrClean, near)
    if (!r && address && address !== addrClean) r = await tryNom([address])
    // a hit here came from the place's OWN specific address (or ALS) — it's
    // trustworthy as-is and must skip the station wrong-branch guard below, which
    // exists only for bare-name chain matches. Without this, a landmark that's
    // legitimately far from its nearest station (Tian Tan Buddha ~6km from Tung
    // Chung, reached by cable car) gets wrongly bounced back to the station.
    const addrBased = !!r
    // 0b) Mapbox POI (proximity-biased) — no-ops without VITE_MAPBOX_TOKEN
    if (!r && name) r = await mapboxRaw([name, city].filter(Boolean).join(' '), near)
    if (!r && cleaned && cleaned !== name) r = await mapboxRaw([cleaned, city].filter(Boolean).join(' '), near)
    // 1) Nominatim ladder — proximity-biased (the actual fix, needs no key)
    if (!r && name) r = await tryNom([name, city, country])
    if (!r && cleaned && cleaned !== name) r = await tryNom([cleaned, city, country])
    // 2) Photon fuzzy (proximity-biased)
    if (!r && name) r = await photonRaw([name, city].filter(Boolean).join(' '), near)
    if (!r && cleaned && cleaned !== name) r = await photonRaw([cleaned, city, country].filter(Boolean).join(' '), near)
    // wrong-branch guard: the user told us which station the place is at — a
    // "match" 2km+ away is another branch of the same name. Retry anchored to
    // the station; if that fails too, the station stand-in wins. Only for
    // bare-NAME hits — an address/ALS match (addrBased) is specific, so trust it.
    if (r && station && !addrBased) {
      const s = await stationPoint()
      if (s && distKm(r, s) > 2) {
        const nearHit = await mapboxRaw([name, station, city].filter(Boolean).join(' '), s)
          || await photonRaw([name, station, city].filter(Boolean).join(' '), s)
        r = nearHit && distKm(nearHit, s) <= 2 ? nearHit : null
        fromAls = false // replaced by an OSM/Mapbox point — no longer authoritative
      }
    }
    // POI refinement for landmarks: OSM often resolves a numberless address
    // ("Tian Tan Buddha, Ngong Ping Rd, …") to the ROAD/village rather than the
    // named point. When the hit came from an address (not ALS) and the address
    // has NO house number, look up the NAME as a POI near that point and snap to
    // it if it's close — so a landmark lands on itself, not the nearest road.
    // Gated to numberless, non-ALS hits so precise restaurant pins are untouched.
    const addrHasNumber = /(^|,)\s*\d{1,4}[a-z]?\b/i.test(addrClean)
    if (r && addrBased && !fromAls && name && !addrHasNumber) {
      const poi = await mapboxRaw([name, city].filter(Boolean).join(' '), r)
        || await photonRaw([name, city].filter(Boolean).join(' '), r)
        || await tryNom([name, city, country], r)
      if (poi && distKm(poi, r) <= 1) r = poi // close by → same place, snap to its POI
    }
    let hit: GeoHit | null = null
    if (r) hit = { ...r, approx: false, ...(fromAls ? { precise: true } : {}) }
    else {
      const s = await stationPoint()
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
