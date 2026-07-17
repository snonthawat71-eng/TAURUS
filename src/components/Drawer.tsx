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
  // Track the visual viewport so the sheet lifts above the on-screen keyboard
  // instead of hiding its lower fields (inputs, search) behind it.
  const [vv, setVv] = useState<{ top: number; height: number } | null>(null)

  useEffect(() => {
    if (!open) return
    setDy(0)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    // Back the whole screen with the sheet's surface colour while it's open. On
    // iOS (esp. installed PWA) the keyboard's translucent toolbar overlays a
    // strip the web viewport doesn't cover; without this it shows the webview
    // background (dark/blue page) instead of a seamless white under the sheet.
    const html = document.documentElement
    const body = document.body
    const prevHtmlBg = html.style.backgroundColor
    const prevBodyBg = body.style.backgroundColor
    html.style.backgroundColor = 'var(--color-surface)'
    body.style.backgroundColor = 'var(--color-surface)'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      html.style.backgroundColor = prevHtmlBg
      body.style.backgroundColor = prevBodyBg
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const view = window.visualViewport
    if (!view) return
    const update = () => setVv({ top: view.offsetTop, height: view.height })
    update()
    view.addEventListener('resize', update)
    view.addEventListener('scroll', update)
    return () => { view.removeEventListener('resize', update); view.removeEventListener('scroll', update); setVv(null) }
  }, [open])

  if (!open) return null

  // Height of the on-screen keyboard: the gap between the visible viewport's
  // bottom and the (unchanged) layout viewport bottom. We paint a solid surface
  // panel over it so the translucent keyboard toolbar shows white — a seamless
  // continuation of the sheet — instead of the darkened page bleeding through.
  const kbGap = vv ? Math.max(0, window.innerHeight - (vv.top + vv.height)) : 0

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
      {/* Solid fill behind the on-screen keyboard, so its translucent toolbar
          reads as white (an extension of the sheet), not the darkened page. */}
      {kbGap > 1 && <div className="fixed left-0 right-0 bottom-0 bg-surface" style={{ height: kbGap }} />}
      {/* This scroll area is pinned to the VISIBLE viewport (above the keyboard
          when one is open), so the bottom sheet's lower fields stay reachable. */}
      <div className="absolute left-0 right-0 overflow-y-auto"
        style={{ top: vv?.top ?? 0, height: vv ? vv.height : '100%' }}>
        <div className="relative min-h-full flex items-end justify-center sm:items-center p-0 sm:p-6">
          <div
            className="relative bg-surface w-full sm:max-w-[440px] rounded-t-[20px] sm:rounded-[18px] max-h-[90dvh] overflow-y-auto shadow-2xl animate-[slideup_.2s_ease]"
            style={{ maxHeight: vv ? `min(90dvh, ${vv.height}px)` : undefined, transform: dy ? `translateY(${dy}px)` : undefined, transition: dragging ? 'none' : 'transform .2s ease' }}>
          {/* drag handle (mobile) — swipe down here to close (only this zone) */}
          <div className="sm:hidden flex justify-center pt-3 pb-2.5 cursor-grab touch-none"
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <span className="h-1.5 w-10 rounded-full bg-line-2" />
          </div>
          <button onClick={onClose} aria-label="ปิด"
            className="absolute top-3.5 right-3.5 size-8 rounded-full bg-surface-2 grid place-items-center text-ink-2 hover:bg-line z-10">
            <IconX size={16} />
          </button>
          {title && <div className="px-5 pt-4 text-[16px] font-medium pr-12">{title}</div>}
          <div className="p-5 pt-3">{children}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
