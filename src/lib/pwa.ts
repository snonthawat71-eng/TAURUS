import { registerSW } from 'virtual:pwa-register'
import { toast } from './toast'

/**
 * Service-worker registration with user-controlled updates.
 *
 * The build is a PWA (`registerType: 'prompt'`): when a newer service worker is
 * found it waits, and we surface a toast with an "อัปเดต" button. Tapping it
 * applies the new worker and reloads — so an update never interrupts the user
 * mid-task. The reload is safe: the Supabase session lives in localStorage
 * (`persistSession`), so they stay signed in across the update.
 *
 * The browser only looks for a new worker on a fresh navigation, so a tab (or
 * installed PWA) left open would never notice a deploy on its own. To surface the
 * red "อัปเดต" bar quickly WITHOUT making the user quit & reopen, we re-check for
 * a new build often: on a short timer, whenever the app regains focus/visibility,
 * and when the network reconnects.
 */
const CHECK_EVERY = 15 * 60 * 1000 // re-check for a new deploy every 15 min while open

export function registerPWA() {
  if (!('serviceWorker' in navigator)) return

  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, reg) {
      if (!reg) return
      const check = () => { reg.update().catch(() => {}) }
      // periodic check while the app stays open
      setInterval(check, CHECK_EVERY)
      // check whenever the tab/PWA comes back to the foreground...
      const onVisible = () => { if (document.visibilityState === 'visible') check() }
      document.addEventListener('visibilitychange', onVisible)
      window.addEventListener('focus', check)
      // ...and right after the network comes back (e.g. phone left the app for a while)
      window.addEventListener('online', check)
      // and once shortly after load, in case a deploy happened seconds ago
      setTimeout(check, 10 * 1000)
    },
    onNeedRefresh() {
      // ttl: 0 → stays until the user acts; kind 'error' → red bar; key → only
      // ever one update prompt (later checks replace it instead of stacking)
      toast.action(
        'มีเวอร์ชันใหม่ของ TAURUS',
        { label: 'อัปเดต', run: () => updateSW(true) },
        { kind: 'error', ttl: 0, key: 'sw-update' },
      )
    },
  })
}
