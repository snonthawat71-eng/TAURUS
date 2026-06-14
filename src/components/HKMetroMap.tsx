// Hong Kong MTR schematic rendered from geometry extracted out of the official
// system-map PDF (colored lines + station circles). Display-only for now.
import { VIEW, HK_LINES, HK_STATIONS } from '@/lib/metro/hkGeo'

export function HKMetroMap({ zoom = 1 }: { zoom?: number }) {
  return (
    <svg width={VIEW.w * zoom} height={VIEW.h * zoom} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="block mx-auto">
      {HK_LINES.map((l, i) => (
        <polyline key={i} points={l.points} fill="none" stroke={l.color}
          strokeWidth={Math.max(3.5, l.w)} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {HK_STATIONS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={Math.max(3, s.r)} fill="#fff" stroke="#001F50" strokeWidth={1.6} />
      ))}
    </svg>
  )
}
