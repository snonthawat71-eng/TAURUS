import { IconTrain, IconWalk, IconArrowRight, IconDoorExit } from '@tabler/icons-react'
import type { Transit } from '@/lib/database.types'

/**
 * AMap-style metro route renderer.
 * - board station   = filled circle (line color) + white train icon
 * - alight station  = hollow circle (3px line-color ring, white fill)
 * - colored bar     = the line you ride (6px wide, line color)
 * - transfer        = walking icon + dashed connector
 * - line tag        = sits UNDER the board station name
 * - exit            = green tag at the very end
 */
export function MetroRoute({ transit }: { transit: Transit }) {
  const { legs, exit } = transit
  if (!legs?.length) return null

  return (
    <div className="mt-2 rounded-[10px] bg-surface-2/50 p-3" style={{ border: '0.5px solid var(--color-line)' }}>
      {legs.map((leg, i) => {
        const isLast = i === legs.length - 1
        return (
          <div key={i}>
            {/* Board node */}
            <div className="flex gap-3">
              <div className="w-6 flex flex-col items-center shrink-0">
                <span
                  className="size-6 rounded-full grid place-items-center text-white shrink-0"
                  style={{ background: leg.color }}
                >
                  <IconTrain size={13} />
                </span>
                {/* colored bar to the alight node */}
                <span className="flex-1 my-0.5" style={{ width: 6, background: leg.color, borderRadius: 3, minHeight: 26 }} />
              </div>
              <div className="flex-1 pb-1 min-w-0">
                <div className="text-[13px] font-medium leading-tight">{leg.from}</div>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-flex items-center rounded-[6px] px-2 py-0.5 text-[11px] font-medium text-white"
                    style={{ background: leg.color }}
                  >
                    {leg.line}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-ink-3">
                  <IconArrowRight size={12} />
                  <span>
                    {leg.direction}
                    {leg.stops != null && ` · ${leg.stops} สถานี`}
                    {leg.minutes != null && ` · ${leg.minutes} นาที`}
                  </span>
                </div>
              </div>
            </div>

            {/* Alight node */}
            <div className="flex gap-3">
              <div className="w-6 flex flex-col items-center shrink-0">
                <span
                  className="size-6 rounded-full bg-surface shrink-0"
                  style={{ border: `3px solid ${leg.color}` }}
                />
                {/* connector below alight: dashed transfer, or nothing if last */}
                {!isLast && (
                  <span className="relative flex-1 my-0.5 grid place-items-center" style={{ minHeight: 30 }}>
                    <span className="absolute inset-0 grid place-items-center">
                      <span style={{ width: 0, height: '100%', borderLeft: '2px dashed var(--color-line-2)' }} />
                    </span>
                    <span className="relative z-10 size-5 rounded-full bg-surface grid place-items-center text-ink-3"
                      style={{ border: '0.5px solid var(--color-line)' }}>
                      <IconWalk size={12} />
                    </span>
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0 pb-2">
                <div className="text-[13px] font-medium leading-tight">{leg.to}</div>
                {leg.transferAfter && (
                  <div className="mt-1 text-[11px] text-ink-3">
                    เปลี่ยนสาย · เดินในสถานี
                    {leg.transferAfter.walkMeters != null && ` ${leg.transferAfter.walkMeters}m`}
                    {leg.transferAfter.minutes != null && ` (~${leg.transferAfter.minutes} นาที)`}
                  </div>
                )}
                {isLast && exit && (
                  <div
                    className="mt-1.5 inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[11px] font-medium"
                    style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }}
                  >
                    <IconDoorExit size={13} />
                    ออก {exit.label}
                    {exit.note && ` · ${exit.note}`}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
