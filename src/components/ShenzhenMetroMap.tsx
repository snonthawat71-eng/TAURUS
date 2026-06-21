// Shenzhen Metro schematic rendered from geometry extracted out of the official
// route-line + station-dot PDFs: route lines + single-line station dots +
// interchange markers. The source PDFs have no station names/labels, so dots are
// not tappable / named yet (routing comes later). Mirrors ShanghaiMetroMap.
import { VIEW, SZ_LINES, SZ_TICKS, SZ_INTERCHANGES, SZ_NAMES } from '@/lib/metro/shenzhenGeo'

export function ShenzhenMetroMap({ zoom = 1 }: { zoom?: number }) {
  return (
    <svg width={VIEW.w * zoom} height={VIEW.h * zoom} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="block mx-auto">
      {/* route lines */}
      {SZ_LINES.map((l, i) => (
        <polyline key={i} points={l.points} fill="none" stroke={l.color}
          strokeWidth={Math.max(3, l.w)} strokeLinejoin="round" strokeLinecap="round" />
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
    </svg>
  )
}
