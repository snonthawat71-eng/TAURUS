// Dark mode. Preference: 'light' | 'dark' | 'system' — stored on-device and
// applied as html[data-theme='dark'] (tokens flip in index.css). An inline
// script in index.html applies it pre-paint so there's no white flash.
export type ThemePref = 'light' | 'dark' | 'system'

const KEY = 'taurus:theme'

export function themePref(): ThemePref {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

export function isDarkNow(): boolean {
  const p = themePref()
  return p === 'dark' || (p === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

/** The page background for the current theme — used for theme-color metas etc. */
export function canvasColor(): string {
  return isDarkNow() ? '#0f131b' : '#f6f8fb'
}

export function applyTheme() {
  const dark = isDarkNow()
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  // keep the browser chrome in step (ProfileChrome overrides this on /profile)
  if (window.location.pathname !== '/profile') {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', canvasColor())
  }
}

export function setThemePref(p: ThemePref) {
  try { localStorage.setItem(KEY, p) } catch { /* best-effort */ }
  applyTheme()
}

/** Apply now + follow system changes while in 'system' mode. */
export function initTheme() {
  applyTheme()
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themePref() === 'system') applyTheme()
  })
}
