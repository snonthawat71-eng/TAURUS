// Imperative, promise-based confirm dialog — mirrors the toast store so any
// callsite can `await confirmDialog(...)` instead of using window.confirm.
// <ConfirmHost /> subscribes and renders the styled dialog.

export interface ConfirmOptions {
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}
export interface ConfirmState extends ConfirmOptions { id: number }

type Listener = (state: ConfirmState | null) => void

let current: ConfirmState | null = null
let resolver: ((ok: boolean) => void) | null = null
const listeners = new Set<Listener>()
let nextId = 1

function emit() { for (const l of listeners) l(current) }

export function subscribeConfirm(l: Listener) {
  listeners.add(l)
  l(current)
  return () => { listeners.delete(l) }
}

/** Show a confirm dialog. Pass a string for a plain message, or options for a
 *  title / custom labels / danger styling. Resolves true when confirmed. */
export function confirmDialog(opts: ConfirmOptions | string): Promise<boolean> {
  const options = typeof opts === 'string' ? { message: opts } : opts
  // A second dialog opening cancels any pending one.
  if (resolver) resolver(false)
  return new Promise<boolean>((resolve) => {
    resolver = resolve
    current = { id: nextId++, ...options }
    emit()
  })
}

/** Called by <ConfirmHost /> when the user picks an answer (or dismisses). */
export function resolveConfirm(ok: boolean) {
  if (!resolver) return
  resolver(ok)
  resolver = null
  current = null
  emit()
}
