// Tests for the TripMap rail overlay data path (no framework — run with:
//   node scripts/test-rail.mjs
// after `npx esbuild src/lib/railOverlay.ts --bundle --format=esm` output is
// produced by this script itself). Covers:
//  1. railShapes(): real Overpass `out geom` shaped fixture → coloured lines
//     + station dots (dedupe, platform/stop skip, clipped members, colours)
//  2. api/rail.js handler: bbox validation, mirror fallback, edge-cache
//     header, all-mirrors-down → 502
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let pass = 0, fail = 0
const ok = (cond, name) => { if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}`) } }

// ---- build the TS module to something Node can import ----
const dir = mkdtempSync(join(tmpdir(), 'railtest-'))
execSync(`npx esbuild src/lib/railOverlay.ts --bundle --format=esm --outfile=${join(dir, 'railOverlay.mjs')}`, { stdio: 'pipe' })
const { railShapes, railQuery, fetchRailElements } = await import(join(dir, 'railOverlay.mjs'))

// ---- 1. railShapes ----
console.log('railShapes()')
// fixture mirrors Overpass `out geom` output: per-direction duplicate
// relations, platform members, clipped (geometry-less) members, station nodes
const fixture = [
  {
    type: 'relation', id: 1,
    tags: { route: 'subway', ref: 'TWL', name: 'Tsuen Wan Line', colour: '#E2231A' },
    members: [
      { type: 'way', role: '', geometry: [{ lat: 22.30, lon: 114.16 }, { lat: 22.31, lon: 114.17 }] },
      { type: 'way', role: 'platform', geometry: [{ lat: 22.301, lon: 114.161 }] },
      { type: 'node', role: 'stop' },
      { type: 'way', role: '' }, // clipped out — no geometry
    ],
  },
  { // opposite direction of the same line → must dedupe
    type: 'relation', id: 2,
    tags: { route: 'subway', ref: 'TWL', name: 'Tsuen Wan Line (reverse)', colour: '#E2231A' },
    members: [{ type: 'way', role: '', geometry: [{ lat: 22.31, lon: 114.17 }, { lat: 22.30, lon: 114.16 }] }],
  },
  { // bare-hex colour (no #) must be tolerated
    type: 'relation', id: 3,
    tags: { route: 'subway', ref: 'ISL', colour: '0860A8' },
    members: [{ type: 'way', role: '', geometry: [{ lat: 22.28, lon: 114.15 }, { lat: 22.28, lon: 114.19 }] }],
  },
  { // no colour tag → grey fallback
    type: 'relation', id: 4,
    tags: { route: 'tram', name: 'HK Tramways' },
    members: [{ type: 'way', role: '', geometry: [{ lat: 22.279, lon: 114.17 }, { lat: 22.28, lon: 114.18 }] }],
  },
  { type: 'node', id: 5, lat: 22.305, lon: 114.165, tags: { railway: 'station', station: 'subway', name: 'Tsim Sha Tsui' } },
  { type: 'node', id: 6, tags: { railway: 'station', station: 'subway' } }, // clipped node without coords → skip
]
const s = railShapes(fixture)
ok(s.lines.length === 3, `3 polylines drawn (got ${s.lines.length}) — dedupe + platform/clipped skip`)
ok(s.lines[0].color === '#E2231A' && s.lines[0].points.length === 2, 'TWL keeps its red colour + 2 points')
ok(s.lines[1].color === '#0860A8', `bare-hex colour normalised (got ${s.lines[1].color})`)
ok(s.lines[2].color === '#7A8699', `missing colour falls back to grey (got ${s.lines[2].color})`)
ok(s.stations.length === 1 && s.stations[0][0] === 22.305, '1 station dot with coords')
ok(railShapes([]).lines.length === 0, 'empty input → empty output')

// real `out geom(bbox)` responses null-out vertices beyond the bbox on ways
// crossing the boundary — this crashed the first production draw (silently)
const clipped = railShapes([{
  type: 'relation', id: 9, tags: { ref: 'X', colour: '#123456' },
  members: [{ type: 'way', role: '', geometry: [null, { lat: 22.3, lon: 114.1 }, { lat: 22.31, lon: 114.12 }, null, { lat: 22.35, lon: 114.2 }] }],
}])
ok(clipped.lines.length === 1, `null boundary vertices split into runs, no crash (got ${clipped.lines.length} lines)`)
ok(clipped.lines[0].points.length === 2, 'run keeps only contiguous in-bbox vertices')

// ---- 2. query sanity ----
console.log('railQuery()')
const q = railQuery('22.2,114.1,22.4,114.3')
ok(q.includes('out geom(22.2,114.1,22.4,114.3)'), 'uses `out geom(bbox)` (NOT `out tags geom`)')
ok(!q.includes('out tags'), 'no tags verbosity anywhere')
ok(/route.*subway\|light_rail\|monorail\|tram/.test(q), 'covers subway/light_rail/monorail/tram')

// ---- 3. api/rail.js handler ----
console.log('api/rail.js handler')
const { default: handler } = await import('../api/rail.js')
const mkRes = () => {
  const r = { code: 200, headers: {}, body: null }
  r.status = (c) => { r.code = c; return r }
  r.setHeader = (k, v) => { r.headers[k] = v }
  r.json = (b) => { r.body = b; return r }
  return r
}
const realFetch = globalThis.fetch

// bad bbox → 400
{
  const res = mkRes()
  await handler({ query: { bbox: 'DROP TABLE' } }, res)
  ok(res.code === 400, `rejects malformed bbox with 400 (got ${res.code})`)
}
// first mirror down, second returns data → 200 + edge cache header
{
  let calls = 0
  globalThis.fetch = async (url) => {
    calls++
    if (calls === 1) throw new Error('mirror down')
    return { ok: true, json: async () => ({ elements: fixture }) }
  }
  const res = mkRes()
  await handler({ query: { bbox: '22.2,114.1,22.4,114.3' } }, res)
  ok(res.code === 200 && res.body?.elements?.length === fixture.length, `mirror fallback works, elements passed through (got ${res.body?.elements?.length})`)
  ok(String(res.headers['Cache-Control'] || '').includes('s-maxage'), 'sets edge-cache header')
  ok(calls === 2, `tried exactly 2 mirrors (got ${calls})`)
}
// every mirror down → 502 (client then falls back to direct Overpass)
{
  globalThis.fetch = async () => { throw new Error('down') }
  const res = mkRes()
  await handler({ query: { bbox: '22.2,114.1,22.4,114.3' } }, res)
  ok(res.code === 502, `all mirrors down → 502 (got ${res.code})`)
}
// upstream returns non-JSON/HTML (SPA rewrite mishap) → next mirror, then 502
{
  globalThis.fetch = async () => ({ ok: true, json: async () => { throw new Error('not json') } })
  const res = mkRes()
  await handler({ query: { bbox: '22.2,114.1,22.4,114.3' } }, res)
  ok(res.code === 502, `non-JSON upstream bodies don't crash the handler (got ${res.code})`)
}
globalThis.fetch = realFetch

// ---- 4. fetchRailElements (client chain: /api/rail → direct mirrors) ----
console.log('fetchRailElements()')
{
  const steps = []
  globalThis.fetch = async (url) => {
    if (String(url).startsWith('/api/rail')) return { ok: true, json: async () => ({ elements: fixture }) }
    throw new Error('unexpected')
  }
  const els = await fetchRailElements('22.2,114.1,22.4,114.3', new AbortController().signal, (s) => steps.push(s))
  ok(els?.length === fixture.length, `proxy path returns elements (got ${els?.length})`)
  ok(steps.some((s) => s.includes('สำเร็จ')), 'reports success step')
}
{
  const steps = []
  globalThis.fetch = async (url) => {
    if (String(url).startsWith('/api/rail')) return { ok: false, status: 404, json: async () => ({}) }
    return { ok: true, json: async () => ({ elements: fixture }) } // first direct mirror succeeds
  }
  const els = await fetchRailElements('22.2,114.1,22.4,114.3', new AbortController().signal, (s) => steps.push(s))
  ok(els?.length === fixture.length, `404 proxy → direct mirror fallback works (got ${els?.length})`)
  ok(steps.some((s) => s.includes('404')), 'reports the 404 hop')
}
{
  globalThis.fetch = async () => { throw new Error('network down') }
  const els = await fetchRailElements('22.2,114.1,22.4,114.3', new AbortController().signal)
  ok(els === null, 'everything down → null (caller shows error toast)')
}
{
  // master abort must propagate out as a throw, not fall through the chain
  const ctrl = new AbortController()
  globalThis.fetch = async (_u, init) => new Promise((_res, rej) => {
    const sig = init?.signal
    if (sig?.aborted) return rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    sig?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))
  })
  const p = fetchRailElements('22.2,114.1,22.4,114.3', ctrl.signal)
  setTimeout(() => ctrl.abort(), 50)
  let threw = false
  try { await p } catch { threw = true }
  ok(threw, 'master abort cancels the whole chain')
}
globalThis.fetch = realFetch

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
