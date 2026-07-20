// Tests for api/hk-geocode.js (run: node scripts/test-hk-geocode.mjs)
// Mocks the HK ALS/OGCIO response shape. This verifies our PARSING + HK-bounds
// validation; the live ALS behaviour is confirmed by the in-app audit (the
// sandbox can't reach als.ogcio.gov.hk). Parsing is defensive: any shape we
// don't recognise, or a coordinate outside Hong Kong, returns an error so the
// client falls back to OSM — it can never place a worse pin than before.
let pass = 0, fail = 0
const ok = (cond, name) => { if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}`) } }

const { default: handler } = await import('../api/hk-geocode.js')
const mkRes = () => {
  const r = { code: 200, headers: {}, body: null }
  r.status = (c) => { r.code = c; return r }
  r.setHeader = (k, v) => { r.headers[k] = v }
  r.json = (b) => { r.body = b; return r }
  return r
}
const realFetch = globalThis.fetch
const alsHit = (lat, lng, score = 75) => ({
  ok: true, status: 200,
  text: async () => JSON.stringify({
    RequestAddress: { AddressLine: ['440 Jaffe Road Causeway Bay'] },
    SuggestedAddress: [{
      Address: { PremisesAddress: {
        GeospatialInformation: { Latitude: String(lat), Longitude: String(lng), Northing: '815000', Easting: '834000' },
        EngPremisesAddress: { BuildingName: 'LOCKHART HOUSE' },
      } },
      ValidationInformation: { Score: score },
    }],
  }),
})

// 1. a real HK address → building coordinate + score, edge-cached
{
  globalThis.fetch = async () => alsHit(22.28015, 114.18453, 82)
  const res = mkRes()
  await handler({ query: { q: '440 Jaffe Rd, Causeway Bay, Hong Kong' } }, res)
  ok(Math.abs(res.body?.lat - 22.28015) < 1e-6 && Math.abs(res.body?.lng - 114.18453) < 1e-6,
    `HK address → official building coordinate (got ${res.body?.lat},${res.body?.lng})`)
  ok(res.body?.score === 82, `match score passed through (got ${res.body?.score})`)
  ok(String(res.headers['Cache-Control']).includes('s-maxage'), 'stable govt data is edge-cached')
}

// 2. a coordinate OUTSIDE Hong Kong (bad data) is rejected, not returned
{
  globalThis.fetch = async () => alsHit(39.0268, -77.8443) // the infamous geo-IP garbage
  const res = mkRes()
  await handler({ query: { q: 'somewhere' } }, res)
  ok(res.body?.lat === undefined, 'a non-HK coordinate is never returned (client falls back to OSM)')
  ok(res.body?.error === 'no match', 'reported as a clean miss')
  ok(String(res.headers['Cache-Control']) === 'no-store', 'a miss is not edge-cached')
}

// 3. an empty / unrecognised ALS response → clean miss, no crash
{
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ SuggestedAddress: [] }) })
  const res = mkRes()
  await handler({ query: { q: 'nothing here' } }, res)
  ok(res.body?.lat === undefined && res.body?.error === 'no match', 'empty result set → clean miss')
}

// 4. ALS unreachable / errors → handled, never throws
{
  globalThis.fetch = async () => { throw new Error('network down') }
  const res = mkRes()
  await handler({ query: { q: 'x' } }, res)
  ok(res.body?.lat === undefined && typeof res.body?.error === 'string', 'upstream failure degrades to an error, not a crash')
  ok(String(res.headers['Cache-Control']) === 'no-store', 'failure not cached')
}

// 5. missing query → 400
{
  globalThis.fetch = async () => alsHit(22.28, 114.18)
  const res = mkRes()
  await handler({ query: {} }, res)
  ok(res.code === 400, 'missing q → 400')
}

globalThis.fetch = realFetch
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
