import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'

// Scrollable map pane with two-finger pinch-to-zoom. One finger pans (native
// scroll); two fingers scale `zoom` toward the pinch midpoint. The map inside is
// sized by the same `zoom`, so we anchor the focal point after it re-renders.
export function PinchZoomPane({ zoom, setZoom, min = 0.6, max = 3, className = '', children }: {
  zoom: number
  setZoom: (z: number) => void
  min?: number
  max?: number
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const start = useRef<{ dist: number; zoom: number } | null>(null)
  // focal point in client coords + the content (unscaled) point under it
  const pending = useRef<{ fcx: number; fcy: number; ix: number; iy: number } | null>(null)

  // After the content re-renders at the new zoom, scroll so the intrinsic point
  // under the fingers stays put. Measured from the content's real rect, so it's
  // correct whether the map is centred (mx-auto) or overflowing.
  useLayoutEffect(() => {
    const el = ref.current
    const content = el?.firstElementChild as HTMLElement | null
    if (!el || !content || !pending.current) return
    const { fcx, fcy, ix, iy } = pending.current
    const r = content.getBoundingClientRect()
    el.scrollLeft += r.left + ix * zoom - fcx
    el.scrollTop += r.top + iy * zoom - fcy
    pending.current = null
  }, [zoom])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) start.current = { dist: dist(e.touches), zoom: zoomRef.current }
    }
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !start.current) return
      e.preventDefault() // stop the browser's own pinch / page scroll
      const content = el.firstElementChild as HTMLElement | null
      if (!content) return
      const fcx = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const fcy = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const r = content.getBoundingClientRect()
      const z = zoomRef.current
      pending.current = { fcx, fcy, ix: (fcx - r.left) / z, iy: (fcy - r.top) / z }
      const next = Math.min(max, Math.max(min, start.current.zoom * (dist(e.touches) / start.current.dist)))
      setZoom(Math.round(next * 100) / 100)
    }
    const onEnd = (e: TouchEvent) => { if (e.touches.length < 2) start.current = null }
    el.addEventListener('touchstart', onStart, { passive: false })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [setZoom, min, max])

  return (
    <div ref={ref} className={className} style={{ touchAction: 'pan-x pan-y' }}>
      {children}
    </div>
  )
}
