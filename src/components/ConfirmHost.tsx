import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconAlertTriangle } from '@tabler/icons-react'
import { subscribeConfirm, resolveDialog, type DialogState } from '@/lib/confirm'

// Styled replacement for window.confirm / window.prompt. Mounted once (see
// main.tsx); driven by the dialog store. Esc / backdrop = cancel, Enter = ok.
export function ConfirmHost() {
  const [state, setState] = useState<DialogState | null>(null)
  const [value, setValue] = useState('')
  useEffect(() => subscribeConfirm(setState), [])
  useEffect(() => { if (state?.input) setValue(state.input.defaultValue ?? '') }, [state])
  // Escape always cancels. Enter is handled by the focused button / form submit
  // (so it carries the current input value and can't double-resolve).
  useEffect(() => {
    if (!state) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') resolveDialog(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  if (!state) return null
  const danger = state.danger ?? false
  const isPrompt = !!state.input
  const choices = state.choices
  const dismissOnly = state.dismissOnly ?? false
  const confirm = () => resolveDialog(isPrompt ? value : true)
  const cancel = () => resolveDialog(false)

  const tone = state.tone ?? (danger ? 'danger' : 'brand')
  const toneStyle =
    tone === 'danger' ? { background: '#fbe6dd', color: '#D85A30' }
    : tone === 'warn' ? { background: '#FDF1E3', color: '#D97706' }
    : { background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }
  // an explicit icon (or a dismiss-only card) → nicer centered layout
  const centered = !!state.icon || dismissOnly
  const iconNode = state.icon ?? (danger ? <IconAlertTriangle size={22} /> : null)

  return createPortal(
    <div className="fixed inset-0 z-[110] grid place-items-center p-4 bg-black/35 backdrop-blur-[1px] animate-[toast-in_.14s_ease-out]"
      onClick={cancel} role="presentation">
      <form className="card w-[min(92vw,360px)] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); confirm() }}
        role="alertdialog" aria-modal="true" aria-label={state.title ?? state.message ?? 'ยืนยัน'}>
        {centered ? (
          <div className="flex flex-col items-center text-center">
            {iconNode && (
              <span className="grid place-items-center w-12 h-12 rounded-full mb-3" style={toneStyle}>{iconNode}</span>
            )}
            {state.title && <h2 className="text-[15px] font-semibold text-ink">{state.title}</h2>}
            {state.message && <p className="text-[13px] text-ink-2 leading-snug mt-1">{state.message}</p>}
          </div>
        ) : (
          <div className="flex gap-3">
            {danger && (
              <span className="shrink-0 grid place-items-center w-9 h-9 rounded-full" style={toneStyle}>
                <IconAlertTriangle size={20} />
              </span>
            )}
            <div className="flex-1 min-w-0">
              {state.title && <h2 className="text-[15px] font-semibold text-ink mb-1">{state.title}</h2>}
              {state.message && <p className="text-[13px] text-ink-2 leading-snug">{state.message}</p>}
            </div>
          </div>
        )}
        {isPrompt && (
          <input autoFocus value={value} onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') cancel() }}
            placeholder={state.input!.placeholder}
            className="mt-3.5 w-full hairline rounded-[8px] px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-brand" />
        )}
        {dismissOnly ? (
          <button type="button" onClick={cancel} autoFocus
            className="mt-4 w-full px-3.5 py-2.5 rounded-[8px] text-[13px] font-medium text-white text-center focus-visible:ring-2 focus-visible:ring-offset-1 outline-none"
            style={{ background: 'var(--color-brand)' }}>
            {state.confirmLabel ?? 'ปิด'}
          </button>
        ) : choices ? (
          // stacked choice buttons + a cancel row
          <div className="mt-4 flex flex-col gap-2">
            {choices.map((c) => (
              <button key={c.value} type="button" onClick={() => resolveDialog(c.value)}
                className="w-full px-3.5 py-2.5 rounded-[8px] text-[13px] font-medium text-white text-center focus-visible:ring-2 focus-visible:ring-offset-1 outline-none"
                style={{ background: c.danger ? '#D85A30' : 'var(--color-brand)' }}>
                {c.label}
              </button>
            ))}
            <button type="button" onClick={cancel}
              className="w-full px-3.5 py-2.5 rounded-[8px] text-[13px] font-medium text-ink-2 hairline hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand outline-none">
              {state.cancelLabel ?? 'ยกเลิก'}
            </button>
          </div>
        ) : (
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" onClick={cancel}
              className="px-3.5 py-2 rounded-[8px] text-[13px] font-medium text-ink-2 hairline hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand outline-none">
              {state.cancelLabel ?? 'ยกเลิก'}
            </button>
            <button type="submit" autoFocus={!isPrompt}
              className="px-3.5 py-2 rounded-[8px] text-[13px] font-medium text-white focus-visible:ring-2 focus-visible:ring-offset-1 outline-none"
              style={{ background: danger ? '#D85A30' : 'var(--color-brand)' }}>
              {state.confirmLabel ?? 'ยืนยัน'}
            </button>
          </div>
        )}
      </form>
    </div>,
    document.body,
  )
}
