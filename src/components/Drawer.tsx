import { useEffect, type ReactNode } from 'react'
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
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="relative bg-surface w-full sm:max-w-[420px] sm:rounded-[16px] rounded-t-[18px] max-h-[88dvh] overflow-y-auto shadow-xl animate-[slideup_.18s_ease]">
        <div className="sticky top-0 bg-surface/95 backdrop-blur flex items-center justify-between px-4 h-12"
          style={{ borderBottom: '0.5px solid var(--color-line)' }}>
          <div className="text-[14px] font-medium">{title}</div>
          <button onClick={onClose} className="btn-icon !border-0"><IconX size={17} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
