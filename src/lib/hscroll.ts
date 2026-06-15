// Attach to a horizontally-scrolling element via `ref={hscroll}` so a normal
// mouse wheel (vertical) scrolls it sideways on desktop. Used for filter strips.
export function hscroll(el: HTMLDivElement | null) {
  if (!el) return
  const onWheel = (e: WheelEvent) => {
    if (!e.deltaY || el.scrollWidth <= el.clientWidth) return
    e.preventDefault()
    el.scrollLeft += e.deltaY
  }
  el.addEventListener('wheel', onWheel, { passive: false })
  return () => el.removeEventListener('wheel', onWheel)
}
