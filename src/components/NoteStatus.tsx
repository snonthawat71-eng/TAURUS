import type { NoteStatus } from '@/lib/database.types'

export const STATUS_META: Record<NoteStatus, { label: string; color: string; bg: string }> = {
  draft:  { label: 'Draft',  color: '#3F4753', bg: '#EDF0F4' },
  urgent: { label: 'Urgent', color: '#D92D20', bg: '#FCE4E2' },
  done:   { label: 'Done',   color: '#15803D', bg: '#D8F2E1' },
}
export const STATUS_ORDER: NoteStatus[] = ['draft', 'urgent', 'done']

/** Map any legacy/unknown status value onto the current three. */
export function normalizeStatus(s?: string | null): NoteStatus {
  if (s === 'done' || s === 'completed') return 'done'
  if (s === 'urgent') return 'urgent'
  return 'draft' // draft / in_progress / in_review / anything else
}

/** The status glyphs — drawn by hand: dashed ring · red "!" · green check. */
export function StatusIcon({ status, size = 16 }: { status: NoteStatus; size?: number }) {
  const c = 'currentColor'
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className="shrink-0">
      {status === 'draft' && (
        <circle cx="10" cy="10" r="7" stroke={c} strokeWidth="1.6" strokeDasharray="2.6 2.4" />
      )}
      {status === 'urgent' && (
        <>
          <circle cx="10" cy="10" r="8.5" fill={c} />
          <rect x="9.05" y="5" width="1.9" height="6.2" rx="0.95" fill="#fff" />
          <circle cx="10" cy="14" r="1.15" fill="#fff" />
        </>
      )}
      {status === 'done' && (
        <>
          <circle cx="10" cy="10" r="8.5" fill={c} />
          <path d="M6 10.2 l2.6 2.6 l5.4 -5.7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  )
}

/** The status pill (icon + label on a soft tint). */
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
