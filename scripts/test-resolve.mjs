// Tests for api/resolve-map.js (run: node scripts/test-resolve.mjs)
// Simulates the real redirect chains that were failing in production.
let pass = 0, fail = 0
const ok = (cond, name) => { if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}`) } }

const { default: handler } = await import('../api/resolve-map.js')
const mkRes = () => {
  const r = { code: 200, headers: {}, body: null }
  r.status = (c) => { r.code = c; return r }
  r.setHeader = (k, v) => { r.headers[k] = v }
  r.json = (b) => { r.body = b; return r }
  return r
}
const realFetch = globalThis.fetch
const redirect = (loc) => ({ status: 302, headers: { get: (k) => (k.toLowerCase() === 'location' ? loc : null) }, text: async () => '' })
const page = (html, status = 200) => ({ status, headers: { get: () => null }, text: async () => html })

// 1. Google short link → 302 whose Location carries !3d!4d → coords from the
//    redirect URL alone, place point (not the @viewport), WITHOUT fetching Google
{
  let googleFetched = false
  globalThis.fetch = async (url) => {
    const s = String(url)
    if (s.startsWith('https://maps.app.goo.gl/'))
      return redirect('https://www.google.com/maps/place/Shop/@22.2900,114.1000,17z/data=!3m1!4b1!4m6!3m5!3d22.2766!4d114.1747')
    googleFetched = true
    return page('<html>blocked</html>', 403)
  }
  const res = mkRes()
  await handler({ query: { url: 'https://maps.app.goo.gl/abc123' } }, res)
  ok(Math.abs((res.body?.lat ?? 0) - 22.2766) < 1e-6 && Math.abs((res.body?.lng ?? 0) - 114.1747) < 1e-6,
    `short link → place point from redirect URL (got ${res.body?.lat},${res.body?.lng})`)
  ok(res.body?.src === 'url', `url-borne points are labelled src:url (got ${res.body?.src})`)
  ok(String(res.headers['Cache-Control']).includes('s-maxage'), 'url-borne success IS edge-cached')
  ok(res.body?.name === 'Shop', `place name parsed from hop URL (got ${res.body?.name})`)
}

// 2. consent interstitial: real target hidden in ?continue=
{
  globalThis.fetch = async (url) => {
    const s = String(url)
    if (s.includes('goo.gl')) return redirect('https://consent.google.com/m?continue=' + encodeURIComponent('https://www.google.com/maps/place/X/@1,2,17z/data=!3d22.3193!4d114.1694'))
    return page('consent page')
  }
  const res = mkRes()
  await handler({ query: { url: 'https://maps.app.goo.gl/consent1' } }, res)
  ok(Math.abs((res.body?.lat ?? 0) - 22.3193) < 1e-6, `coords recovered from consent ?continue= (got ${res.body?.lat})`)
}

// 2b. NO redirect at all — modern maps.app.goo.gl answers 200 with a JS
//     interstitial whose escaped JSON embeds the real maps URL
{
  globalThis.fetch = async (url) => {
    const s = String(url)
    if (s.startsWith('https://maps.app.goo.gl/'))
      return page('<html><script>var data={"u":"https:\\/\\/www.google.com\\/maps\\/place\\/ICHIRAN\\/@22.2801,114.1830,17z\\/data\\u003d!3m1!4b1!4m6!3m5!3d22.2799!4d114.1836"};</script></html>')
    return page('should not fetch further', 500)
  }
  const res = mkRes()
  await handler({ query: { url: 'https://maps.app.goo.gl/interstitial' } }, res)
  ok(Math.abs((res.body?.lat ?? 0) - 22.2799) < 1e-6 && Math.abs((res.body?.lng ?? 0) - 114.1836) < 1e-6,
    `coords dug out of a 200 interstitial page (got ${res.body?.lat},${res.body?.lng})`)
}

// 2c. meta-refresh interstitial
{
  globalThis.fetch = async (url) => {
    const s = String(url)
    if (s.includes('goo.gl')) return page('<meta http-equiv="refresh" content="0;url=https://www.google.com/maps/place/X/data=!3d22.3000!4d114.1600">')
    return page('', 500)
  }
  const res = mkRes()
  await handler({ query: { url: 'https://maps.app.goo.gl/meta1' } }, res)
  ok(Math.abs((res.body?.lat ?? 0) - 22.3) < 1e-6, `meta-refresh interstitial handled (got ${res.body?.lat})`)
}

// 2d. place-ID URL (no coords in ANY hop) → coordinates scraped out of the
//     rendered page body are NEVER trusted, even when they look like a valid
//     lat/lng pair — a blocked/challenged Google page can embed the
//     REQUESTING SERVER's own approximate location instead of the place's.
//     The canonical name (found in the hop URL itself here) still comes back.
{
  globalThis.fetch = async (url) => {
    const s = String(url)
    if (s.startsWith('https://maps.app.goo.gl/'))
      return redirect('https://www.google.com/maps/place/ICHIRAN/data=!4m2!3m1!1s0x3404005e7d1a1b2f')
    return page('<script>window.APP_INITIALIZATION_STATE=[[[17.0,114.1836,22.2799],null,[null,null,22.2799,114.1836]]];</script>')
  }
  const res = mkRes()
  await handler({ query: { url: 'https://maps.app.goo.gl/placeid1' } }, res)
  ok(res.body?.lat === undefined && res.body?.lng === undefined,
    `page-body coords (APP_INITIALIZATION_STATE) are never returned (got ${res.body?.lat},${res.body?.lng})`)
  ok(res.body?.name === 'ICHIRAN', `canonical name still recovered, from the hop URL (got ${res.body?.name})`)
  ok(res.body?.src === undefined, 'no src label when there are no coordinates to label')
  ok(res.body?.error === 'no coords', 'reported as a clean failure, not a silent wrong answer')
  ok(String(res.headers['Cache-Control']) === 'no-store', 'a no-coords result is never edge-cached')
}

// 2f. the exact production regression that shipped wrong-country pins: a
//     blocked Google page's bootstrap JS embeds ~39.03,-77.84 — a data-centre
//     address in Ashburn, VA, nowhere near any real trip — must never leak out
{
  globalThis.fetch = async (url) => {
    const s = String(url)
    if (s.includes('goo.gl'))
      return page('<html><script>window.APP_INITIALIZATION_STATE=[[[15,-77.844326,39.02679945],null,[null,null,39.02679945,-77.844326]]];</script></html>')
    return page('', 500)
  }
  const res = mkRes()
  await handler({ query: { url: 'https://maps.app.goo.gl/gst1?g_st=ic' } }, res)
  ok(res.body?.lat === undefined && res.body?.lng === undefined,
    `the real production garbage coordinate (server geo-IP default) never leaks through (got ${res.body?.lat},${res.body?.lng})`)
}

// 2e. even with NO coords anywhere, the canonical name still returns (the
//     client geocodes it, station-guarded)
{
  globalThis.fetch = async (url) => {
    const s = String(url)
    if (s.includes('goo.gl')) return redirect('https://www.google.com/maps/place/Lau+Haa+Hot+Pot/data=!4m2!3m1!1s0xdead')
    return page('<html>nothing useful</html>')
  }
  const res = mkRes()
  await handler({ query: { url: 'https://maps.app.goo.gl/nameonly1' } }, res)
  ok(res.body?.lat === undefined && res.body?.name === 'Lau Haa Hot Pot',
    `no coords but name survives for the client fallback (got ${res.body?.name})`)
  ok(String(res.headers['Cache-Control']) === 'no-store', 'name-only result not edge-cached')
}

// 3. everything blocked → NO edge caching of the failure
{
  globalThis.fetch = async () => page('<html>sorry</html>', 429)
  const res = mkRes()
  await handler({ query: { url: 'https://maps.app.goo.gl/blocked9' } }, res)
  ok(res.body?.lat === undefined, 'no coords when fully blocked')
  ok(String(res.headers['Cache-Control']) === 'no-store', `failure NOT cached at the edge (got ${res.headers['Cache-Control']})`)
  ok(res.body?.error === 'no coords' && typeof res.body?.status === 'number', 'failure explains itself (error + upstream status)')
}

// 4. amap short link → hop URL carries p=<poi>,<lat>,<lng>,<name> (GCJ→WGS)
{
  globalThis.fetch = async (url) => {
    const s = String(url)
    if (s.includes('surl.amap.com')) return redirect('https://wb.amap.com/?p=B0FFG,31.2304,121.4737,%E5%BA%97%E5%90%8D,addr')
    return page('')
  }
  const res = mkRes()
  await handler({ query: { url: 'https://surl.amap.com/zzz' } }, res)
  ok(typeof res.body?.lat === 'number' && Math.abs(res.body.lat - 31.2304) < 0.01,
    `amap p= coords converted (got ${res.body?.lat},${res.body?.lng})`)
}

// 2g. the specific real-world flakiness: the ORIGINAL link (with its share-
//     tracking param) hits a blocked/challenged response, but the SAME link
//     with the tracking param stripped resolves cleanly — this is what
//     recovers a real Google coordinate instead of settling for a fallback
{
  globalThis.fetch = async (url) => {
    const s = String(url)
    if (s.includes('goo.gl/flaky1?g_st=ic')) return page('<html>blocked</html>', 429) // original: blocked
    if (s.includes('goo.gl/flaky1')) return redirect('https://www.google.com/maps/place/Flaky/@1,2,17z/data=!3d22.29!4d114.17') // stripped: clean
    return page('', 500)
  }
  const res = mkRes()
  await handler({ query: { url: 'https://maps.app.goo.gl/flaky1?g_st=ic' } }, res)
  ok(Math.abs((res.body?.lat ?? 0) - 22.29) < 1e-6,
    `stripping the tracking param recovers a real coordinate when the original attempt is blocked (got ${res.body?.lat})`)
}

// 2h. same flakiness, but this time the block is non-deterministic rather
//     than tied to the query string — a plain retry of the SAME url succeeds
//     the second time. Confirms the retry-of-original attempt actually fires.
{
  let calls = 0
  globalThis.fetch = async (url) => {
    const s = String(url)
    if (s.includes('goo.gl/flaky2')) {
      calls++
      if (calls < 2) return page('<html>blocked</html>', 429) // fails on the first try…
      return redirect('https://www.google.com/maps/place/Flaky2/@1,2,17z/data=!3d22.30!4d114.18') // …succeeds on the retry
    }
    return page('', 500)
  }
  const res = mkRes()
  await handler({ query: { url: 'https://maps.app.goo.gl/flaky2' } }, res)
  ok(Math.abs((res.body?.lat ?? 0) - 22.30) < 1e-6,
    `a plain retry recovers a real coordinate from a non-deterministically blocked link (got ${res.body?.lat})`)
}

globalThis.fetch = realFetch
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
