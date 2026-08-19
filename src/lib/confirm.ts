// Imperative, promise-based dialogs — mirror the toast store so any callsite
// can `await confirmDialog(...)` / `await promptDialog(...)` instead of using
// window.confirm / window.prompt. <ConfirmHost /> subscribes and renders them.

import type { ReactNode } from 'react'

export interface DialogChoice { label: string; value: string; danger?: boolean }
export interface DialogOptions {
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  /** Optional icon shown in a coloured circle at the top of a centered card. */
  icon?: ReactNode
  /** Colour theme for the icon circle (defaults to brand, or danger red). */
  tone?: 'brand' | 'warn' | 'danger'
  /** A single-button acknowledgement card (no cancel — just closes). */
  dismissOnly?: boolean
  /** When present, the dialog shows a text input and resolves its value. */
  input?: { placeholder?: string; defaultValue?: string }
  /** When present, the dialog shows a stacked list of buttons and resolves the
   *  chosen `value` (or null on cancel/dismiss). */
  choices?: DialogChoice[]
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

/** One-button acknowledgement card (e.g. "already exists"). No action to
 *  confirm — it just informs and closes. Resolves when dismissed. */
export function alertDialog(opts: DialogOptions): Promise<void> {
  return open({ ...opts, dismissOnly: true }).then(() => undefined)
}

/** Multiple-choice dialog. Resolves the chosen option's `value`, or null when
 *  cancelled/dismissed. */
export function choiceDialog(opts: DialogOptions & { choices: DialogChoice[] }): Promise<string | null> {
  return open(opts).then((r) => (typeof r === 'string' ? r : null))
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
