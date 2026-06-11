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

  if (isAndroid()) {
    // geo: lets Android offer the installed map app (AMap / Google Maps / Baidu…)
    window.location.href = query ? `geo:0,0?q=${encodeURIComponent(query)}` : url
    return
  }
  if (isiOS()) {
    // maps:// opens the Apple Maps app; the original https link also deep-links to it
    window.location.href = query ? `maps://?q=${encodeURIComponent(query)}` : url
    return
  }
  // Desktop
  window.open(url, '_blank', 'noopener,noreferrer')
}
