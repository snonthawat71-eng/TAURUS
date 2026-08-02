// Open a place for navigation. Always routes to GOOGLE MAPS (never Apple Maps) —
// a Google link opens as-is (the Google Maps app catches it via universal/app
// links when installed, else the web); anything else becomes a Google Maps
// search. AMap (China) links keep going to AMap.

/** Pull a human query (place name / coords) out of a stored map URL. */
function extractQuery(url: string): string | null {
  try {
    const u = new URL(url)
    for (const key of ['q', 'keyword', 'query', 'destination', 'daddr', 'll', 'sll']) {
      const v = u.searchParams.get(key)
      if (v?.trim()) return v.trim()
    }
  } catch { /* not a URL */ }
  // the place's own "!3d..!4d.." point, the "@lat,lng" view centre, then any
  // bare coordinate pair (covers geo: / maps:// / a pasted "lat,lng")
  const m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
    || url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    || url.match(/(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/)
  return m ? `${m[1]},${m[2]}` : null
}

const isAmap = (url: string) => /amap\.com|gaode|surl\.amap/i.test(url)
const isGoogle = (url: string) =>
  /google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps|share\.google|g\.co\/kgs/i.test(url)

/** A Google URL whose ONLY payload is a bare "lat,lng" in q= / query= — i.e. a
 *  coordinate pin we stamped ourselves, not a real place link. Detected by
 *  parsing the params (so it catches google.com/maps?q=, maps.google.com/?q=,
 *  any country domain), never by matching the whole string. */
function coordOnlyGoogle(url: string): { lat: string; lng: string } | null {
  try {
    const u = new URL(url)
    if (!/(^|\.)google\.[a-z.]+$/i.test(u.hostname)) return null
    for (const key of ['q', 'query']) {
      const v = u.searchParams.get(key)?.trim()
      if (!v) continue
      const m = v.match(/^(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)$/)
      if (m) return { lat: m[1], lng: m[2] }
    }
  } catch { /* not a URL */ }
  return null
}

/** The link `openMap` would open — also what we hand to anyone we share a place
 *  with, so a shared pin lands in the same place tapping it here would.
 *
 *  AMap links → AMap. A Google link → itself (the app catches it via universal
 *  links). Everything else (bare coords, an Apple link, a name) → a Google Maps
 *  search, so it NEVER lands in Apple Maps. */
export function mapLinkFor(url: string | null | undefined): string | null {
  const raw = url?.trim()
  if (!raw) return null
  if (isAmap(raw)) return raw
  if (isGoogle(raw)) {
    // A stamped coordinate pin used "…/maps?q=lat,lng", which is NOT part of the
    // Maps URLs API — the Google Maps app rejects it ("unsupported link"). Send
    // the official search form instead. Done at open time, so rows already in
    // the database heal themselves with no migration.
    const c = coordOnlyGoogle(raw)
    return c ? `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}` : raw
  }
  const query = extractQuery(raw) ?? raw
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/** A Google Maps search for a place we hold no link for — its name, narrowed by
 *  the city so a chain doesn't land on the wrong branch. */
export function mapSearchLink(name: string | null | undefined, city?: string | null): string | null {
  const q = [name, city].map((s) => (s ?? '').trim()).filter(Boolean).join(' ')
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null
}

export function openMap(url: string | null | undefined) {
  const target = mapLinkFor(url)
  if (!target) return

  // Trigger via a transient anchor opening a new context. Crucially we never set
  // the current document's location, so the SPA stays mounted and its images
  // don't reload/flash. The click happens inside a user gesture, so deep links
  // are honored.
  const a = document.createElement('a')
  a.href = target
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
