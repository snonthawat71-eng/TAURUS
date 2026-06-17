// Shanghai Metro schematic rendered from geometry extracted out of the official
// route-map PDF: route lines + station dots + name labels. Single-line stations
// are small line-coloured dots at their real artwork positions (SH_TICKS);
// interchanges are distinct dark-ring dots placed where their lines meet
// (SH_STATION_POINTS, xc). Every station is a tappable dot. Mirrors HKMetroMap.
import { VIEW, SH_LINES, SH_TICKS, SH_NAMES, SH_STATION_POINTS } from '@/lib/metro/shanghaiGeo'

export function ShanghaiMetroMap({ zoom = 1, from, to, onTap }: {
  zoom?: number
  from?: string | null
  to?: string | null
  onTap?: (name: string) => void
}) {
  const points = Object.entries(SH_STATION_POINTS)
  const interchanges = points.filter(([, p]) => p.xc)
  return (
    <svg width={VIEW.w * zoom} height={VIEW.h * zoom} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="block mx-auto">
      {/* route lines */}
      {SH_LINES.map((l, i) => (
        <polyline key={i} points={l.points} fill="none" stroke={l.color}
          strokeWidth={Math.max(3.2, l.w)} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {/* single-line stations: small white dot with a line-coloured ring */}
      {SH_TICKS.map((t, i) => (
        <circle key={`s${i}`} cx={t.x} cy={t.y} r={2.3} fill="#fff" stroke={t.c} strokeWidth={1.3} />
      ))}
      {/* interchanges: distinct larger white dot with a bold dark ring */}
      {interchanges.map(([name, p]) => (
        <circle key={`x${name}`} cx={p.x} cy={p.y} r={4.3} fill="#fff" stroke="#222" strokeWidth={2} />
      ))}
      {/* station name labels (placed as in the official artwork) */}
      {SH_NAMES.map((n, i) => (
        <text key={`n${i}`} x={n.x} y={n.y} fontSize={4.3} fontWeight={500}
          textAnchor="middle" dominantBaseline="central" fill="#1b2430"
          stroke="#fff" strokeWidth={0.9} paintOrder="stroke"
          style={{ pointerEvents: 'none' }}>{n.t}</text>
      ))}
      {/* selection highlight */}
      {points.filter(([name]) => name === from || name === to).map(([name, p]) => (
        <circle key={`h${name}`} cx={p.x} cy={p.y} r={p.xc ? 7 : 5} fill="none"
          stroke={name === from ? '#0270fb' : '#e5006d'} strokeWidth={2.4} />
      ))}
      {/* tap hotspots on the dots (not the labels) */}
      {onTap && points.map(([name, p]) => (
        <circle key={`t${name}`} cx={p.x} cy={p.y} r={p.xc ? 6.5 : 4.5} fill="transparent" style={{ cursor: 'pointer' }}
          onClick={() => onTap(name)}>
          <title>{name}</title>
        </circle>
      ))}
    </svg>
  )
}
