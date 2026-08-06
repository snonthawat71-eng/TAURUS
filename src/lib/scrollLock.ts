// One body-scroll lock for the whole app, reference counted.
//
// Every sheet used to save the body's styles itself and put them back on close.
// That breaks the moment two of them overlap — the stop editor opening the
// quick Explore picker, say. The inner sheet saves the styles the outer one
// already applied, a re-render makes the outer sheet re-save the inner's, and
// when both close the page is left `position: fixed` with no sheet on screen:
// buttons still work, nothing scrolls.
//
// So: the first lock stores the real page state and applies the lock, every
// lock after it just counts, and only the last release restores. Each caller
// gets its own release function that can be called once.
//
// The lock is `position: fixed` rather than `overflow: hidden` because iOS
// composites the on-screen keyboard over a snapshot of the whole page: with a
// long page behind a sheet, the part under the keyboard's toolbar kept showing
// through. Clipping the body to the viewport (and painting the root the surface
// colour) leaves nothing to show through.
interface Saved {
  htmlBg: string; bodyBg: string; htmlH: string
  position: string; top: string; width: string; overflow: string; height: string
}

let depth = 0
let saved: Saved | null = null
let scrollY = 0

export function lockScroll(): () => void {
  const html = document.documentElement
  const body = document.body
  if (depth === 0) {
    scrollY = window.scrollY
    saved = {
      htmlBg: html.style.backgroundColor, bodyBg: body.style.backgroundColor,
      htmlH: html.style.height, position: body.style.position,
      top: body.style.top, width: body.style.width,
      overflow: body.style.overflow, height: body.style.height,
    }
    html.style.backgroundColor = 'var(--color-surface)'
    body.style.backgroundColor = 'var(--color-surface)'
    html.style.height = '100%'
    body.style.height = '100%'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
  }
  depth++

  let released = false
  return () => {
    if (released) return
    released = true
    depth = Math.max(0, depth - 1)
    if (depth > 0 || !saved) return
    html.style.backgroundColor = saved.htmlBg
    body.style.backgroundColor = saved.bodyBg
    html.style.height = saved.htmlH
    body.style.height = saved.height
    body.style.overflow = saved.overflow
    body.style.position = saved.position
    body.style.top = saved.top
    body.style.width = saved.width
    saved = null
    window.scrollTo(0, scrollY)
  }
}
