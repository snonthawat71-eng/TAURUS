// Shanghai Metro schematic rendered from geometry extracted out of the official
// route-map PDF: route lines + station dots + name labels. Every routable
// station is a tappable dot on its line; interchanges (multiple lines) are drawn
// as a distinct capsule. Mirrors HKMetroMap / OsakaMetroMap.
import { VIEW, SH_LINES, SH_DOTS, SH_TICKS, SH_NAMES, SH_STATION_POINTS } from '@/lib/metro/shanghaiGeo'

export function ShanghaiMetroMap({ zoom = 1, from, to, onTap }: {
  zoom?: number
  from?: string | null
  to?: string | null
  onTap?: (name: string) => void
}) {
  const points = Object.entries(SH_STATION_POINTS)
  return (
    <svg width={VIEW.w * zoom} height={VIEW.h * zoom} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="block mx-auto">
      {/* route lines */}
      {SH_LINES.map((l, i) => (
        <polyline key={i} points={l.points} fill="none" stroke={l.color}
          strokeWidth={Math.max(3.2, l.w)} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {/* single-line stations: small white dot with a line-coloured ring (true artwork positions) */}
      {SH_TICKS.map((t, i) => (
        <circle key={`s${i}`} cx={t.x} cy={t.y} r={2.3} fill="#fff" stroke={t.c} strokeWidth={1.3} />
      ))}
      {/* interchanges: distinct white capsule with a dark ring (joins multiple lines) */}
      {SH_DOTS.map((d, i) => {
        const w = Math.max(6.5, d.w), h = Math.max(6.5, d.h)
        return <rect key={`x${i}`} x={d.x - w / 2} y={d.y - h / 2} width={w} height={h} rx={Math.min(w, h) / 2}
          fill="#fff" stroke="#222" strokeWidth={2} />
      })}
      {/* station name labels (placed as in the official artwork) */}
      {SH_NAMES.map((n, i) => (
        <text key={`n${i}`} x={n.x} y={n.y} fontSize={4.3} fontWeight={500}
          textAnchor="middle" dominantBaseline="central" fill="#1b2430"
          stroke="#fff" strokeWidth={0.9} paintOrder="stroke"
          style={{ pointerEvents: 'none' }}>{n.t}</text>
      ))}
      {/* selection highlight */}
      {points.filter(([name]) => name === from || name === to).map(([name, p]) => (
        <circle key={`h${name}`} cx={p.x} cy={p.y} r={p.xc ? 7.5 : 5} fill="none"
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
