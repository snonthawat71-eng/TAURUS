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
