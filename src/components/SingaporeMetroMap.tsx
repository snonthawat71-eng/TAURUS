// Singapore rail map, rendered from the geometry lifted out of the two official
// PDFs (see singaporeGeo.ts): route lines, code boxes, codes and station names
// all sit exactly where the artwork puts them, so nothing collides.
//
// Every code box is tappable and reports the station id it belongs to.
import { VIEW, SG_LINES, SG_STATIONS, SG_LABELS, NAME_SIZE, NAME_LINE_H } from '@/lib/metro/singaporeGeo'

export function SingaporeMetroMap({ zoom = 1, from, to, onTap }: {
  zoom?: number
  /** station ids */
  from?: string | null
  to?: string | null
  onTap?: (stationId: string) => void
}) {
  const mark = (id: string) => (id && id === from ? '#0270fb' : id && id === to ? '#e5006d' : null)

  return (
    <svg width={VIEW.w * zoom} height={VIEW.h * zoom} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="block mx-auto">
      {SG_LINES.map((l, i) => (
        <polyline key={i} points={l.points} fill="none" stroke={l.color}
          strokeWidth={Math.max(1.6, l.w)} strokeLinejoin="round" strokeLinecap="round" />
      ))}

      {/* station names — placed clear of every line, box and code */}
      {SG_LABELS.map((n) => {
        const top = n.y - ((n.lines.length - 1) * NAME_LINE_H) / 2
        return (
          <text key={n.station} x={n.x} y={top} fontSize={NAME_SIZE} fontWeight={500}
            textAnchor="middle" dominantBaseline="central" fill="#1b2430"
            style={{ pointerEvents: 'none' }}>
            {n.lines.map((t, i) => (
              <tspan key={i} x={n.x} dy={i === 0 ? 0 : NAME_LINE_H}>{t}</tspan>
            ))}
          </text>
        )
      })}

      {/* code boxes */}
      {SG_STATIONS.map((s) => {
        const sel = mark(s.station)
        return (
          <g key={s.code} onClick={() => s.station && onTap?.(s.station)}
            style={{ cursor: s.station ? 'pointer' : 'default' }}>
            {sel && (
              <rect x={s.x - s.w / 2 - 1.6} y={s.y - s.h / 2 - 1.6} width={s.w + 3.2} height={s.h + 3.2}
                rx={(s.h + 3.2) / 2.4} fill="none" stroke={sel} strokeWidth={1.6} />
            )}
            <rect x={s.x - s.w / 2} y={s.y - s.h / 2} width={s.w} height={s.h} rx={s.h / 2.4}
              fill={s.color} stroke="#fff" strokeWidth={0.8} />
            <text x={s.x} y={s.ty} fontSize={s.fs} fontWeight={600}
              textAnchor="middle" dominantBaseline="central" fill="#fff"
              style={{ pointerEvents: 'none' }}>{s.code}</text>
            <title>{`${s.name || s.code} (${s.code})`}</title>
          </g>
        )
      })}
    </svg>
  )
}
