import { registerSW } from 'virtual:pwa-register'

/**
 * Service-worker registration with active update checks.
 *
 * The build is a PWA (`registerType: 'autoUpdate'`): when a newer service
 * worker is found, vite-plugin-pwa reloads the page so the new version takes
 * over. The catch is that the browser only *looks* for a new worker on a fresh
 * navigation — so a tab (or installed PWA) left open for hours keeps running the
 * old build until something breaks and you have to close it / sign out to
 * recover.
 *
 * To avoid that, we poll for a new deploy on a timer and whenever the app
 * regains focus. The reload that follows is safe: the Supabase session lives in
 * localStorage (`persistSession`), so you stay signed in across the update.
 */
const CHECK_EVERY = 60 * 60 * 1000 // re-check for a new deploy hourly while open

export function registerPWA() {
  if (!('serviceWorker' in navigator)) return

  registerSW({
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
  })
}
