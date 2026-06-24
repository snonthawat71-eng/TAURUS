const cls = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface outline-none focus:border-brand'

/**
 * Compact "HH:MM" time field — a plain text input that auto-inserts the colon
 * and pops the numeric keypad. Used instead of the native type=time input,
 * which iOS renders at a fixed min width (ignoring CSS), so it overflowed
 * narrow columns. Pass `className` to control width (defaults to full width).
 */
export function TimeText({ value, onChange, className }: {
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <input
      type="text" inputMode="numeric" placeholder="09:45" maxLength={5}
      className={[cls, className ?? 'w-full min-w-0'].join(' ')} value={value}
      onChange={(e) => {
        let s = e.target.value.replace(/[^\d:]/g, '').replace(/^(\d{2})(\d)/, '$1:$2')
        if (s.length > 5) s = s.slice(0, 5)
        onChange(s)
      }}
    />
  )
}
