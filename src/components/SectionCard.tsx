import type { ReactNode } from 'react'
import { IconCheck, IconChevronDown, IconChevronUp } from '@tabler/icons-react'

/** One foldable section of a form. Three looks: open (editing), folded-done
 *  (green ✓ + summary), folded-empty (dashed, muted). Tap the header to
 *  open/close — no explicit "แก้ไข" affordance needed. Used by the Explore
 *  editor and the trip Place editor so both forms stay identical. */
export function SectionCard({ open, done, icon, title, sub, summary, onToggle, children }: {
  open: boolean
  done: boolean
  icon: ReactNode
  title: string
  sub?: string
  summary?: string
  onToggle: () => void
  children?: ReactNode
}) {
  if (open) {
    return (
      <div className="rounded-[13px] bg-surface overflow-hidden"
        style={{ border: '0.5px solid var(--color-brand-border)', boxShadow: '0 4px 14px rgba(2,112,251,0.07)' }}>
        <button type="button" onClick={onToggle} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left">
          <span className="size-7 rounded-[8px] grid place-items-center shrink-0"
            style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-mid)' }}>{icon}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-semibold text-ink">{title}</span>
            {sub && <span className="block text-[10.5px] text-ink-3">{sub}</span>}
          </span>
          <IconChevronUp size={15} className="text-ink-3 shrink-0" />
        </button>
        <div className="px-3 pb-3">{children}</div>
      </div>
    )
  }
  if (done) {
    return (
      <button type="button" onClick={onToggle}
        className="w-full rounded-[13px] bg-surface hairline flex items-center gap-2.5 px-3 py-2.5 text-left">
        <span className="size-7 rounded-full grid place-items-center shrink-0" style={{ background: '#ECFDF3', color: '#16A34A' }}>
          <IconCheck size={14} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold text-ink">{title}</span>
          {summary && <span className="block text-[11.5px] text-ink-2 truncate">{summary}</span>}
        </span>
      </button>
    )
  }
  return (
    <button type="button" onClick={onToggle}
      className="w-full rounded-[13px] flex items-center gap-2.5 px-3 py-2.5 text-left"
      style={{ border: '1px dashed var(--color-line-2)' }}>
      <span className="size-7 rounded-[8px] bg-surface-2 grid place-items-center text-ink-3 shrink-0">{icon}</span>
      <span className="text-[13px] font-medium text-ink-2">{title}</span>
      <IconChevronDown size={14} className="text-ink-3 ml-auto shrink-0" />
    </button>
  )
}
