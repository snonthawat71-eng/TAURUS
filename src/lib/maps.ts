// Open a place for navigation. Always routes to GOOGLE MAPS (never Apple Maps) —
// a Google link opens as-is (the Google Maps app catches it via universal/app
// links when installed, else the web); anything else becomes a Google Maps
// search. AMap (China) links keep going to AMap.

/** Pull a human query (place name / coords) out of a stored map URL. */
function extractQuery(url: string): string | null {
  try {
    const u = new URL(url)
    const q = u.searchParams.get('q') || u.searchParams.get('keyword') || u.searchParams.get('query')
    if (q) return q
    // "@lat,lng" or the place's own "!3d..!4d.." point
    const m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (m) return `${m[1]},${m[2]}`
  } catch { /* not a URL */ }
  return null
}

const isAmap = (url: string) => /amap\.com|gaode|surl\.amap/i.test(url)
const isGoogle = (url: string) => /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url)

export function openMap(url: string | null | undefined) {
  if (!url) return

  // AMap links → AMap. A Google link (incl. the coordinate URL we stamp on a
  // fixed pin) → open the Google link directly. Everything else (bare coords,
  // an Apple link, a name) → a Google Maps search so it NEVER lands in Apple Maps.
  let target: string
  if (isAmap(url) || isGoogle(url)) {
    // legacy stamped pins used "…/maps?q=lat,lng" — NOT part of the Maps URLs
    // API, and the Google Maps app rejects it as an unsupported link. Rewrite
    // to the official search form at open time (heals old rows, no migration).
    const coord = url.match(/google\.[a-z.]+\/maps\/?\?q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/i)
    target = coord ? `https://www.google.com/maps/search/?api=1&query=${coord[1]},${coord[2]}` : url
  } else {
    const query = extractQuery(url) ?? url
    target = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
  }

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
