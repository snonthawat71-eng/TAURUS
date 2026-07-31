import { useEffect, useRef, useState } from 'react'
import { IconArrowUp } from '@tabler/icons-react'

/**
 * A "back to top" bubble that appears when you scroll *up* partway down a long
 * list — the moment you're likely heading back, without sitting on the screen
 * the whole time you're reading downwards.
 *
 * It shows after a small upward run (so a stray finger wobble doesn't summon
 * it), hides again the moment you resume scrolling down, and never appears near
 * the top where it would be pointless.
 */
export function ScrollToTopBubble({ showAfter = 600, upThreshold = 80, downThreshold = 140 }: {
  /** how far down the page has to be before the bubble is ever offered */
  showAfter?: number
  /** how far you must scroll back up before it appears */
  upThreshold?: number
  /** how far you must scroll back down before it goes away */
  downThreshold?: number
}) {
  const [show, setShow] = useState(false)
  const lastY = useRef(0)
  const upRun = useRef(0)
  const downRun = useRef(0)

  useEffect(() => {
    lastY.current = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const dy = y - lastY.current
      lastY.current = y
      // Momentum scrolling doesn't decelerate cleanly: the tail of an upward
      // flick throws off a few small downward deltas, and rubber-banding throws
      // off more. Hiding on the first of those made the bubble flash and vanish
      // the moment it appeared, so each direction has to earn its switch — and
      // sub-pixel noise is ignored outright.
      if (Math.abs(dy) < 2) return
      if (y < showAfter) { upRun.current = 0; downRun.current = 0; setShow(false); return }

      if (dy < 0) {
        downRun.current = 0
        upRun.current += -dy
        if (upRun.current >= upThreshold) setShow(true)
      } else {
        upRun.current = 0
        downRun.current += dy
        if (downRun.current >= downThreshold) setShow(false)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [showAfter, upThreshold, downThreshold])

  function toTop() {
    upRun.current = 0
    downRun.current = 0
    setShow(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="fixed inset-x-0 z-[300] flex justify-center pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom,0px) + 18px)' }}>
      <button onClick={toTop} aria-hidden={!show} tabIndex={show ? 0 : -1}
        className={[
          'pointer-events-auto inline-flex items-center gap-1.5 h-10 pl-3 pr-4 rounded-full',
          'text-[12.5px] font-semibold transition-all duration-200',
          show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none',
        ].join(' ')}
        style={{
          background: 'var(--color-brand)', color: '#fff',
          boxShadow: '0 6px 20px -4px rgba(2,112,251,.45), 0 2px 6px rgba(0,0,0,.12)',
        }}>
        <IconArrowUp size={16} /> กลับขึ้นบน
      </button>
    </div>
  )
}
