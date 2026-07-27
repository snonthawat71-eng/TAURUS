import { registerSW } from 'virtual:pwa-register'
import { toast } from './toast'

/**
 * Service-worker registration with a RELIABLE, user-controlled update prompt.
 *
 * registerType is 'prompt': a new build ALWAYS waits until the user taps
 * "อัปเดต" — they should SEE that an update happened, so nothing is ever
 * swapped in behind their back. The normal path is the SW's onNeedRefresh, but
 * that depends on the browser noticing a new worker at the right moment, which
 * isn't reliable. So we ALSO check the deployed index.html directly
 * (cache-busted) and compare its hashed main bundle to the one we're running —
 * if they differ, a new build is live and we show the bar. This runs on load,
 * on focus/visibility, on reconnect, and on a timer, so the "อัปเดต" bar
 * appears every time there's a new version.
 *
 * Tapping it activates the new worker and reloads IN LOCK-STEP: wait for the
 * new worker to actually reach "waiting", then reload on controllerchange (it
 * really took over) — never on a blind timer. A fixed 1s sleep used to reload
 * into the OLD cached shell when the download hadn't finished, which re-showed
 * the bar over and over. (The Supabase session lives in localStorage, so the
 * reload keeps the user signed in.)
 */
const CHECK_EVERY = 10 * 60 * 1000 // re-check for a new deploy every 10 min while open
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type UpdateCheck = 'updating' | 'latest' | 'offline'
let manualCheck: (() => Promise<UpdateCheck>) | null = null

/** Check for a new build ON DEMAND (ตั้งค่าโปรไฟล์ → ตรวจหาอัปเดต). The bar is
 *  still the normal path — this is the manual backstop for when it doesn't pop
 *  up (offline at the moment of the deploy, a tab left open for days, …). */
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
  let updating = false // the user tapped อัปเดต — don't stack another bar on top

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

  async function applyUpdate() {
    updating = true
    try { await reg?.update() } catch { /* offline */ }
    await waitingWorker(15_000) // wait for the real install, not a blind 1s
    // reload the moment the new worker takes control, so the reloaded page is
    // served by the NEW build; the timer is only a hard fallback
    let reloaded = false
    const doReload = () => { if (!reloaded) { reloaded = true; location.reload() } }
    navigator.serviceWorker.addEventListener('controllerchange', doReload, { once: true })
    try { await updateSW(true) } catch { /* no waiting worker */ }
    setTimeout(doReload, 2_500)
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

  manualCheck = async () => {
    const cur = currentBuildTag()
    let latest: string | null = null
    try {
      const res = await fetch(`/?_ts=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) latest = (await res.text()).match(/\/assets\/index-([\w-]+)\.js/)?.[1] ?? null
    } catch { return 'offline' }
    if (!latest) return 'offline'
    if (cur && latest === cur) return 'latest'
    void applyUpdate() // installs, then reloads once the new worker takes over
    return 'updating'
  }

  setInterval(checkForUpdate, CHECK_EVERY)
  const onVisible = () => { if (document.visibilityState === 'visible') checkForUpdate() }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', checkForUpdate)
  window.addEventListener('online', checkForUpdate)
  setTimeout(checkForUpdate, 8 * 1000) // shortly after load, in case a deploy just landed
}
