import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconX } from '@tabler/icons-react'
import { lockScroll } from '@/lib/scrollLock'
import { confirmDialog } from '@/lib/confirm'

export function Drawer({
  open, onClose, title, children, guard = true,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  /** Ask before an accidental close (✕ / backdrop / swipe / Esc) once the user
   *  has typed or changed anything inside. Saving still closes straight away:
   *  the save button calls the parent's onClose, not this guarded path.
   *  Set false on pickers & detail sheets, where a search box or an
   *  act-immediately control is not "unsaved work". */
  guard?: boolean
}) {
  const startY = useRef<number | null>(null)
  // "something was typed/changed and not saved yet" — set by any input/change
  // event bubbling out of the sheet body, cleared every time the sheet opens.
  const dirty = useRef(false)
  const asking = useRef(false)
  const [dy, setDy] = useState(0)
  const [dragging, setDragging] = useState(false)
  // On-screen keyboard height, derived from the visual viewport. We DON'T use
  // window.innerHeight (an installed iOS PWA mis-reports it, shrinking it with
  // the keyboard). Instead we remember the viewport height with the keyboard
  // down (captured on open) and subtract the current shrunk height.
  const [kb, setKb] = useState(0)
  const baseH = useRef(0)

  // Hold the page still while the sheet is up. Depends on `open` alone: every
  // caller passes an inline onClose, so listing it here re-ran this on every
  // render of the page behind — with two sheets stacked, the lock/unlock churn
  // could leave the page pinned after both had closed.
  useEffect(() => {
    if (!open) return
    setDy(0)
    dirty.current = false
    asking.current = false
    return lockScroll()
  }, [open])

  // Every "I didn't mean to close this" gesture goes through here.
  async function requestClose() {
    if (!guard || !dirty.current) { onClose(); return }
    if (asking.current) return
    asking.current = true
    setDy(0) // spring the sheet back up while the question is on screen
    const discard = await confirmDialog({
      title: 'ทิ้งข้อมูลที่กรอกไว้?',
      message: 'ยังไม่ได้บันทึก ถ้าปิดตอนนี้ข้อมูลจะหายไป',
      confirmLabel: 'ทิ้งเลย',
      cancelLabel: 'กลับไปแก้ต่อ',
      danger: true,
    })
    asking.current = false
    if (discard) { dirty.current = false; onClose() }
  }
  // keep the key handler stable (it must not re-bind on every parent render)
  const closeRef = useRef(requestClose)
  closeRef.current = requestClose

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') void closeRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

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
    if (dy > 140) void requestClose(); else setDy(0)
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
      <div className="fixed inset-0 bg-black/30" onClick={() => void requestClose()} />
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
          <button onClick={() => void requestClose()} aria-label="ปิด"
            className="absolute top-3.5 right-3.5 size-8 rounded-full bg-surface-2 grid place-items-center text-ink-2 hover:bg-line z-10">
            <IconX size={16} />
          </button>
          {title && <div className="px-5 pt-4 text-[16px] font-medium pr-12 shrink-0">{title}</div>}
          {/* scrollable body: min-h-0 lets it shrink & scroll inside the capped
              sheet. It sits ABOVE the keyboard because the spacer below carries
              the sheet's surface down behind the keyboard. */}
          <div className="min-h-0 overflow-y-auto px-5 pt-3 pb-5"
            onInput={() => { dirty.current = true }}
            onChange={() => { dirty.current = true }}>
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
