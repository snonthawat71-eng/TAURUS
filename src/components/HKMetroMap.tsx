// Hong Kong MTR schematic (lines + station dots from the official PDFs).
// Stations are tappable (named via HK_NAMED) to pick origin/destination.
import { VIEW, HK_LINES, HK_STATIONS, HK_NAMED, HK_DASH, HK_EXTRA_LABELS } from '@/lib/metro/hkGeo'

// Diagonal interchanges, tilted +45° so the capsule lies across the lines it links.
// Tsing Yi joins the two parallel lines (Tung Chung + Airport Express) that both
// stop there, so it's centred on the dot. Sunny Bay joins only Tung Chung +
// Disneyland Resort (Airport Express passes through without stopping), so its
// capsule is nudged toward the Disney branch to stay clear of the airport line.
const DIAGONAL_XC: Record<string, { dx: number; dy: number; L: number }> = {
  '285.4,336.4': { dx: 0, dy: 0, L: 11 },     // Tsing Yi
  '238.5,383.4': { dx: 2.5, dy: 2.6, L: 9 },  // Sunny Bay
}

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
      {/* interchanges: one clear white capsule (the interchange symbol). Diagonal
          ones (Tsing Yi, Sunny Bay) are tilted +45° to lie across the lines. */}
      {HK_STATIONS.filter((s) => s.xc).map((s, i) => {
        const diag = DIAGONAL_XC[`${s.x},${s.y}`]
        if (diag) {
          const W = 6.7, cx = s.x + diag.dx, cy = s.y + diag.dy
          return <rect key={`x${i}`} x={cx - diag.L / 2} y={cy - W / 2} width={diag.L} height={W} rx={W / 2}
            fill="#fff" stroke="#001F50" strokeWidth={2} transform={`rotate(45 ${cx} ${cy})`} />
        }
        const w = Math.max(7, s.w), h = Math.max(7, s.h)
        return <rect key={`x${i}`} x={s.x - w / 2} y={s.y - h / 2} width={w} height={h} rx={Math.min(w, h) / 2}
          fill="#fff" stroke="#001F50" strokeWidth={2} />
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
