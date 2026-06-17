// Shanghai Metro schematic rendered from geometry extracted out of the official
// route-map PDF: route lines + interchange dots. Station name labels and routing
// are a later pass. Mirrors HKMetroMap / OsakaMetroMap.
import { VIEW, SH_LINES, SH_DOTS } from '@/lib/metro/shanghaiGeo'

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
    </svg>
  )
}
