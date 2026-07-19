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
  ok(String(res.headers['Cache-Control']).includes('s-maxage'), 'success IS edge-cached')
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

globalThis.fetch = realFetch
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
