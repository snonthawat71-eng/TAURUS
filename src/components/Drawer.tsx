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
  const sheetRef = useRef<HTMLDivElement>(null)
  const startY = useRef<number | null>(null)
  const [dy, setDy] = useState(0)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!open) return
    setDy(0)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  // swipe-down-to-close (only when the sheet is scrolled to the top)
  function onTouchStart(e: React.TouchEvent) {
    if ((sheetRef.current?.scrollTop ?? 0) > 0) { startY.current = null; return }
    startY.current = e.touches[0].clientY
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startY.current == null) return
    const d = e.touches[0].clientY - startY.current
    if (d > 0) { setDy(d); setDragging(true) }
  }
  function onTouchEnd() {
    if (startY.current == null) return
    if (dy > 110) onClose(); else setDy(0)
    startY.current = null
    setDragging(false)
  }

  // Portal to <body> so no ancestor transform/backdrop-filter can clip or offset it.
  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative min-h-full flex items-end justify-center sm:items-center p-0 sm:p-6">
        <div ref={sheetRef}
          className="relative bg-surface w-full sm:max-w-[440px] rounded-t-[20px] sm:rounded-[18px] max-h-[90dvh] overflow-y-auto shadow-2xl animate-[slideup_.2s_ease]"
          style={{ transform: dy ? `translateY(${dy}px)` : undefined, transition: dragging ? 'none' : 'transform .2s ease' }}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          {/* drag handle (mobile) — swipe down to close */}
          <div className="sm:hidden pt-2.5 pb-1 flex justify-center cursor-grab">
            <span className="h-1 w-9 rounded-full bg-line-2" />
          </div>
          <button onClick={onClose} aria-label="ปิด"
            className="absolute top-3.5 right-3.5 size-8 rounded-full bg-surface-2 grid place-items-center text-ink-2 hover:bg-line z-10">
            <IconX size={16} />
          </button>
          {title && <div className="px-5 pt-4 text-[16px] font-medium pr-12">{title}</div>}
          <div className="p-5 pt-3">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
