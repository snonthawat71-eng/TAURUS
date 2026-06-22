// Imperative, promise-based dialogs — mirror the toast store so any callsite
// can `await confirmDialog(...)` / `await promptDialog(...)` instead of using
// window.confirm / window.prompt. <ConfirmHost /> subscribes and renders them.

export interface DialogOptions {
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  /** When present, the dialog shows a text input and resolves its value. */
  input?: { placeholder?: string; defaultValue?: string }
}
export interface DialogState extends DialogOptions { id: number }

type Listener = (state: DialogState | null) => void

let current: DialogState | null = null
let resolver: ((result: boolean | string | null) => void) | null = null
const listeners = new Set<Listener>()
let nextId = 1

function emit() { for (const l of listeners) l(current) }

export function subscribeConfirm(l: Listener) {
  listeners.add(l)
  l(current)
  return () => { listeners.delete(l) }
}

function open(options: DialogOptions): Promise<boolean | string | null> {
  // A second dialog opening cancels any pending one.
  if (resolver) resolver(false)
  return new Promise((resolve) => {
    resolver = resolve
    current = { id: nextId++, ...options }
    emit()
  })
}

/** Confirm dialog. Pass a string for a plain message, or options for a title /
 *  custom labels / danger styling. Resolves true when confirmed. */
export function confirmDialog(opts: DialogOptions | string): Promise<boolean> {
  const options = typeof opts === 'string' ? { message: opts } : opts
  return open(options).then((r) => r === true)
}

/** Prompt dialog with a text field. Resolves the entered string, or null when
 *  cancelled. */
export function promptDialog(opts: DialogOptions & { input?: DialogOptions['input'] } | string): Promise<string | null> {
  const options = typeof opts === 'string' ? { message: opts } : opts
  return open({ ...options, input: options.input ?? {} }).then((r) => (typeof r === 'string' ? r : null))
}

/** Called by <ConfirmHost /> when the user answers (or dismisses). */
export function resolveDialog(result: boolean | string | null) {
  if (!resolver) return
  resolver(result)
  resolver = null
  current = null
  emit()
}
