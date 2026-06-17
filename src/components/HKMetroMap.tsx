// Hong Kong MTR schematic (lines + station dots from the official PDFs).
// Stations are tappable (named via HK_NAMED) to pick origin/destination.
import { VIEW, HK_LINES, HK_STATIONS, HK_NAMED, HK_DASH, HK_EXTRA_LABELS } from '@/lib/metro/hkGeo'

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
      {/* walking-interchange dashed links (e.g. Kowloon · West Kowloon · Austin) */}
      {HK_DASH.map((d, i) => (
        <polyline key={`d${i}`} points={d} fill="none" stroke="#8a8f98" strokeWidth={1.4}
          strokeDasharray="3 3" strokeLinecap="round" />
      ))}
      {/* single-line stations: white dot, line-colour ring */}
      {HK_STATIONS.filter((s) => !s.xc).map((s, i) => (
        <circle key={`s${i}`} cx={s.x} cy={s.y} r={3.4} fill="#fff" stroke={s.color} strokeWidth={1.8} />
      ))}
      {/* interchanges: a figure-8 of two linked white rings (the transfer symbol),
          oriented along the station's long axis (vertical when h >= w) */}
      {HK_STATIONS.filter((s) => s.xc).map((s, i) => {
        const R = 2.75
        const vert = s.h >= s.w
        const o1 = vert ? { cx: s.x, cy: s.y - R } : { cx: s.x - R, cy: s.y }
        const o2 = vert ? { cx: s.x, cy: s.y + R } : { cx: s.x + R, cy: s.y }
        return (
          <g key={`x${i}`}>
            <circle cx={o1.cx} cy={o1.cy} r={R} fill="#fff" stroke="#001F50" strokeWidth={2} />
            <circle cx={o2.cx} cy={o2.cy} r={R} fill="#fff" stroke="#001F50" strokeWidth={2} />
          </g>
        )
      })}
      {/* station name labels — offset to the open side so they don't cross lines.
          dominantBaseline='central' vertically centres the text on its coordinate,
          matching the Shanghai map's label placement. */}
      {HK_NAMED.map((s, i) => (
        <text key={`l${i}`} x={s.lx} y={s.ly} fontSize={4.2} fontWeight={500}
          textAnchor={s.a as 'start' | 'middle' | 'end'} dominantBaseline="central" fill="#1b2430" stroke="#fff" strokeWidth={1} paintOrder="stroke"
          style={{ pointerEvents: 'none' }}>{s.name}</text>
      ))}
      {/* extra (non-routable) labels e.g. high-speed rail terminus */}
      {HK_EXTRA_LABELS.map((s, i) => (
        <text key={`e${i}`} x={s.lx} y={s.ly} fontSize={4.2} fontWeight={600}
          textAnchor={s.a as 'start' | 'middle' | 'end'} dominantBaseline="central" fill="#5a4636" stroke="#fff" strokeWidth={1} paintOrder="stroke"
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
