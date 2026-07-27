import { registerSW } from 'virtual:pwa-register'
import { toast } from './toast'

/**
 * Service-worker registration with a two-mode update policy:
 *
 *  • AT BOOT — the user just opened the app and has nothing in progress, so a
 *    newer live build is applied SILENTLY: download the new worker, activate
 *    it, reload once. Fresh arrivals always land on the latest version without
 *    ever seeing a prompt.
 *  • MID-SESSION — a deploy that lands while the user is working must never
 *    yank the app out from under them: show the "อัปเดต" bar and let them
 *    choose when (checked on a timer, on focus/visibility, on reconnect).
 *
 * Both paths activate the new worker in LOCK-STEP: reload fires on
 * controllerchange (the new worker actually took over), never on a blind
 * timer — a fixed sleep used to reload into the OLD cached shell when the
 * download hadn't finished, which re-showed the bar in a loop. A per-build
 * sessionStorage marker breaks any residual silent-reload loop: one silent
 * attempt per build, then fall back to the manual bar.
 *
 * (registerType stays 'prompt' in vite.config.ts — activation timing is fully
 * ours via updateSW(true). The Supabase session lives in localStorage, so a
 * reload keeps the user signed in.)
 */
const CHECK_EVERY = 10 * 60 * 1000 // re-check for a new deploy every 10 min while open
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type UpdateCheck = 'updating' | 'latest' | 'offline'
let manualCheck: (() => Promise<UpdateCheck>) | null = null

/** Force an update check from the UI (Settings → ตรวจหาอัปเดต). Silent boot
 *  updates mean the prompt bar normally never appears — this guarantees there
 *  is ALWAYS a way to pull a new build by hand, even if the silent path is
 *  stuck (offline at boot, a worker that never reached "waiting", …). */
export async function checkForUpdateNow(): Promise<UpdateCheck> {
  return manualCheck ? manualCheck() : 'latest'
}

/** The hash of the main bundle the page is currently running (…/assets/index-XXXX.js). */
function currentBuildTag(): string | null {
  const src = Array.from(document.scripts).map((s) => s.src).find((s) => /\/assets\/index-[\w-]+\.js/.test(s))
  return src?.match(/index-([\w-]+)\.js/)?.[1] ?? null
}

export function registerPWA() {
  if (!('serviceWorker' in navigator)) return

  let reg: ServiceWorkerRegistration | null = null
  let promptedFor: string | null = null
  let updating = false // a silent boot update is in flight — suppress the bar

  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, r) { if (r) reg = r },
    onNeedRefresh() { if (!updating) showBar() },
  })

  function showBar() {
    // ttl:0 → stays until acted on; kind 'error' → red bar; key → only ever one
    toast.action(
      'มีเวอร์ชันใหม่ของ TAURUS',
      { label: 'อัปเดต', run: applyUpdate },
      { kind: 'error', ttl: 0, key: 'sw-update' },
    )
  }

  /** Wait for the freshly-downloaded worker to reach "waiting" (installed). */
  async function waitingWorker(timeoutMs: number): Promise<ServiceWorker | null> {
    const t0 = Date.now()
    while (Date.now() - t0 < timeoutMs) {
      if (reg?.waiting) return reg.waiting
      await sleep(250)
    }
    return reg?.waiting ?? null
  }

  /** Activate the waiting worker and reload IN LOCK-STEP: the reload fires on
   *  controllerchange — i.e. the new worker really took over, so the reloaded
   *  page is served by the NEW build. A short timer is only a hard fallback. */
  async function activateAndReload(fallbackMs: number) {
    let reloaded = false
    const doReload = () => { if (!reloaded) { reloaded = true; location.reload() } }
    navigator.serviceWorker.addEventListener('controllerchange', doReload, { once: true })
    try { await updateSW(true) } catch { /* no waiting worker */ }
    setTimeout(doReload, fallbackMs)
  }

  // manual path — the bar's "อัปเดต" button
  async function applyUpdate() {
    updating = true
    try { await reg?.update() } catch { /* offline */ }
    await waitingWorker(15_000) // wait for the real install, not a blind 1s
    await activateAndReload(2_500)
  }

  /** Silent boot update. False only when the new worker never reached
   *  "waiting" (download stuck/offline) — caller falls back to the bar. */
  async function silentUpdate(): Promise<boolean> {
    updating = true
    try { await reg?.update() } catch { /* offline */ }
    const w = await waitingWorker(20_000)
    if (!w) { updating = false; return false }
    await activateAndReload(2_500)
    return true
  }

  /** The bundle hash of the LIVE deployment (cache-busted fetch of index.html). */
  async function latestBuildTag(): Promise<string | null> {
    try {
      const res = await fetch(`/?_ts=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) return null
      return (await res.text()).match(/\/assets\/index-([\w-]+)\.js/)?.[1] ?? null
    } catch { return null } // offline — ignore
  }

  async function checkForUpdate(atBoot = false) {
    reg?.update().catch(() => {}) // also nudge the normal SW path
    const cur = currentBuildTag()
    if (!cur) return // dev server / no hashed bundle
    const latest = await latestBuildTag()
    if (!latest || latest === cur) return
    if (atBoot) {
      // one silent attempt per build per tab-session: if we already tried and
      // are STILL on the old build, something's stuck — show the bar instead
      // of reload-looping
      const key = `sw-auto:${latest}`
      let tried = false
      try { tried = sessionStorage.getItem(key) === '1' } catch { /* ignore */ }
      if (!tried) {
        try { sessionStorage.setItem(key, '1') } catch { /* ignore */ }
        if (await silentUpdate()) return
      }
    }
    if (promptedFor !== latest) {
      promptedFor = latest
      showBar()
    }
  }

  manualCheck = async () => {
    const cur = currentBuildTag()
    const latest = await latestBuildTag()
    if (!latest) return 'offline'
    if (cur && latest === cur) return 'latest'
    void applyUpdate() // installs, then reloads on controllerchange
    return 'updating'
  }

  setInterval(() => checkForUpdate(), CHECK_EVERY)
  const onVisible = () => { if (document.visibilityState === 'visible') checkForUpdate() }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', () => checkForUpdate())
  window.addEventListener('online', () => checkForUpdate())
  checkForUpdate(true) // right at boot — a newer live build swaps in silently
}
