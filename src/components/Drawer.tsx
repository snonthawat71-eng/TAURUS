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

    // iOS composites the on-screen keyboard over a snapshot of the WHOLE page,
    // so a long page behind the sheet keeps showing through the keyboard's
    // translucent toolbar no matter how the sheet is painted. Fix the root
    // cause: while the sheet is open, clip the page to exactly the viewport
    // (position:fixed body) and paint the root the surface colour — so nothing
    // renders below the fold and the strip the keyboard overlays is plain white.
    const html = document.documentElement
    const body = document.body
    const scrollY = window.scrollY
    const prev = {
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
    return () => {
      window.removeEventListener('keydown', onKey)
      html.style.backgroundColor = prev.htmlBg
      body.style.backgroundColor = prev.bodyBg
      html.style.height = prev.htmlH
      body.style.height = prev.height
      body.style.overflow = prev.overflow
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.width = prev.width
      window.scrollTo(0, scrollY)
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
  //
  // APP-WIDE STACKING ORDER — anything that opens FROM INSIDE a drawer must sit
  // ABOVE this one, or the drawer covers it and its controls can't be tapped:
  //   400 TripMap (fixed map)  ·  700 Drawer  ·  705 metro map pickers
  //   706 Lightbox  ·  710 ConfirmHost  ·  720 Toaster
  return createPortal(
    <div className="fixed inset-0 z-[700]">
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
