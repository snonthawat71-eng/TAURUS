import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

// Pan + pinch-zoom pane. During a gesture we only mutate a CSS transform on the
// wrapper (no React re-render — the heavy SVG would stutter at 60fps), then
// commit the final zoom/pan to state on release so the map re-renders once at
// its true size (crisp). We own all touch handling (touch-action: none + native
// preventDefault, incl. iOS gesture events) so the page never pinch-bounces.
export function PinchZoomPane({ zoom, setZoom, min = 0.6, max = 3, className = '', children }: {
  zoom: number
  setZoom: (z: number) => void
  min?: number
  max?: number
  className?: string
  children: ReactNode
}) {
  const paneRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panRef = useRef(pan)
  panRef.current = pan
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const clampPan = (x: number, y: number, w: number, h: number) => {
    const pane = paneRef.current
    if (!pane) return { x, y }
    const pw = pane.clientWidth, ph = pane.clientHeight
    return {
      x: w <= pw ? (pw - w) / 2 : Math.min(0, Math.max(pw - w, x)),
      y: h <= ph ? (ph - h) / 2 : Math.min(0, Math.max(ph - h, y)),
    }
  }

  // re-centre / re-clamp committed pan when zoom changes via the +/- buttons
  useLayoutEffect(() => {
    const c = contentRef.current
    if (!c) return
    const p = clampPan(panRef.current.x, panRef.current.y, c.offsetWidth, c.offsetHeight)
    if (p.x !== panRef.current.x || p.y !== panRef.current.y) setPan(p)
  }, [zoom])

  useEffect(() => {
    const pane = paneRef.current, content = contentRef.current
    if (!pane || !content) return
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const mid = (t: TouchList, axis: 'X' | 'Y') => (t[0][`client${axis}`] + t[1][`client${axis}`]) / 2

    let mode: 'none' | 'pan' | 'pinch' = 'none'
    let Z0 = 1, baseW = 0, baseH = 0      // committed zoom + content size at gesture start
    let s = 1                              // live scale relative to Z0
    let P = { x: 0, y: 0 }                 // live top-left translate (px)
    // pinch snapshot
    let d0 = 0, s0 = 1, f0x = 0, f0y = 0, px0 = 0, py0 = 0
    // pan
    let lastX = 0, lastY = 0, moved = 0

    const draw = () => { content.style.transform = `translate(${P.x}px, ${P.y}px) scale(${s})` }
    const enter = () => { // initialise from committed state on the first finger down
      Z0 = zoomRef.current; baseW = content.offsetWidth; baseH = content.offsetHeight
      s = 1; P = { ...panRef.current }
    }
    const startPinch = (t: TouchList, rect: DOMRect) => {
      d0 = dist(t); s0 = s; f0x = mid(t, 'X') - rect.left; f0y = mid(t, 'Y') - rect.top; px0 = P.x; py0 = P.y
    }

    const onStart = (e: TouchEvent) => {
      if (mode === 'none') enter()
      const rect = pane.getBoundingClientRect()
      if (e.touches.length >= 2) { mode = 'pinch'; startPinch(e.touches, rect); e.preventDefault() }
      else { mode = 'pan'; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; moved = 0 }
    }
    const onMove = (e: TouchEvent) => {
      const rect = pane.getBoundingClientRect()
      if (mode === 'pinch' && e.touches.length >= 2) {
        e.preventDefault()
        s = Math.min(max / Z0, Math.max(min / Z0, s0 * (dist(e.touches) / d0)))
        const fx = mid(e.touches, 'X') - rect.left, fy = mid(e.touches, 'Y') - rect.top
        const u0x = (f0x - px0) / s0, u0y = (f0y - py0) / s0 // content point under the start focal
        P = { x: fx - u0x * s, y: fy - u0y * s }
        P = clampPan(P.x, P.y, baseW * s, baseH * s)
        draw()
      } else if (mode === 'pan' && e.touches.length === 1) {
        const dx = e.touches[0].clientX - lastX, dy = e.touches[0].clientY - lastY
        moved += Math.abs(dx) + Math.abs(dy)
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY
        if (moved > 4) {
          e.preventDefault()
          P = clampPan(P.x + dx, P.y + dy, baseW * s, baseH * s)
          draw()
        }
      }
    }
    const commit = () => {
      const finalZoom = Math.min(max, Math.max(min, Math.round(Z0 * s * 1000) / 1000))
      setZoom(finalZoom)
      setPan(P) // matches the live transform (svg grows to true size, scale back to 1)
    }
    const onEnd = (e: TouchEvent) => {
      if (mode === 'pan' && moved > 8) { // swallow the click after a drag so it doesn't select a station
        const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault() }
        pane.addEventListener('click', swallow, { capture: true, once: true })
        setTimeout(() => pane.removeEventListener('click', swallow, { capture: true } as EventListenerOptions), 350)
      }
      if (e.touches.length === 0) { commit(); mode = 'none' }
      else { // dropped to one finger → keep panning from where it is
        const rect = pane.getBoundingClientRect()
        if (e.touches.length >= 2) { mode = 'pinch'; startPinch(e.touches, rect) }
        else { mode = 'pan'; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; moved = 99 }
      }
    }
    const stop = (ev: Event) => ev.preventDefault() // iOS Safari page pinch

    // --- mouse drag-to-pan (desktop) ---
    let dragging = false
    const onMouseDown = (e: MouseEvent) => {
      if (mode !== 'none' || e.button !== 0) return
      enter(); mode = 'pan'; dragging = true
      lastX = e.clientX; lastY = e.clientY; moved = 0
      pane.style.cursor = 'grabbing'
      e.preventDefault()
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX, dy = e.clientY - lastY
      moved += Math.abs(dx) + Math.abs(dy)
      lastX = e.clientX; lastY = e.clientY
      if (moved > 2) { P = clampPan(P.x + dx, P.y + dy, baseW * s, baseH * s); draw() }
    }
    const onMouseUp = () => {
      if (!dragging) return
      dragging = false
      pane.style.cursor = 'grab'
      if (moved > 4) { // swallow the click after a drag so it doesn't select a station
        const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault() }
        pane.addEventListener('click', swallow, { capture: true, once: true })
        setTimeout(() => pane.removeEventListener('click', swallow, { capture: true } as EventListenerOptions), 350)
      }
      commit(); mode = 'none'
    }

    pane.addEventListener('touchstart', onStart, { passive: false })
    pane.addEventListener('touchmove', onMove, { passive: false })
    pane.addEventListener('touchend', onEnd)
    pane.addEventListener('touchcancel', onEnd)
    pane.addEventListener('gesturestart', stop as EventListener)
    pane.addEventListener('gesturechange', stop as EventListener)
    pane.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      pane.removeEventListener('touchstart', onStart)
      pane.removeEventListener('touchmove', onMove)
      pane.removeEventListener('touchend', onEnd)
      pane.removeEventListener('touchcancel', onEnd)
      pane.removeEventListener('gesturestart', stop as EventListener)
      pane.removeEventListener('gesturechange', stop as EventListener)
      pane.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [setZoom, min, max])

  return (
    <div ref={paneRef} className={className} style={{ overflow: 'hidden', touchAction: 'none', cursor: 'grab' }}>
      <div ref={contentRef} style={{ position: 'absolute', top: 0, left: 0, width: 'max-content', transformOrigin: '0 0', willChange: 'transform', transform: `translate(${pan.x}px, ${pan.y}px)` }}>
        {children}
      </div>
    </div>
  )
}
