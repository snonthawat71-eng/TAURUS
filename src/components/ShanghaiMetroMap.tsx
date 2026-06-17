// Shanghai Metro schematic rendered from line geometry extracted out of the
// official route-map PDF. First pass: route lines only (station dots/labels are
// layered on later), mirroring HKMetroMap / OsakaMetroMap.
import { VIEW, SH_LINES } from '@/lib/metro/shanghaiGeo'

export function ShanghaiMetroMap({ zoom = 1 }: { zoom?: number }) {
  return (
    <svg width={VIEW.w * zoom} height={VIEW.h * zoom} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="block mx-auto">
      {SH_LINES.map((l, i) => (
        <polyline key={i} points={l.points} fill="none" stroke={l.color}
          strokeWidth={Math.max(3.2, l.w)} strokeLinejoin="round" strokeLinecap="round" />
      ))}
    </svg>
  )
}
