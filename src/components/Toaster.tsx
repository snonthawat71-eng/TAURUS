import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconCircleCheck, IconAlertTriangle, IconInfoCircle, IconX } from '@tabler/icons-react'
import { subscribeToasts, dismissToast, type Toast } from '@/lib/toast'

const STYLE: Record<Toast['kind'], { bg: string; fg: string; Icon: typeof IconInfoCircle }> = {
  success: { bg: '#1E8E5A', fg: '#fff', Icon: IconCircleCheck },
  error: { bg: '#D85A30', fg: '#fff', Icon: IconAlertTriangle },
  info: { bg: '#0270FB', fg: '#fff', Icon: IconInfoCircle },
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])
  useEffect(() => subscribeToasts(setToasts), [])
  if (!toasts.length) return null

  return createPortal(
    <div className="fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((t) => {
        const { bg, fg, Icon } = STYLE[t.kind]
        return (
          <div key={t.id}
            className="pointer-events-auto flex items-center gap-2.5 rounded-[12px] pl-3 pr-2 py-2.5 shadow-lg w-[min(92vw,380px)] animate-[toast-in_.18s_ease-out]"
            style={{ background: bg, color: fg }} role="status">
            <Icon size={18} className="shrink-0" />
            <span className="text-[13px] leading-snug flex-1">{t.message}</span>
            {t.action && (
              <button onClick={() => { t.action!.run(); dismissToast(t.id) }}
                className="shrink-0 text-[13px] font-semibold underline underline-offset-2 px-1 opacity-95 hover:opacity-100">
                {t.action.label}
              </button>
            )}
            <button onClick={() => dismissToast(t.id)} className="shrink-0 opacity-80 hover:opacity-100" aria-label="ปิด">
              <IconX size={15} />
            </button>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}
