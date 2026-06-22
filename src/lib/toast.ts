// Lightweight, framework-agnostic toast store. No React import — safe to call
// from anywhere (mutation helpers, lib code, components). The <Toaster />
// component subscribes and renders the stack.

export type ToastKind = 'success' | 'error' | 'info'
export interface ToastAction { label: string; run: () => void }
export interface Toast { id: number; kind: ToastKind; message: string; action?: ToastAction }
type Listener = (toasts: Toast[]) => void

let toasts: Toast[] = []
const listeners = new Set<Listener>()
let nextId = 1

function emit() { for (const l of listeners) l(toasts) }

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

function push(kind: ToastKind, message: string, ttl: number, action?: ToastAction) {
  const id = nextId++
  toasts = [...toasts, { id, kind, message, action }]
  emit()
  if (ttl) setTimeout(() => dismissToast(id), ttl)
  return id
}

export function subscribeToasts(l: Listener) {
  listeners.add(l)
  l(toasts)
  return () => { listeners.delete(l) }
}

export const toast = {
  success: (m: string) => push('success', m, 3500),
  error: (m: string) => push('error', m, 5500),
  info: (m: string) => push('info', m, 3500),
  /** A toast with an action button (e.g. Undo). Longer-lived by default. */
  action: (m: string, action: ToastAction, opts: { kind?: ToastKind; ttl?: number } = {}) =>
    push(opts.kind ?? 'info', m, opts.ttl ?? 7000, action),
}

/** Surface the outcome of a `{ error }`-returning helper as a toast.
 *  Returns true when there was no error. */
export function toastResult(
  res: { error: unknown } | null | undefined,
  opts: { success?: string; fail?: string } = {},
): boolean {
  const err = res?.error
  if (err) {
    const msg = typeof err === 'string' ? err : (err as { message?: string })?.message
    toast.error(opts.fail ? (msg ? `${opts.fail}: ${msg}` : opts.fail) : (msg || 'เกิดข้อผิดพลาด'))
    return false
  }
  if (opts.success) toast.success(opts.success)
  return true
}
