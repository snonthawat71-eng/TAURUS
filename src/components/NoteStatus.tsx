import type { NoteStatus } from '@/lib/database.types'

export const STATUS_META: Record<NoteStatus, { label: string; color: string; bg: string }> = {
  draft:       { label: 'Draft',       color: '#3F4753', bg: '#EDF0F4' },
  in_progress: { label: 'In-progress', color: '#E4711E', bg: '#FBE8D4' },
  in_review:   { label: 'In-review',   color: '#2563EB', bg: '#E7ECFD' },
  completed:   { label: 'Completed',   color: '#15803D', bg: '#D8F2E1' },
}
export const STATUS_ORDER: NoteStatus[] = ['draft', 'in_progress', 'in_review', 'completed']

/** The four status glyphs from the reference — drawn by hand so they match:
 *  dashed ring · left-half fill · ¾ pie · filled check. Uses currentColor. */
export function StatusIcon({ status, size = 16 }: { status: NoteStatus; size?: number }) {
  const c = 'currentColor'
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className="shrink-0">
      {status === 'draft' && (
        <circle cx="10" cy="10" r="7" stroke={c} strokeWidth="1.6" strokeDasharray="2.6 2.4" />
      )}
      {status === 'in_progress' && (
        <>
          <circle cx="10" cy="10" r="7" stroke={c} strokeWidth="1.6" />
          <path d="M10 3 a7 7 0 0 0 0 14 z" fill={c} />
        </>
      )}
      {status === 'in_review' && (
        <>
          <circle cx="10" cy="10" r="7" stroke={c} strokeWidth="1.6" />
          <path d="M10 10 L10 3 A7 7 0 1 0 17 10 Z" fill={c} />
        </>
      )}
      {status === 'completed' && (
        <>
          <circle cx="10" cy="10" r="8.5" fill={c} />
          <path d="M6 10.2 l2.6 2.6 l5.4 -5.7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  )
}

/** The status pill (icon + label on a soft tint) exactly like the reference. */
export function StatusBadge({ status, size = 'md' }: { status: NoteStatus; size?: 'sm' | 'md' }) {
  const m = STATUS_META[status]
  const sm = size === 'sm'
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sm ? 'gap-1 px-2 py-0.5 text-[10.5px]' : 'gap-1.5 px-2.5 py-1 text-[12px]'}`}
      style={{ background: m.bg, color: m.color }}>
      <StatusIcon status={status} size={sm ? 13 : 15} /> {m.label}
    </span>
  )
}
