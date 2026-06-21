// Shenzhen Metro schematic rendered from geometry extracted out of the official
// route-line PDF: route lines only (the source PDF has no station names, dots or
// labels). A lines-only reference map — no tappable stations / routing yet.
// Colours are the official per-line colours from the legend PDF.
import { VIEW, SZ_LINES } from '@/lib/metro/shenzhenGeo'

export function ShenzhenMetroMap({ zoom = 1 }: { zoom?: number }) {
  return (
    <svg width={VIEW.w * zoom} height={VIEW.h * zoom} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="block mx-auto">
      {SZ_LINES.map((l, i) => (
        <polyline key={i} points={l.points} fill="none" stroke={l.color}
          strokeWidth={Math.max(3, l.w)} strokeLinejoin="round" strokeLinecap="round" />
      ))}
    </svg>
  )
}
