// Osaka Metro schematic rendered from geometry extracted out of the official
// route-map PDF (colored lines only). Lines, station dots and codes share the
// same source coordinates so everything lines up.
import { useMemo } from 'react'
import { VIEW, GEO_LINES, GEO_LABELS } from '@/lib/metro/osakaGeo'

const LINE_COLOR: Record<string, string> = {
  M: '#E5171F', T: '#762F8E', Y: '#0078BE', C: '#009944', S: '#E5007F',
  K: '#8E591F', N: '#9DC238', I: '#EE7B1A', P: '#00A6CF',
}

const BW = 26 // code box width
const BH = 13 // code box height

// Group station codes that sit on top of each other (interchanges) so they can
// be stacked vertically like the official map instead of overlapping.
function useStacks() {
  return useMemo(() => {
    const used = new Array(GEO_LABELS.length).fill(false)
    const out: { cx: number; cy: number; items: { code: string; color: string }[] }[] = []
    for (let i = 0; i < GEO_LABELS.length; i++) {
      if (used[i]) continue
      const a = GEO_LABELS[i]
      const items = [{ code: a.code, color: LINE_COLOR[a.code[0]] }]
      let cx = a.x, cy = a.y, n = 1
      for (let j = i + 1; j < GEO_LABELS.length; j++) {
        if (used[j]) continue
        const b = GEO_LABELS[j]
        if (Math.abs(b.x - a.x) < 15 && Math.abs(b.y - a.y) < 15) {
          used[j] = true; items.push({ code: b.code, color: LINE_COLOR[b.code[0]] })
          cx += b.x; cy += b.y; n++
        }
      }
      used[i] = true
      out.push({ cx: cx / n, cy: cy / n, items })
    }
    return out
  }, [])
}

export function OsakaMetroMap({ zoom = 1 }: { zoom?: number }) {
  const stacks = useStacks()
  return (
    <svg width={VIEW.w * zoom} height={VIEW.h * zoom} viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="block">
      {/* lines */}
      {GEO_LINES.map((l, i) => (
        <polyline key={i} points={l.points} fill="none" stroke={l.color}
          strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {/* station code boxes (stacked at interchanges) */}
      {stacks.map((g, gi) => {
        const total = g.items.length
        const top = g.cy - (total * BH) / 2
        return (
          <g key={gi}>
            {g.items.map((it, k) => {
              const y = top + k * BH
              return (
                <g key={k}>
                  <rect x={g.cx - BW / 2} y={y} width={BW} height={BH} rx={2.5}
                    fill={it.color} stroke="#fff" strokeWidth={0.8} />
                  <text x={g.cx} y={y + BH / 2 + 0.5} fontSize={8} fontWeight={700}
                    textAnchor="middle" dominantBaseline="central" fill="#fff"
                    style={{ pointerEvents: 'none' }}>{it.code}</text>
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
