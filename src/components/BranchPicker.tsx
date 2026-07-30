import { IconBuildingStore, IconCheck } from '@tabler/icons-react'
import type { PlaceBranch } from '@/lib/database.types'

/**
 * Branch picker for a chain with several locations. Shared by the Explore place
 * page, the Explore drawer and a trip's own place detail so the control looks
 * the same everywhere.
 *
 * It used to be an 11px grey label over `chip`-sized buttons, which read as a
 * caption rather than the thing that decides which station and which map link
 * the rest of the card shows. Selected state is a solid brand fill — a tinted
 * background alone wasn't enough to tell at a glance which branch you were
 * looking at.
 */
export function BranchPicker({ branches, value, onChange, hasOwnLocation, compact = false }: {
  branches: PlaceBranch[]
  /** index into `branches`, or null for the item's own location */
  value: number | null
  onChange: (i: number | null) => void
  /** does the item itself have a location worth offering as "ที่ตั้งหลัก"? */
  hasOwnLocation: boolean
  /** tighter padding for the drawer */
  compact?: boolean
}) {
  if (!branches.length) return null
  const total = branches.length + (hasOwnLocation ? 1 : 0)
  const label = value == null ? 'ที่ตั้งหลัก' : (branches[value]?.label || `สาขา ${value + 1}`)

  const chip = (on: boolean) => ({
    className: 'shrink-0 inline-flex items-center gap-1 h-10 px-4 rounded-full text-[13px] font-semibold whitespace-nowrap transition',
    style: on
      ? { background: 'var(--color-brand)', color: '#fff', boxShadow: '0 3px 10px rgba(2,112,251,.28)' }
      : { background: 'var(--color-surface-2)', color: 'var(--color-ink-2)', border: '0.5px solid var(--color-line-2)' },
  })

  return (
    <div className={`card ${compact ? 'p-3' : 'p-3.5'}`} style={{ border: '0.5px solid var(--color-brand-border)' }}>
      <div className="flex items-center gap-2.5 mb-2.5">
        <span className="size-9 rounded-[10px] grid place-items-center shrink-0"
          style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}>
          <IconBuildingStore size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold leading-tight">เลือกสาขา</div>
          <div className="text-[11px] text-ink-3 leading-tight mt-0.5 truncate">
            {total} ที่ · กำลังดู <b className="text-ink-2">{label}</b>
          </div>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-0.5 px-0.5 py-1">
        {hasOwnLocation && (
          <button onClick={() => onChange(null)} {...chip(value === null)}>
            {value === null && <IconCheck size={14} />} ที่ตั้งหลัก
          </button>
        )}
        {branches.map((b, i) => (
          <button key={i} onClick={() => onChange(i)} {...chip(value === i)}>
            {value === i && <IconCheck size={14} />} {b.label || `สาขา ${i + 1}`}
          </button>
        ))}
      </div>
    </div>
  )
}
