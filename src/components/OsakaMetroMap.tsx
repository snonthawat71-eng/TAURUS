// Osaka Metro schematic rendered from geometry extracted out of the official
// route-map PDF (colored lines only). Lines, station dots and codes share the
// same source coordinates so everything lines up. Square markers = Osaka Metro
// stations; circles = through-service stations on other operators (Kita-Osaka
// Kyuko M0x, Hankyu HKxx, Kintetsu C2x).
import { useMemo } from 'react'
import { VIEW, GEO_LINES, GEO_LABELS, GEO_CIRCLES } from '@/lib/metro/osakaGeo'

const LINE_COLOR: Record<string, string> = {
  M: '#E5171F', T: '#762F8E', Y: '#0078BE', C: '#009944', S: '#E5007F',
  K: '#8E591F', N: '#9DC238', I: '#EE7B1A', P: '#00A6CF',
}

const BW = 30 // code box width
const BH = 16 // code box height

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
          strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
      ))}

      {/* through-service circle stations (other operators) */}
      {GEO_CIRCLES.map((c, i) => {
        const two = c.code.length > 3
        return (
          <g key={`c${i}`}>
            <circle cx={c.x} cy={c.y} r={8.5} fill="#fff" stroke={c.color} strokeWidth={2} />
            {two ? (
              <text x={c.x} y={c.y} fontSize={5} fontWeight={700} textAnchor="middle" fill={c.color} style={{ pointerEvents: 'none' }}>
                <tspan x={c.x} dy={-1.3}>{c.code.slice(0, 2)}</tspan>
                <tspan x={c.x} dy={6}>{c.code.slice(2)}</tspan>
              </text>
            ) : (
              <text x={c.x} y={c.y + 2} fontSize={6} fontWeight={700} textAnchor="middle" fill={c.color} style={{ pointerEvents: 'none' }}>{c.code}</text>
            )}
          </g>
        )
      })}

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
                  <rect x={g.cx - BW / 2} y={y} width={BW} height={BH} rx={3}
                    fill={it.color} stroke="#fff" strokeWidth={1} />
                  <text x={g.cx} y={y + BH / 2} fontSize={9.5} fontWeight={700}
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
