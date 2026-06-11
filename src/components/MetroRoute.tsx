import { type ReactNode } from 'react'
import { IconTrain, IconWalk, IconDoorExit, IconPencil } from '@tabler/icons-react'
import type { Transit } from '@/lib/database.types'

/**
 * AMap-style metro route.
 * - board station = filled circle (line color) + white train icon
 * - alight station = hollow circle (ring in line color)
 * - colored bar    = the line you ride
 * - transfer       = dashed connector with a walking icon
 * - line tag sits on the meta line under the board station name
 * - exit           = green tag at the end
 */

type Conn = 'solid' | 'dashed' | 'none'

function Node({
  filled, color, connector, children,
}: {
  filled: boolean
  color: string
  connector: Conn
  children: ReactNode
}) {
  return (
    <div className="flex gap-3 items-stretch">
      <div className="w-6 flex flex-col items-center shrink-0">
        {filled ? (
          <span className="size-6 rounded-full grid place-items-center text-white shrink-0" style={{ background: color }}>
            <IconTrain size={13} />
          </span>
        ) : (
          <span className="size-6 rounded-full bg-surface shrink-0" style={{ border: `3px solid ${color}` }} />
        )}
        {connector === 'solid' && (
          <span className="flex-1 my-1" style={{ width: 5, background: color, borderRadius: 3 }} />
        )}
        {connector === 'dashed' && (
          <span className="relative flex-1 my-1 grid place-items-center">
            <span className="absolute inset-y-0" style={{ borderLeft: '2px dashed var(--color-line-2)' }} />
            <span className="relative size-5 rounded-full bg-surface grid place-items-center text-ink-3"
              style={{ border: '0.5px solid var(--color-line)' }}>
              <IconWalk size={12} />
            </span>
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0 pb-3">{children}</div>
    </div>
  )
}

export function MetroRoute({ transit, onEdit }: { transit: Transit; onEdit?: () => void }) {
  const { legs, exit } = transit
  if (!legs?.length) return null
  const lastLeg = legs.length - 1

  return (
    <div className="mt-2.5 rounded-[10px] bg-surface-2/40 p-3.5 relative" style={{ border: '0.5px solid var(--color-line)' }}>
      {onEdit && (
        <button onClick={onEdit} className="absolute top-2.5 right-2.5 btn-icon !size-7 !border-0 text-ink-3" aria-label="แก้ไขเส้นทาง">
          <IconPencil size={14} />
        </button>
      )}
      {legs.map((leg, i) => (
        <div key={i}>
          {/* Board */}
          <Node filled color={leg.color} connector="solid">
            <div className="text-[13px] font-medium leading-tight">{leg.from}</div>
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-[11px] text-ink-3">
              <span className="inline-flex items-center rounded-[6px] px-2 py-0.5 font-medium text-white" style={{ background: leg.color }}>
                {leg.line}
              </span>
              <span>
                → {leg.direction}
                {leg.stops != null && ` · ${leg.stops} สถานี`}
                {leg.minutes != null && ` · ${leg.minutes} นาที`}
              </span>
            </div>
          </Node>

          {/* Alight */}
          <Node filled={false} color={leg.color} connector={i < lastLeg ? 'dashed' : 'none'}>
            <div className="text-[13px] font-medium leading-tight">{leg.to}</div>
            {leg.transferAfter && (
              <div className="mt-1 text-[11px] text-ink-3">
                เปลี่ยนสาย · เดินในสถานี
                {leg.transferAfter.walkMeters != null && ` ${leg.transferAfter.walkMeters}m`}
                {leg.transferAfter.minutes != null && ` · ~${leg.transferAfter.minutes} นาที`}
              </div>
            )}
            {i === lastLeg && exit && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[11px] font-medium"
                style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }}>
                <IconDoorExit size={13} /> ออก {exit.label}{exit.note && ` · ${exit.note}`}
              </div>
            )}
          </Node>
        </div>
      ))}
    </div>
  )
}
