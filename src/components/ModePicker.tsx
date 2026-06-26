import { TRANSIT_MODES, modeMeta } from '@/lib/transitModes'

/** A compact 5×2 grid of travel modes — all ten visible at once (no scrolling),
 *  each an icon + short label. Shared by the route editor and the Explore editor. */
export function ModePicker({ value, onChange }: {
  value?: string | null
  onChange: (mode: string) => void
}) {
  const cur = modeMeta(value).key
  return (
    <div className="grid grid-cols-5 gap-1">
      {TRANSIT_MODES.map((m) => {
        const Icon = m.icon
        const on = cur === m.key
        return (
          <button key={m.key} type="button" onClick={() => onChange(m.key)} aria-pressed={on}
            className="flex flex-col items-center justify-center gap-0.5 rounded-[9px] py-1.5 text-[9px] font-medium leading-tight text-center transition-colors"
            style={on ? { background: m.color, color: '#fff' } : { background: 'var(--color-surface-2)', color: 'var(--color-ink-2)' }}>
            <Icon size={16} />
            <span className="truncate w-full px-0.5">{m.short}</span>
          </button>
        )
      })}
    </div>
  )
}
