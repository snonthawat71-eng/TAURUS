import { type ReactNode } from 'react'
import { IconWalk, IconDoorExit, IconPencil } from '@tabler/icons-react'
import { modeMeta } from '@/lib/transitModes'
import type { Transit, TransitLeg } from '@/lib/database.types'

/**
 * AMap-style metro route.
 * Smaller circles + thicker colored bars for better proportion; the transfer
 * walking icon sits on the same row as its text.
 */

type Line = 'solid' | 'dashed' | 'none'

function Row({ marker, color, line, boardIcon, children }: { marker: 'board' | 'alight' | 'walk'; color: string; line: Line; boardIcon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-2.5 items-stretch">
      <div className="w-5 flex flex-col items-center shrink-0">
        {marker === 'board' && (
          <span className="size-4 rounded-full grid place-items-center text-white shrink-0" style={{ background: color }}>
            {boardIcon}
          </span>
        )}
        {marker === 'alight' && (
          // ring drawn as an outer colored disc + inner surface disc, so a
          // two-tone (gradient) line colour shows on both halves, not just a border.
          <span className="size-4 rounded-full grid place-items-center shrink-0" style={{ background: color }}>
            <span className="rounded-full bg-surface" style={{ width: 7, height: 7 }} />
          </span>
        )}
        {marker === 'walk' && (
          <span className="size-4 rounded-full bg-surface grid place-items-center text-ink-3 shrink-0" style={{ border: '0.5px solid var(--color-line)' }}>
            <IconWalk size={11} />
          </span>
        )}
        {line === 'solid' && <span className="flex-1 my-1" style={{ width: 7, background: color, borderRadius: 4 }} />}
        {line === 'dashed' && <span className="flex-1 my-1" style={{ borderLeft: '2.5px dashed var(--color-line-2)' }} />}
      </div>
      <div className="flex-1 min-w-0 pb-3">{children}</div>
    </div>
  )
}

function BoardContent({ leg }: { leg: TransitLeg }) {
  const m = modeMeta(leg.mode)
  const MIcon = m.icon
  return (
    <>
      <div className="text-[13px] font-medium leading-tight">{leg.from}</div>
      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-[11px] text-ink-3">
        <span className="inline-flex items-center gap-1 rounded-[6px] px-2 py-0.5 font-medium text-white" style={{ background: leg.color }}>
          <MIcon size={11} />
          {leg.line || m.label}
        </span>
        <span>
          {leg.direction && `→ ${leg.direction}`}
          {leg.stops != null && ` · ${leg.stops} สถานี`}
          {leg.minutes != null && ` · ${leg.minutes} นาที`}
        </span>
      </div>
    </>
  )
}

export function MetroRoute({ transit, onEdit }: { transit: Transit; onEdit?: () => void }) {
  const { legs, exit } = transit
  if (!legs?.length) return null
  const last = legs.length - 1

  return (
    <div className="mt-2.5 rounded-[10px] bg-surface-2/40 p-3.5 relative" style={{ border: '0.5px solid var(--color-line)' }}>
      {onEdit && (
        <button onClick={onEdit} className="absolute top-2.5 right-2.5 btn-icon !size-7 !border-0 text-ink-3" aria-label="แก้ไขเส้นทาง">
          <IconPencil size={14} />
        </button>
      )}
      {legs.map((leg, i) => {
        const MIcon = modeMeta(leg.mode).icon
        return (
        <div key={i}>
          <Row marker="board" color={leg.color} line="solid" boardIcon={<MIcon size={10} />}>
            <BoardContent leg={leg} />
          </Row>
          <Row marker="alight" color={leg.color} line={i < last ? 'dashed' : 'none'}>
            <div className="text-[13px] font-medium leading-tight pt-0.5">{leg.to}</div>
            {i === last && exit && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[11px] font-medium"
                style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }}>
                <IconDoorExit size={13} /> ออก {exit.label}{exit.note && ` · ${exit.note}`}
              </div>
            )}
          </Row>
          {i < last && (
            <Row marker="walk" color={leg.color} line="dashed">
              <div className="text-[11px] text-ink-3 pt-0.5">
                เปลี่ยนต่อ · เดิน
                {leg.transferAfter?.walkMeters != null && ` ${leg.transferAfter.walkMeters}m`}
                {leg.transferAfter?.minutes != null && ` · ~${leg.transferAfter.minutes} นาที`}
              </div>
            </Row>
          )}
        </div>
        )
      })}
    </div>
  )
}
