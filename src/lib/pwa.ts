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
 * installed PWA) left open for hours would never notice a deploy. To fix that we
 * poll for a new build on a timer and whenever the app regains focus.
 */
const CHECK_EVERY = 60 * 60 * 1000 // re-check for a new deploy hourly while open

export function registerPWA() {
  if (!('serviceWorker' in navigator)) return

  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, reg) {
      if (!reg) return
      // periodic check while the app stays open
      setInterval(() => { reg.update().catch(() => {}) }, CHECK_EVERY)
      // and an immediate check whenever the tab/PWA comes back to the foreground
      const check = () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}) }
      document.addEventListener('visibilitychange', check)
      window.addEventListener('focus', check)
    },
    onNeedRefresh() {
      // ttl: 0 → the toast stays until the user acts on it
      toast.action(
        'มีเวอร์ชันใหม่ของ TAURUS',
        { label: 'อัปเดต', run: () => updateSW(true) },
        { ttl: 0 },
      )
    },
  })
}
