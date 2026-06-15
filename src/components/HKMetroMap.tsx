// Hong Kong MTR schematic rendered from geometry extracted out of the official
// system-map PDFs (colored lines + station dots). Single-line stations show the
// line colour; interchanges are one clear white "pill" so taps aren't ambiguous.
import { VIEW, HK_LINES, HK_STATIONS } from '@/lib/metro/hkGeo'

export function HKMetroMap({ zoom = 1, onTapInterchange }: { zoom?: number; onTapInterchange?: (i: number) => void }) {
  return (
    <svg width={VIEW.w * zoom} height={VIEW.h * zoom} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="block mx-auto">
      {HK_LINES.map((l, i) => (
        <polyline key={i} points={l.points} fill="none" stroke={l.color}
          strokeWidth={Math.max(3.5, l.w)} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {/* single-line stations: small white dot with the line colour */}
      {HK_STATIONS.filter((s) => !s.xc).map((s, i) => (
        <circle key={`s${i}`} cx={s.x} cy={s.y} r={3.4} fill="#fff" stroke={s.color} strokeWidth={1.8} />
      ))}
      {/* interchanges: one white pill (rounded) with a dark outline — clearly tappable */}
      {HK_STATIONS.filter((s) => s.xc).map((s, i) => {
        const w = Math.max(7, s.w), h = Math.max(7, s.h)
        return (
          <rect key={`x${i}`} x={s.x - w / 2} y={s.y - h / 2} width={w} height={h} rx={Math.min(w, h) / 2}
            fill="#fff" stroke="#001F50" strokeWidth={2}
            onClick={onTapInterchange ? () => onTapInterchange(i) : undefined}
            style={onTapInterchange ? { cursor: 'pointer' } : undefined} />
        )
      })}
    </svg>
  )
}
