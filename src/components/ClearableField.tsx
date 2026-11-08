import { useRef, type InputHTMLAttributes } from 'react'
import { IconX } from '@tabler/icons-react'

// Box wrapper for native date/time inputs: the ✕ is a real flex sibling (not an
// overlay) so iOS Safari's native control can never paint over it, and overflow
// is clipped so a long localized value (e.g. "27 Oct BE 2569") can't push past
// the box. Height matches the other text inputs (h-10) so fields stay aligned.
const fieldBox = 'hairline rounded-md h-10 bg-surface w-full min-w-0 flex items-center overflow-hidden focus-within:border-brand'

/** Native date/time field with a height that matches text inputs and a working ✕ clear button on iOS. */
export function ClearableField({ type, value, onChange, onClear, ariaLabel, min, max }: {
  type: 'date' | 'time' | 'datetime-local'
  value: string
  onChange: (val: string) => void
  onClear: () => void
  ariaLabel: string
  min?: string
  max?: string
}) {
  return (
    <div className={fieldBox}>
      <input type={type} value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 h-full bg-transparent outline-none px-3 text-[13px] appearance-none" />
      {value && (
        <button type="button" onClick={onClear} aria-label={ariaLabel}
          className="shrink-0 size-8 grid place-items-center text-ink-3 hover:text-ink-2"><IconX size={14} /></button>
      )}
    </div>
  )
}

// Classes that position the field inside its parent have to live on the
// wrapper, not the input, or a field in a flex row stops stretching.
const LAYOUT = ['flex-1', 'w-full', 'min-w-0', 'mt-1', 'mt-2', 'mt-2.5', 'mt-3']

/**
 * Text input with a ✕ that empties it — same props as <input>, so a call site
 * only swaps the tag name.
 *
 * Clearing writes '' through the native value setter and dispatches a real
 * input event, which is what makes React's own onChange fire with the empty
 * value: assigning `el.value` alone is swallowed, because React's value
 * tracker thinks nothing changed. That way the parent's existing
 * `onChange={(e) => setX(e.target.value)}` does the clearing and no call site
 * needs an extra handler.
 */
export function ClearableText({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null)
  const has = String(rest.value ?? '').length > 0

  function clear() {
    const el = ref.current
    if (!el) return
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(el, '')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.focus()
  }

  const parts = className.split(/\s+/).filter(Boolean)
  const outer = parts.filter((c) => LAYOUT.includes(c))
  const inner = parts.filter((c) => !LAYOUT.includes(c))

  return (
    <div className={`relative min-w-0 ${outer.join(' ')}`}>
      <input ref={ref} {...rest} className={`${inner.join(' ')} w-full ${has ? '!pr-9' : ''}`} />
      {has && (
        <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={clear}
          aria-label="ล้างข้อความ"
          className="absolute right-0 top-0 h-full w-9 grid place-items-center text-ink-3 hover:text-ink-2">
          <IconX size={14} />
        </button>
      )}
    </div>
  )
}
