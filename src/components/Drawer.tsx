import { useEffect, type ReactNode } from 'react'
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
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  // Portal to <body> so no ancestor transform/backdrop-filter can clip or offset it.
  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative min-h-full flex items-end justify-center sm:items-center p-0 sm:p-6">
        <div className="relative bg-surface w-full sm:max-w-[440px] rounded-t-[20px] sm:rounded-[18px] max-h-[90dvh] overflow-y-auto shadow-2xl animate-[slideup_.2s_ease]">
          {/* drag handle (mobile) */}
          <div className="sm:hidden pt-2.5 flex justify-center">
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
