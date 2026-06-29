import { registerSW } from 'virtual:pwa-register'
import { toast } from './toast'

/**
 * Service-worker registration with a RELIABLE, user-controlled update prompt.
 *
 * registerType is 'prompt': a new build waits until the user taps "อัปเดต".
 * The normal path is the SW's onNeedRefresh, but that depends on the browser
 * noticing a new worker at the right moment, which isn't reliable. So we ALSO
 * check the deployed index.html directly (cache-busted) and compare its hashed
 * main bundle to the one we're running — if they differ, a new build is live and
 * we show the bar. This runs on load, on focus/visibility, on reconnect, and on
 * a timer, so the "อัปเดต" bar appears every time there's a new version.
 *
 * Tapping it activates the new worker and reloads (the Supabase session lives in
 * localStorage, so the user stays signed in).
 */
const CHECK_EVERY = 10 * 60 * 1000 // re-check for a new deploy every 10 min while open

/** The hash of the main bundle the page is currently running (…/assets/index-XXXX.js). */
function currentBuildTag(): string | null {
  const src = Array.from(document.scripts).map((s) => s.src).find((s) => /\/assets\/index-[\w-]+\.js/.test(s))
  return src?.match(/index-([\w-]+)\.js/)?.[1] ?? null
}

export function registerPWA() {
  if (!('serviceWorker' in navigator)) return

  let reg: ServiceWorkerRegistration | null = null
  let promptedFor: string | null = null

  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, r) { if (r) reg = r },
    onNeedRefresh() { showBar() },
  })

  function showBar() {
    // ttl:0 → stays until acted on; kind 'error' → red bar; key → only ever one
    toast.action(
      'มีเวอร์ชันใหม่ของ TAURUS',
      { label: 'อัปเดต', run: applyUpdate },
      { kind: 'error', ttl: 0, key: 'sw-update' },
    )
  }

  async function applyUpdate() {
    try { await reg?.update() } catch { /* offline */ }
    await new Promise((r) => setTimeout(r, 1000)) // let the new worker reach "waiting"
    try { await updateSW(true) } catch { /* no waiting worker */ }
    setTimeout(() => location.reload(), 800) // hard fallback if the worker didn't reload us
  }

  // Direct check against the live index.html — independent of SW timing.
  async function checkForUpdate() {
    reg?.update().catch(() => {}) // also nudge the normal SW path
    const cur = currentBuildTag()
    if (!cur) return // dev server / no hashed bundle
    try {
      const res = await fetch(`/?_ts=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) return
      const latest = (await res.text()).match(/\/assets\/index-([\w-]+)\.js/)?.[1]
      if (latest && latest !== cur && promptedFor !== latest) {
        promptedFor = latest
        showBar()
      }
    } catch { /* offline — ignore */ }
  }

  setInterval(checkForUpdate, CHECK_EVERY)
  const onVisible = () => { if (document.visibilityState === 'visible') checkForUpdate() }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', checkForUpdate)
  window.addEventListener('online', checkForUpdate)
  setTimeout(checkForUpdate, 8 * 1000) // shortly after load, in case a deploy just landed
}
