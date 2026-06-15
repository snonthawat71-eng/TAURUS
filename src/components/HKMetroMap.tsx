// Hong Kong MTR schematic (lines + station dots from the official PDFs).
// Stations are tappable (named via HK_NAMED) to pick origin/destination.
import { VIEW, HK_LINES, HK_STATIONS, HK_NAMED } from '@/lib/metro/hkGeo'

export function HKMetroMap({ zoom = 1, from, to, onTap }: {
  zoom?: number
  from?: string | null
  to?: string | null
  onTap?: (name: string) => void
}) {
  return (
    <svg width={VIEW.w * zoom} height={VIEW.h * zoom} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="block mx-auto">
      {HK_LINES.map((l, i) => (
        <polyline key={i} points={l.points} fill="none" stroke={l.color}
          strokeWidth={Math.max(3.5, l.w)} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {/* single-line stations: white dot, line-colour ring */}
      {HK_STATIONS.filter((s) => !s.xc).map((s, i) => (
        <circle key={`s${i}`} cx={s.x} cy={s.y} r={3.4} fill="#fff" stroke={s.color} strokeWidth={1.8} />
      ))}
      {/* interchanges: one clear white capsule (the interchange symbol) */}
      {HK_STATIONS.filter((s) => s.xc).map((s, i) => {
        const w = Math.max(7, s.w), h = Math.max(7, s.h)
        return <rect key={`x${i}`} x={s.x - w / 2} y={s.y - h / 2} width={w} height={h} rx={Math.min(w, h) / 2}
          fill="#fff" stroke="#001F50" strokeWidth={2} />
      })}
      {/* station name labels — offset to the open side so they don't cross lines */}
      {HK_NAMED.map((s, i) => (
        <text key={`l${i}`} x={s.lx} y={s.ly} fontSize={4.2} fontWeight={500}
          textAnchor={s.a as 'start' | 'middle' | 'end'} fill="#1b2430" stroke="#fff" strokeWidth={1} paintOrder="stroke"
          style={{ pointerEvents: 'none' }}>{s.name}</text>
      ))}
      {/* selection highlight */}
      {HK_NAMED.filter((s) => s.name === from || s.name === to).map((s, i) => (
        <circle key={`h${i}`} cx={s.x} cy={s.y} r={s.xc ? 9 : 6.5} fill="none"
          stroke={s.name === from ? '#0270fb' : '#e5006d'} strokeWidth={3} />
      ))}
      {/* tap hotspots */}
      {onTap && HK_NAMED.map((s, i) => (
        <circle key={`t${i}`} cx={s.x} cy={s.y} r={7} fill="transparent" style={{ cursor: 'pointer' }}
          onClick={() => onTap(s.name)}>
          <title>{s.name}</title>
        </circle>
      ))}
    </svg>
  )
}
