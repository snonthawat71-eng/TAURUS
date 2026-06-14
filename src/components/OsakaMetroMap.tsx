// Osaka Metro schematic rendered from geometry extracted out of the official
// route-map PDF (colored lines only). Lines and station dots line up exactly
// because they come from the same source coordinates.
import { VIEW, GEO_LINES, GEO_DOTS, GEO_WHITE } from '@/lib/metro/osakaGeo'

export function OsakaMetroMap({ zoom = 1 }: { zoom?: number }) {
  return (
    <svg width={VIEW.w * zoom} height={VIEW.h * zoom} viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="block">
      {/* lines */}
      {GEO_LINES.map((l, i) => (
        <polyline key={i} points={l.points} fill="none" stroke={l.color}
          strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {/* colored station ticks */}
      {GEO_DOTS.map((d, i) => {
        const s = Math.abs(d.s)
        return <rect key={`d${i}`} x={d.x - s / 2} y={d.y - s / 2} width={s} height={s} rx={2} fill={d.color} />
      })}
      {/* white interchange / station squares */}
      {GEO_WHITE.map((d, i) => {
        const s = Math.abs(d.s)
        return <rect key={`w${i}`} x={d.x - s / 2} y={d.y - s / 2} width={s} height={s} rx={2.5}
          fill="#fff" stroke="#7a828c" strokeWidth={1.4} />
      })}
    </svg>
  )
}
