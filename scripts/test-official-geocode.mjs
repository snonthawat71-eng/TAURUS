// Tests for api/jp-geocode.js (GSI) and api/sg-geocode.js (OneMap).
// Mocks each upstream's response shape. Verifies PARSING + per-country bounds
// validation; live behaviour is confirmed by the in-app audit health probe (the
// sandbox can't reach the gov endpoints). Parsing is defensive: any shape we
// don't recognise, or a coordinate outside the country, returns an error so the
// client falls back to OSM — never a worse pin than before.
let pass = 0, fail = 0
const ok = (cond, name) => { if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}`) } }
const mkRes = () => {
  const r = { code: 200, headers: {}, body: null }
  r.status = (c) => { r.code = c; return r }
  r.setHeader = (k, v) => { r.headers[k] = v }
  r.json = (b) => { r.body = b; return r }
  return r
}
const realFetch = globalThis.fetch

// ── Japan GSI ──────────────────────────────────────────────────────────────
const { default: jp } = await import('../api/jp-geocode.js')
// GSI returns a GeoJSON FeatureCollection; coordinates are [lng, lat]
const gsiHit = (lng, lat) => ({ ok: true, status: 200, text: async () => JSON.stringify([
  { geometry: { type: 'Point', coordinates: [lng, lat] }, type: 'Feature', properties: { title: '東京都千代田区丸の内一丁目' } },
]) })
console.log('jp-geocode (GSI)')
{
  globalThis.fetch = async () => gsiHit(139.767125, 35.681236) // Tokyo Station
  const res = mkRes()
  await jp({ query: { q: '東京都千代田区丸の内1' } }, res)
  ok(Math.abs(res.body?.lat - 35.681236) < 1e-6 && Math.abs(res.body?.lng - 139.767125) < 1e-6,
    `JP address → GSI point, coords read as [lng,lat] (got ${res.body?.lat},${res.body?.lng})`)
  ok(String(res.headers['Cache-Control']).includes('s-maxage'), 'stable govt data is edge-cached')
}
{
  globalThis.fetch = async () => gsiHit(-77.8443, 39.0268) // geo-IP garbage, outside Japan
  const res = mkRes()
  await jp({ query: { q: 'somewhere' } }, res)
  ok(res.body?.lat === undefined && res.body?.error === 'no match', 'a non-Japan coordinate is rejected as a clean miss')
  ok(String(res.headers['Cache-Control']) === 'no-store', 'a miss is not edge-cached')
}
{
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify([]) })
  const res = mkRes()
  await jp({ query: { q: 'nothing' } }, res)
  ok(res.body?.error === 'no match', 'empty GSI result → clean miss')
}
{
  globalThis.fetch = async () => { throw new Error('network down') }
  const res = mkRes()
  await jp({ query: { q: 'x' } }, res)
  ok(res.body?.lat === undefined && typeof res.body?.error === 'string', 'upstream failure degrades to an error, not a crash')
}
{
  const res = mkRes()
  await jp({ query: {} }, res)
  ok(res.code === 400, 'missing q → 400')
}

// ── Singapore OneMap ─────────────────────────────────────────────────────────
const { default: sg } = await import('../api/sg-geocode.js')
const oneMapHit = (lat, lng) => ({ ok: true, status: 200, text: async () => JSON.stringify({
  found: 1, totalNumPages: 1, pageNum: 1,
  results: [{ SEARCHVAL: 'MARINA BAY SANDS', LATITUDE: String(lat), LONGITUDE: String(lng), POSTAL: '018956' }],
}) })
console.log('sg-geocode (OneMap)')
{
  globalThis.fetch = async () => oneMapHit(1.283966, 103.860527) // Marina Bay Sands
  const res = mkRes()
  await sg({ query: { q: '10 Bayfront Avenue' } }, res)
  ok(Math.abs(res.body?.lat - 1.283966) < 1e-6 && Math.abs(res.body?.lng - 103.860527) < 1e-6,
    `SG address → OneMap point (got ${res.body?.lat},${res.body?.lng})`)
  ok(String(res.headers['Cache-Control']).includes('s-maxage'), 'stable govt data is edge-cached')
}
{
  globalThis.fetch = async () => oneMapHit(39.0268, -77.8443) // outside Singapore
  const res = mkRes()
  await sg({ query: { q: 'somewhere' } }, res)
  ok(res.body?.error === 'no match', 'a non-Singapore coordinate is rejected')
}
{
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ found: 0, results: [] }) })
  const res = mkRes()
  await sg({ query: { q: 'nothing' } }, res)
  ok(res.body?.error === 'no match', 'empty OneMap result → clean miss')
}
{
  const res = mkRes()
  await sg({ query: {} }, res)
  ok(res.code === 400, 'missing q → 400')
}

globalThis.fetch = realFetch
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
