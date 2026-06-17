import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

// Self-contained pan + pinch-zoom pane. We take over all touch handling
// (touch-action: none) so the browser never tries its own pinch/scroll — that
// was making the page rubber-band ("bounce out") on iOS. The map keeps sizing
// itself from `zoom`; this pane only translates it for panning and re-anchors
// the pinch focal point. One finger pans, two fingers zoom; taps still select.
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
  const cur = useRef({ x: 0, y: 0 }) // synchronous source of truth during a gesture
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const clamp = (x: number, y: number) => {
    const pane = paneRef.current, content = contentRef.current
    if (!pane || !content) return { x, y }
    const pw = pane.clientWidth, ph = pane.clientHeight
    const cw = content.offsetWidth, ch = content.offsetHeight
    const nx = cw <= pw ? (pw - cw) / 2 : Math.min(0, Math.max(pw - cw, x))
    const ny = ch <= ph ? (ph - ch) / 2 : Math.min(0, Math.max(ph - ch, y))
    return { x: nx, y: ny }
  }
  const apply = (x: number, y: number) => {
    const c = clamp(x, y)
    cur.current = c
    setPan(c)
  }

  // re-centre / re-clamp after the map re-renders at a new zoom (e.g. +/- buttons)
  useLayoutEffect(() => { apply(cur.current.x, cur.current.y) }, [zoom])

  useEffect(() => {
    const pane = paneRef.current
    if (!pane) return
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    let mode: 'none' | 'pan' | 'pinch' = 'none'
    let lastX = 0, lastY = 0, startDist = 0, startZoom = 1, moved = 0

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        mode = 'pinch'; startDist = dist(e.touches); startZoom = zoomRef.current
        e.preventDefault()
      } else if (e.touches.length === 1) {
        mode = 'pan'; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; moved = 0
      }
    }
    const onMove = (e: TouchEvent) => {
      const rect = pane.getBoundingClientRect()
      if (mode === 'pinch' && e.touches.length === 2) {
        e.preventDefault()
        const fx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left
        const fy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top
        const nz = Math.min(max, Math.max(min, startZoom * (dist(e.touches) / startDist)))
        const k = nz / zoomRef.current
        // keep the content point under the fingers fixed: p' = f - (f - p) * k.
        // Set raw here; the [zoom] layout effect clamps it against the new size.
        const nx = fx - (fx - cur.current.x) * k, ny = fy - (fy - cur.current.y) * k
        cur.current = { x: nx, y: ny }
        setPan({ x: nx, y: ny })
        setZoom(Math.round(nz * 1000) / 1000)
      } else if (mode === 'pan' && e.touches.length === 1) {
        const dx = e.touches[0].clientX - lastX, dy = e.touches[0].clientY - lastY
        moved += Math.abs(dx) + Math.abs(dy)
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY
        if (moved > 4) { e.preventDefault(); apply(cur.current.x + dx, cur.current.y + dy) }
      }
    }
    const onEnd = (e: TouchEvent) => {
      if (mode === 'pan' && moved > 8) {
        // we were panning — swallow the click so it doesn't select a station
        const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault() }
        pane.addEventListener('click', swallow, { capture: true, once: true })
        setTimeout(() => pane.removeEventListener('click', swallow, { capture: true } as EventListenerOptions), 350)
      }
      if (e.touches.length === 0) mode = 'none'
      else if (e.touches.length === 1) { mode = 'pan'; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; moved = 99 }
    }
    // iOS Safari ignores maximum-scale and zooms the page via gesture events
    const stop = (e: Event) => e.preventDefault()

    pane.addEventListener('touchstart', onStart, { passive: false })
    pane.addEventListener('touchmove', onMove, { passive: false })
    pane.addEventListener('touchend', onEnd)
    pane.addEventListener('touchcancel', onEnd)
    pane.addEventListener('gesturestart', stop as EventListener)
    pane.addEventListener('gesturechange', stop as EventListener)
    return () => {
      pane.removeEventListener('touchstart', onStart)
      pane.removeEventListener('touchmove', onMove)
      pane.removeEventListener('touchend', onEnd)
      pane.removeEventListener('touchcancel', onEnd)
      pane.removeEventListener('gesturestart', stop as EventListener)
      pane.removeEventListener('gesturechange', stop as EventListener)
    }
  }, [setZoom, min, max])

  return (
    <div ref={paneRef} className={className} style={{ overflow: 'hidden', touchAction: 'none' }}>
      <div ref={contentRef} style={{ position: 'absolute', top: 0, left: 0, width: 'max-content', transformOrigin: '0 0', transform: `translate(${pan.x}px, ${pan.y}px)` }}>
        {children}
      </div>
    </div>
  )
}
