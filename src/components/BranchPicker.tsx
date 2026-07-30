import type { PlaceBranch } from '@/lib/database.types'

/**
 * Branch picker for a chain with several locations. Shared by the Explore place
 * page, the Explore drawer and a trip's own place detail so the control looks
 * the same everywhere.
 *
 * Deliberately not wrapped in a card: it sits between cards, and a card inside
 * a card reads as clutter. It borrows the pill rail from the Explore filter bar
 * instead — hairline border when idle, solid brand when picked — which is how
 * the rest of the app says "this one is selected".
 */
export function BranchPicker({ branches, value, onChange, hasOwnLocation, ownLabel }: {
  branches: PlaceBranch[]
  /** index into `branches`, or null for the item's own location */
  value: number | null
  onChange: (i: number | null) => void
  /** does the item itself have a location worth offering as its own branch? */
  hasOwnLocation: boolean
  /** what that location is called (`branch_label`). Falls back to the generic
   *  "ที่ตั้งหลัก" for places saved before the field existed. */
  ownLabel?: string | null
}) {
  if (!branches.length) return null
  const total = branches.length + (hasOwnLocation ? 1 : 0)
  const own = ownLabel?.trim() || 'ที่ตั้งหลัก'

  const pill = (on: boolean) => [
    'shrink-0 h-9 px-4 rounded-full text-[12.5px] font-semibold whitespace-nowrap border transition',
    on ? 'bg-brand text-white border-transparent' : 'bg-surface text-ink-2 border-line-2',
  ].join(' ')

  return (
    <div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-[12px] font-semibold text-ink-2">สาขา</span>
        <span className="text-[11px] text-ink-3">{total} ที่</span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {hasOwnLocation && (
          <button onClick={() => onChange(null)} className={pill(value === null)}>{own}</button>
        )}
        {branches.map((b, i) => (
          <button key={i} onClick={() => onChange(i)} className={pill(value === i)}>
            {b.label || `สาขา ${i + 1}`}
          </button>
        ))}
      </div>
    </div>
  )
}
