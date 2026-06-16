// Open a place in the user's real map app on mobile, falling back to web on desktop.
// We pull a search query out of the stored URL and route it to a native scheme so
// the OS opens an installed map app (AMap / Google Maps / Apple Maps) instead of a
// web page.

function isiOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isAndroid() {
  return /android/i.test(navigator.userAgent)
}

/** Pull a human query (place name / coords) out of a stored map URL. */
function extractQuery(url: string): string | null {
  try {
    const u = new URL(url)
    const q = u.searchParams.get('q') || u.searchParams.get('keyword') || u.searchParams.get('query')
    if (q) return q
    // Apple/Google "@lat,lng" or "/place/Name"
    const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (at) return `${at[1]},${at[2]}`
  } catch { /* not a URL */ }
  return null
}

export function openMap(url: string | null | undefined) {
  if (!url) return
  const query = extractQuery(url)

  // Pick the best target: a native scheme on mobile so an installed map app
  // wins; otherwise the original link (iOS Universal Links / Android App Links
  // still route to the installed app when present, else fall back to the web).
  let target = url
  if (isAndroid() && query) target = `geo:0,0?q=${encodeURIComponent(query)}`
  else if (isiOS() && query) target = `maps://?q=${encodeURIComponent(query)}`

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
