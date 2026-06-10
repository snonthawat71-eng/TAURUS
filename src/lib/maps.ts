// Open a place in the user's real map app when on mobile, falling back to web.
// Full per-platform deep linking (AMap / Naver / Google) is refined later;
// this already prefers the native app via geo:/maps URIs on mobile.

function isiOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isAndroid() {
  return /android/i.test(navigator.userAgent)
}

export function openMap(url: string | null | undefined) {
  if (!url) return
  // If it's already a maps.apple/google link, just open it — the OS will route
  // it to the installed app on mobile.
  if (isiOS() || isAndroid()) {
    window.location.href = url
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
