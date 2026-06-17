// Shanghai Metro schematic rendered from geometry extracted out of the official
// route-map PDF: route lines + interchange dots + station name labels. Routing
// is a later pass. Mirrors HKMetroMap / OsakaMetroMap.
import { VIEW, SH_LINES, SH_DOTS, SH_NAMES } from '@/lib/metro/shanghaiGeo'

export function ShanghaiMetroMap({ zoom = 1 }: { zoom?: number }) {
  return (
    <svg width={VIEW.w * zoom} height={VIEW.h * zoom} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="block mx-auto">
      {/* route lines */}
      {SH_LINES.map((l, i) => (
        <polyline key={i} points={l.points} fill="none" stroke={l.color}
          strokeWidth={Math.max(3.2, l.w)} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {/* interchange stations: white rounded capsule with a dark ring */}
      {SH_DOTS.map((d, i) => {
        const w = Math.max(6, d.w), h = Math.max(6, d.h)
        return <rect key={`x${i}`} x={d.x - w / 2} y={d.y - h / 2} width={w} height={h} rx={Math.min(w, h) / 2}
          fill="#fff" stroke="#222" strokeWidth={1.8} />
      })}
      {/* station name labels (placed as in the official artwork) */}
      {SH_NAMES.map((n, i) => (
        <text key={`n${i}`} x={n.x} y={n.y} fontSize={4.3} fontWeight={500}
          textAnchor="middle" dominantBaseline="central" fill="#1b2430"
          stroke="#fff" strokeWidth={0.9} paintOrder="stroke"
          style={{ pointerEvents: 'none' }}>{n.t}</text>
      ))}
    </svg>
  )
}
