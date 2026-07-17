import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconX } from '@tabler/icons-react'

export function Drawer({
  open, onClose, title, children,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
}) {
  const startY = useRef<number | null>(null)
  const [dy, setDy] = useState(0)
  const [dragging, setDragging] = useState(false)
  // On-screen keyboard height, derived from the visual viewport. We DON'T use
  // window.innerHeight (an installed iOS PWA mis-reports it, shrinking it with
  // the keyboard). Instead we remember the viewport height with the keyboard
  // down (captured on open) and subtract the current shrunk height.
  const [kb, setKb] = useState(0)
  const baseH = useRef(0)

  useEffect(() => {
    if (!open) return
    setDy(0)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    // Paint the document root the sheet's surface colour while open. If the
    // layout viewport shrinks for the keyboard (installed iOS PWA), the strip
    // it leaves behind is outside every fixed element and falls back to the
    // root background — this keeps that strip white instead of the page behind.
    const html = document.documentElement
    const prevHtmlBg = html.style.backgroundColor
    html.style.backgroundColor = 'var(--color-surface)'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      html.style.backgroundColor = prevHtmlBg
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const view = window.visualViewport
    if (!view) return
    baseH.current = view.height // keyboard is down at open time → full height
    const update = () => {
      if (view.height > baseH.current) baseH.current = view.height
      setKb(Math.max(0, baseH.current - view.height - view.offsetTop))
    }
    update()
    view.addEventListener('resize', update)
    view.addEventListener('scroll', update)
    return () => { view.removeEventListener('resize', update); view.removeEventListener('scroll', update); setKb(0) }
  }, [open])

  if (!open) return null

  // swipe-down-to-close — ONLY from the grab handle, so scrolling/typing in the
  // form never drags the sheet closed.
  function onTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startY.current == null) return
    const d = e.touches[0].clientY - startY.current
    setDy(d > 0 ? d : 0)
    if (d > 0) setDragging(true)
  }
  function onTouchEnd() {
    if (startY.current == null) return
    if (dy > 140) onClose(); else setDy(0)
    startY.current = null
    setDragging(false)
  }

  // Portal to <body> so no ancestor transform/backdrop-filter can clip or offset it.
  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      {/* Mobile: a bottom sheet whose white surface runs all the way to the true
          screen bottom — so the strip the keyboard (and its translucent toolbar)
          overlays is simply the sheet's own white, seamless. Its content is
          padded at the bottom by the keyboard height, which lifts the lower
          fields above the keyboard. Desktop (sm): a centred dialog. */}
      <div className="fixed inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-6 pointer-events-none">
        <div
          className="pointer-events-auto relative mx-auto bg-surface w-full sm:max-w-[440px] rounded-t-[20px] sm:rounded-[18px] shadow-2xl animate-[slideup_.2s_ease] flex flex-col"
          style={{
            maxHeight: 'min(92dvh, calc(100dvh - env(safe-area-inset-top,0px) - 8px))',
            transform: dy ? `translateY(${dy}px)` : undefined,
            transition: dragging ? 'none' : 'transform .2s ease',
          }}>
          {/* drag handle (mobile) — swipe down here to close (only this zone) */}
          <div className="sm:hidden flex justify-center pt-3 pb-2.5 cursor-grab touch-none shrink-0"
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <span className="h-1.5 w-10 rounded-full bg-line-2" />
          </div>
          <button onClick={onClose} aria-label="ปิด"
            className="absolute top-3.5 right-3.5 size-8 rounded-full bg-surface-2 grid place-items-center text-ink-2 hover:bg-line z-10">
            <IconX size={16} />
          </button>
          {title && <div className="px-5 pt-4 text-[16px] font-medium pr-12 shrink-0">{title}</div>}
          {/* scrollable body: min-h-0 lets it shrink & scroll inside the capped
              sheet. It sits ABOVE the keyboard because the spacer below carries
              the sheet's surface down behind the keyboard. */}
          <div className="min-h-0 overflow-y-auto px-5 pt-3 pb-5">
            {children}
          </div>
          {/* solid surface spacer that physically extends the sheet down behind
              the on-screen keyboard, so the strip it (and its translucent
              toolbar) overlays is the sheet's own white — seamless, not the
              page behind. Zero-height when the keyboard is down. */}
          {kb > 0 && <div aria-hidden className="shrink-0" style={{ height: kb }} />}
        </div>
      </div>
    </div>,
    document.body,
  )
}
