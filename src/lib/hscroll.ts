// Attach to a horizontally-scrolling element via `ref={hscroll}` so a normal
// mouse wheel (vertical) scrolls it sideways on desktop, and the strip can be
// dragged left/right with the mouse. Used for filter strips / chip rows.
export function hscroll(el: HTMLDivElement | null) {
  if (!el) return
  const onWheel = (e: WheelEvent) => {
    if (!e.deltaY || el.scrollWidth <= el.clientWidth) return
    e.preventDefault()
    el.scrollLeft += e.deltaY
  }

  // Click-and-drag to scroll (desktop / mouse only — touch scrolls natively).
  let down = false
  let dragged = false
  let startX = 0
  let startLeft = 0

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    if (el.scrollWidth <= el.clientWidth) return
    down = true
    dragged = false
    startX = e.clientX
    startLeft = el.scrollLeft
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!down) return
    const dx = e.clientX - startX
    if (!dragged && Math.abs(dx) < 4) return
    if (!dragged) {
      dragged = true
      el.setPointerCapture(e.pointerId)
      el.style.cursor = 'grabbing'
      el.style.userSelect = 'none'
    }
    e.preventDefault()
    el.scrollLeft = startLeft - dx
  }
  const endDrag = (e: PointerEvent) => {
    if (!down) return
    down = false
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
    el.style.cursor = ''
    el.style.userSelect = ''
  }
  // Swallow the click that fires after a drag so chips aren't accidentally tapped.
  const onClick = (e: MouseEvent) => {
    if (dragged) {
      e.stopPropagation()
      e.preventDefault()
      dragged = false
    }
  }

  el.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('pointerdown', onPointerDown)
  el.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerup', endDrag)
  el.addEventListener('pointercancel', endDrag)
  el.addEventListener('click', onClick, true)
  return () => {
    el.removeEventListener('wheel', onWheel)
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', endDrag)
    el.removeEventListener('pointercancel', endDrag)
    el.removeEventListener('click', onClick, true)
  }
}
