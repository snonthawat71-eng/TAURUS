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
  const pending = useRef<{ fx: number; fy: number; cx: number; cy: number } | null>(null)

  // keep the pinch focal point fixed after the zoomed content has laid out
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !pending.current) return
    const { fx, fy, cx, cy } = pending.current
    el.scrollLeft = fx * el.scrollWidth - cx
    el.scrollTop = fy * el.scrollHeight - cy
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
      const rect = el.getBoundingClientRect()
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top
      const next = Math.min(max, Math.max(min, start.current.zoom * (dist(e.touches) / start.current.dist)))
      pending.current = {
        fx: (el.scrollLeft + cx) / Math.max(1, el.scrollWidth),
        fy: (el.scrollTop + cy) / Math.max(1, el.scrollHeight),
        cx, cy,
      }
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
