import { useEffect, useRef, useState } from 'react'
import { IconArrowDown, IconLoader2 } from '@tabler/icons-react'

const THRESHOLD = 70 // px of pull needed before a refresh fires
const MAX = 110 // cap on how far the indicator travels

/**
 * Pull-to-refresh for mobile: when the page is scrolled to the very top and the
 * user drags down past a threshold, reload the page. Works inside an installed
 * PWA too (where the browser's native pull-to-refresh isn't available). Mounted
 * once, globally, and listens on the window — the whole app scrolls on <body>.
 */
export function PullToRefresh() {
  const [pull, setPull] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const startX = useRef(0)
  const pullRef = useRef(0)
  const busy = useRef(false)

  const set = (v: number) => { pullRef.current = v; setPull(v) }

  useEffect(() => {
    function onStart(e: TouchEvent) {
      if (busy.current || window.scrollY > 0 || e.touches.length !== 1) { startY.current = null; return }
      startY.current = e.touches[0].clientY
      startX.current = e.touches[0].clientX
    }
    function onMove(e: TouchEvent) {
      if (startY.current === null || busy.current) return
      const dy = e.touches[0].clientY - startY.current
      const dx = e.touches[0].clientX - startX.current
      // engage only on a clearly-downward drag while still pinned at the top —
      // this keeps horizontal swipes (chips, lightbox) and upward scrolls free
      if (dy > 8 && dy > Math.abs(dx) && window.scrollY <= 0) {
        setDragging(true)
        set(Math.min(MAX, dy * 0.5)) // resistance
        if (e.cancelable) e.preventDefault()
      } else if (dy <= 0) {
        setDragging(false)
        set(0)
      }
    }
    function onEnd() {
      if (startY.current === null) return
      startY.current = null
      setDragging(false)
      if (pullRef.current >= THRESHOLD) {
        busy.current = true
        setRefreshing(true)
        set(THRESHOLD)
        setTimeout(() => window.location.reload(), 150) // let the spinner paint first
      } else {
        set(0)
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  const ready = pull >= THRESHOLD
  return (
    <div className="fixed top-0 inset-x-0 z-[200] flex justify-center pointer-events-none"
      style={{
        transform: `translateY(${pull - 48}px)`,
        transition: dragging ? 'none' : 'transform .25s ease, opacity .2s ease',
        opacity: pull > 4 ? 1 : 0,
      }}>
      <div className="mt-3 size-9 rounded-full bg-surface shadow-md grid place-items-center"
        style={{ border: '0.5px solid var(--color-line)' }}>
        {refreshing
          ? <IconLoader2 size={18} className="animate-spin text-brand" />
          : <IconArrowDown size={18} className={['text-brand transition-transform duration-200', ready ? 'rotate-180' : ''].join(' ')} />}
      </div>
    </div>
  )
}
