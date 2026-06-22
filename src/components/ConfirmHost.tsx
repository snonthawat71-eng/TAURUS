import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconAlertTriangle } from '@tabler/icons-react'
import { subscribeConfirm, resolveConfirm, type ConfirmState } from '@/lib/confirm'

// Styled replacement for window.confirm. Mounted once (see main.tsx); driven by
// the confirm store. Esc / backdrop click = cancel, Enter = confirm.
export function ConfirmHost() {
  const [state, setState] = useState<ConfirmState | null>(null)
  useEffect(() => subscribeConfirm(setState), [])

  useEffect(() => {
    if (!state) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolveConfirm(false)
      if (e.key === 'Enter') resolveConfirm(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  if (!state) return null
  const danger = state.danger ?? false

  return createPortal(
    <div className="fixed inset-0 z-[110] grid place-items-center p-4 bg-black/35 backdrop-blur-[1px] animate-[toast-in_.14s_ease-out]"
      onClick={() => resolveConfirm(false)} role="presentation">
      <div className="card w-[min(92vw,360px)] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}
        role="alertdialog" aria-modal="true" aria-label={state.title ?? state.message ?? 'ยืนยัน'}>
        <div className="flex gap-3">
          {danger && (
            <span className="shrink-0 grid place-items-center w-9 h-9 rounded-full" style={{ background: '#fbe6dd', color: '#D85A30' }}>
              <IconAlertTriangle size={20} />
            </span>
          )}
          <div className="flex-1 min-w-0">
            {state.title && <h2 className="text-[15px] font-semibold text-ink mb-1">{state.title}</h2>}
            {state.message && <p className="text-[13px] text-ink-2 leading-snug">{state.message}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => resolveConfirm(false)} autoFocus
            className="px-3.5 py-2 rounded-[8px] text-[13px] font-medium text-ink-2 hairline hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand outline-none">
            {state.cancelLabel ?? 'ยกเลิก'}
          </button>
          <button onClick={() => resolveConfirm(true)}
            className="px-3.5 py-2 rounded-[8px] text-[13px] font-medium text-white focus-visible:ring-2 focus-visible:ring-offset-1 outline-none"
            style={{ background: danger ? '#D85A30' : 'var(--color-brand)' }}>
            {state.confirmLabel ?? 'ยืนยัน'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
