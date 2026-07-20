// Tests for coordinate resolution (no framework — run: node scripts/test-geo.mjs)
// Covers the exact bugs that put pins in the wrong place:
//  1. URL parsing precedence — the place's own !3d/!4d point beats the @viewport
//  2. wrong-branch guard — a name hit far from the place's named station is
//     rejected and the station stand-in wins
//  3. a name hit NEAR the station is accepted as-is
//  4. failed link resolutions are NOT persisted (must retry next load)
import { execSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let pass = 0, fail = 0
const ok = (cond, name) => { if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}`) } }

// localStorage shim BEFORE importing the module
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

const dir = mkdtempSync(join(tmpdir(), 'geotest-'))
execSync(`npx esbuild src/lib/geo.ts --bundle --format=esm --outfile=${join(dir, 'geo.mjs')}`, { stdio: 'pipe' })
const { latLngFromUrl, latLngFromUrlExact, geocodeSmart, resolveMapUrl, distKm, cleanAddress, alsQuery } = await import(join(dir, 'geo.mjs'))

// ---- 1. URL precedence ----
console.log('URL parsing')
const gUrl = 'https://www.google.com/maps/place/Jollibee/@22.2900,114.1000,17z/data=!3m1!4b1!4m6!3m5!3d22.2766!4d114.1747'
const r1 = latLngFromUrl(gUrl)
ok(r1 && Math.abs(r1.lat - 22.2766) < 1e-6 && Math.abs(r1.lng - 114.1747) < 1e-6,
  `!3d/!4d place point wins over @viewport (got ${r1?.lat},${r1?.lng})`)
const rExact = latLngFromUrlExact('https://maps.google.com/maps?foo=1&daddr=22.30,114.17')
ok(rExact && rExact.lat === 22.30, 'explicit lat,lng param counts as exact')
ok(latLngFromUrlExact('https://www.google.com/maps/@22.29,114.10,15z') === null, '@viewport alone is NOT exact')

// ---- fetch mock for geocoders ----
const json = (body) => ({ ok: true, json: async () => body })
const realFetch = globalThis.fetch
const mainMock = async (url) => {
  const s = decodeURIComponent(String(url))
  if (s.includes('nominatim')) {
    if (s.includes('Jollibee')) return json([{ lat: '22.2890', lon: '113.9410' }]) // Tung Chung branch — WRONG (far from Wan Chai)
    if (s.includes('Wan Chai')) return json([{ lat: '22.2775', lon: '114.1725' }]) // the named station
    if (s.includes('Cafe Near')) return json([{ lat: '22.2800', lon: '114.1750' }]) // ~0.4km from station — plausible
    return json([])
  }
  if (s.includes('photon')) return json({ features: [] }) // no fuzzy rescue in these cases
  if (s.includes('/api/resolve-map')) throw new Error('resolver down')
  throw new Error('unexpected fetch ' + s)
}
globalThis.fetch = mainMock

// ---- 1b. Nominatim proximity bias — the actual fix for "wrong branch,
// wrong country": a viewbox around `near` must reach the request URL ----
console.log('geocodeRaw proximity bias')
// multiple providers get queried (Nominatim then Photon) — OR across every
// call made during the geocodeSmart run, not just the last one
let sawViewbox = false
globalThis.fetch = async (url) => { sawViewbox = sawViewbox || String(url).includes('viewbox='); return json([]) }
await geocodeSmart({ name: 'Solo Test', city: 'Hong Kong', near: { lat: 22.28, lng: 114.17 } })
ok(sawViewbox === true, 'near: {...} on geocodeSmart reaches Nominatim as &viewbox=')
sawViewbox = false
await geocodeSmart({ name: 'Solo Test 2', city: 'Hong Kong' })
ok(sawViewbox === false, 'no near → no viewbox param (unbiased search still works)')
globalThis.fetch = mainMock

// ---- 2. wrong-branch guard ----
console.log('geocodeSmart()')
const g1 = await geocodeSmart({ name: 'Jollibee', station: 'Wan Chai', city: 'Hong Kong', country: 'Hong Kong' })
ok(!!g1, 'returns a hit')
ok(g1?.approx === true, 'far-from-station name match rejected → station stand-in (approx)')
ok(g1 && distKm(g1, { lat: 22.2775, lng: 114.1725 }) < 0.1, `stand-in sits AT the station (got ${g1?.lat},${g1?.lng})`)

// ---- 3. near-station hit accepted ----
const g2 = await geocodeSmart({ name: 'Cafe Near', station: 'Wan Chai', city: 'Hong Kong', country: 'Hong Kong' })
ok(g2 && g2.approx === false, 'name match near the station is accepted as exact')
ok(g2 && Math.abs(g2.lat - 22.28) < 1e-6, 'accepted hit keeps its own coords')

// ---- 3a2. cleanAddress: Google's LOCALIZED address (real ICHIRAN shape,
// captured from production) — CJK unit/building + Thai country are stripped so
// Nominatim can read the Latin street + district ----
console.log('cleanAddress (real ICHIRAN shape)')
const ichAddr = 'A座地下F-G舖 ICHIRAN Hong Kong, Causeway Bay, 駱克大廈 440號 Jaffe Rd, Causeway Bay, ฮ่องกง'
const ichClean = cleanAddress(ichAddr, 'Hongkong')
ok(!/[　-鿿฀-๿]/.test(ichClean), `CJK + Thai stripped (got "${ichClean}")`)
ok(ichClean.includes('Jaffe Rd') && ichClean.includes('Causeway Bay'), 'the geocodable street + district survive')
ok(ichClean.includes('Hongkong'), 'country anchor kept (was Thai, now the trip country)')

// ---- 3a2b. alsQuery: strip the business-name prefix so ALS sees the SAME
// clean street our health probe uses (the ICHIRAN "moved but still wrong" fix) ----
console.log('alsQuery (street-focused ALS input)')
ok(alsQuery('ICHIRAN Hong Kong, Causeway Bay, 440 Jaffe Rd, Causeway Bay, Hongkong') === '440 Jaffe Rd, Causeway Bay',
  `drops business name + country, keeps street→district (got "${alsQuery('ICHIRAN Hong Kong, Causeway Bay, 440 Jaffe Rd, Causeway Bay, Hongkong')}")`)
ok(alsQuery('Lau Haa Hot Pot, 12 Percival Street, Causeway Bay, Hong Kong') === '12 Percival Street, Causeway Bay',
  'house-numbered street is found past a multi-word name')
ok(alsQuery('Some Cafe, Nathan Road, Mong Kok, Hong Kong') === 'Nathan Road, Mong Kok',
  'no house number → falls back to the road-word segment')
ok(alsQuery('Lockhart House, Lau Haa Hot Pot Restaurant, Lockhart Rd, Causeway Bay, Hongkong') === 'Lockhart House, Lockhart Rd, Causeway Bay',
  `numberless address keeps the BUILDING NAME so ALS pins the building, not the road centre (got "${alsQuery('Lockhart House, Lau Haa Hot Pot Restaurant, Lockhart Rd, Causeway Bay, Hongkong')}")`)
ok(alsQuery('ICHIRAN, Causeway Bay') === '',
  'no street-like segment → empty (caller skips the street query)')

// ---- 3a3. HK official address DB (ALS) is tried FIRST for a HK address and
// its building-accurate coordinate wins over OSM ----
console.log('geocodeSmart HK-ALS-first')
globalThis.fetch = async (url) => {
  const s = String(url)
  if (s.includes('/api/hk-geocode')) return json({ lat: 22.2801, lng: 114.1845, score: 82 }) // official building point
  if (s.includes('nominatim')) return json([{ lat: '22.2700', lon: '114.1700' }]) // OSM would give a vaguer point
  if (s.includes('photon')) return json({ features: [] })
  throw new Error('unexpected ' + s)
}
const gHK = await geocodeSmart({
  name: 'ICHIRAN', address: 'ICHIRAN Hong Kong, Causeway Bay, 440 Jaffe Rd, Causeway Bay, ฮ่องกง',
  city: 'Hongkong', country: 'Hongkong', near: { lat: 22.28, lng: 114.18 },
})
ok(gHK && Math.abs(gHK.lat - 22.2801) < 1e-6 && Math.abs(gHK.lng - 114.1845) < 1e-6,
  `HK ALS building coordinate wins over OSM (got ${gHK?.lat},${gHK?.lng})`)
globalThis.fetch = mainMock

// ---- 3b. address-first: Google's canonical address (name + street + district)
// geocodes precisely and wins over the bare name — the ?g_st=ic fix ----
console.log('geocodeSmart address-first')
globalThis.fetch = async (url) => {
  const s = decodeURIComponent(String(url))
  // only the FULL address (carries the street/district) resolves; the mock
  // returns nothing for a bare-name query, proving the address is what landed it
  if (s.includes('nominatim') && s.includes('Lung Poon')) return json([{ lat: '22.3405', lon: '114.2016' }])
  if (s.includes('nominatim')) return json([])
  if (s.includes('photon')) return json({ features: [] })
  throw new Error('unexpected ' + s)
}
const gAddr = await geocodeSmart({
  name: 'ABURI-EN', // bare name alone would miss
  address: 'ABURI-EN (Plaza Hollywood), Lung Poon St, Diamond Hill, Hong Kong',
  city: 'Hongkong', near: { lat: 22.33, lng: 114.20 },
})
ok(gAddr && gAddr.approx === false && Math.abs(gAddr.lat - 22.3405) < 1e-6,
  `canonical address geocodes to its own point, not a station stand-in (got ${gAddr?.lat},${gAddr?.lng})`)
globalThis.fetch = mainMock

// ---- 3c. landmark far from its station: an ADDRESS-based hit must NOT be
// bounced back to the station by the wrong-branch guard (that guard is only for
// bare-name chain matches). Tian Tan Buddha sits ~6km from Tung Chung. ----
console.log('geocodeSmart landmark far from station')
globalThis.fetch = async (url) => {
  const s = decodeURIComponent(String(url))
  if (s.includes('/api/hk-geocode')) return json({ error: 'no match' }) // ALS misses rural Lantau
  if (s.includes('nominatim') && s.includes('Ngong Ping')) return json([{ lat: '22.2540', lon: '113.9052' }]) // from its address
  if (s.includes('nominatim') && s.includes('Tung Chung')) return json([{ lat: '22.2890', lon: '113.9410' }]) // station, ~6km away
  if (s.includes('nominatim')) return json([])
  if (s.includes('photon')) return json({ features: [] })
  throw new Error('unexpected ' + s)
}
const gLandmark = await geocodeSmart({
  name: 'Tian Tan Buddha', address: 'Tian Tan Buddha, Ngong Ping Rd, Lantau Island, Hong Kong',
  station: 'Tung Chung', city: 'Hong Kong', country: 'Hong Kong', near: { lat: 22.27, lng: 113.92 },
})
ok(gLandmark && gLandmark.approx === false && Math.abs(gLandmark.lat - 22.2540) < 1e-6,
  `far-from-station landmark keeps its address point, not the station stand-in (got ${gLandmark?.lat},${gLandmark?.lng}, approx=${gLandmark?.approx})`)
globalThis.fetch = mainMock

// ---- 4. failed resolutions are not persisted ----
console.log('resolveMapUrl()')
const r4 = await resolveMapUrl('https://maps.app.goo.gl/testfail123')
ok(r4 === null, 'resolver down → null')
const persistedNull = [...store.keys()].some((k) => k.includes('https://maps.app.goo.gl/testfail123'))
ok(!persistedNull, 'failure NOT written to localStorage (will retry next load)')

// ---- 5. page-derived points carry the pageDerived flag to the caller ----
globalThis.fetch = async (url) => {
  const s = String(url)
  if (s.includes('/api/resolve-map')) {
    if (s.includes('pagepoint')) return json({ lat: 39.0, lng: -95.0, src: 'page' }) // geo-IP default garbage
    return json({ lat: 22.2766, lng: 114.1747, src: 'url' })
  }
  throw new Error('unexpected ' + s)
}
const rp = await resolveMapUrl('https://maps.app.goo.gl/pagepoint1')
ok(rp?.pageDerived === true, 'src:page → pageDerived flag set (caller must sanity-check)')
const ru = await resolveMapUrl('https://maps.app.goo.gl/urlpoint1')
ok(ru && !ru.pageDerived, 'src:url → trusted, no flag')

globalThis.fetch = realFetch
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
