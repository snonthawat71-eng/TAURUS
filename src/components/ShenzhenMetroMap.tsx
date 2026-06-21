// Shenzhen Metro schematic rendered from geometry extracted out of the official
// route-line + station-dot + station-name PDFs: route lines + station dots +
// interchange markers + name labels. Stations in SZ_STATION_POINTS are tappable
// (the safely name-matched subset); the rest stay visible and are selectable via
// search in the viewer. Mirrors ShanghaiMetroMap.
import { VIEW, SZ_LINES, SZ_TICKS, SZ_INTERCHANGES, SZ_NAMES, SZ_STATION_POINTS, SZ_WALK_LINKS } from '@/lib/metro/shenzhenGeo'

export function ShenzhenMetroMap({ zoom = 1, from, to, onTap }: {
  zoom?: number
  from?: string | null
  to?: string | null
  onTap?: (name: string) => void
}) {
  const points = Object.entries(SZ_STATION_POINTS)
  return (
    <svg width={VIEW.w * zoom} height={VIEW.h * zoom} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="block mx-auto">
      {/* route lines */}
      {SZ_LINES.map((l, i) => (
        <polyline key={i} points={l.points} fill="none" stroke={l.color}
          strokeWidth={Math.max(3, l.w)} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {/* out-of-station walking transfers: dashed connector */}
      {SZ_WALK_LINKS.map((w, i) => (
        <line key={`w${i}`} x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y}
          stroke="#9aa0a6" strokeWidth={1.3} strokeDasharray="2.2 2" strokeLinecap="round" />
      ))}
      {/* single-line stations: small white dot with a line-coloured ring */}
      {SZ_TICKS.map((t, i) => (
        <circle key={`s${i}`} cx={t.x} cy={t.y} r={2.3} fill="#fff" stroke={t.c} strokeWidth={1.3} />
      ))}
      {/* interchanges: distinct larger white dot with a bold dark ring */}
      {SZ_INTERCHANGES.map((p, i) => (
        <circle key={`x${i}`} cx={p.x} cy={p.y} r={4.3} fill="#fff" stroke="#222" strokeWidth={2} />
      ))}
      {/* station name labels (placed as in the official artwork) */}
      {SZ_NAMES.map((n, i) => (
        <text key={`n${i}`} x={n.x} y={n.y} fontSize={4.4} fontWeight={500}
          textAnchor="start" dominantBaseline="central" fill="#1b2430"
          stroke="#fff" strokeWidth={0.9} paintOrder="stroke"
          style={{ pointerEvents: 'none' }}>{n.t}</text>
      ))}
      {/* selection highlight */}
      {points.filter(([name]) => name === from || name === to).map(([name, p]) => (
        <circle key={`h${name}`} cx={p.x} cy={p.y} r={p.xc ? 7 : 5} fill="none"
          stroke={name === from ? '#0270fb' : '#e5006d'} strokeWidth={2.4} />
      ))}
      {/* highlight the secondary (walk-linked) dot too */}
      {SZ_WALK_LINKS.filter((w) => w.name === from || w.name === to).map((w, i) => (
        <circle key={`wh${i}`} cx={w.a.x} cy={w.a.y} r={7} fill="none"
          stroke={w.name === from ? '#0270fb' : '#e5006d'} strokeWidth={2.4} />
      ))}
      {/* tap hotspots on the named (matched) dots */}
      {onTap && points.map(([name, p]) => (
        <circle key={`t${name}`} cx={p.x} cy={p.y} r={p.xc ? 6.5 : 4.5} fill="transparent" style={{ cursor: 'pointer' }}
          onClick={() => onTap(name)}>
          <title>{name}</title>
        </circle>
      ))}
      {/* extra hotspots on the walk-linked secondary dots (e.g. red Line 4 side) */}
      {onTap && SZ_WALK_LINKS.map((w, i) => (
        <circle key={`wt${i}`} cx={w.a.x} cy={w.a.y} r={6.5} fill="transparent" style={{ cursor: 'pointer' }}
          onClick={() => onTap(w.name)}>
          <title>{w.name}</title>
        </circle>
      ))}
    </svg>
  )
}
