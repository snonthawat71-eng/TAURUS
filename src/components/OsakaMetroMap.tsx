// Osaka Metro schematic rendered from geometry extracted out of the official
// route-map PDF. Square code boxes = routable Osaka Metro stations (tappable);
// circles = through-service stations on other operators (display only).
import { useMemo } from 'react'
import { GEO_LINES, GEO_LABELS, GEO_CIRCLES, GEO_INTERCHANGES } from '@/lib/metro/osakaGeo'

const LINE_COLOR: Record<string, string> = {
  M: '#E5171F', T: '#762F8E', Y: '#0078BE', C: '#009944', S: '#E5007F',
  K: '#8E591F', N: '#9DC238', I: '#EE7B1A', P: '#00A6CF',
}

const BW = 32 // code box width
const BH = 17 // code box height
const GAP = 2 // gap between stacked boxes at an interchange

// Stack interchange codes (one physical station) neatly; everything else stands alone.
function useStacks() {
  return useMemo(() => {
    const posOf = new Map(GEO_LABELS.map((l) => [l.code, l]))
    const grouped = new Set<string>()
    const out: { cx: number; cy: number; items: { code: string; color: string }[] }[] = []
    for (const grp of GEO_INTERCHANGES) {
      const members = grp.filter((c) => posOf.has(c))
      if (members.length < 2) continue
      let cx = 0, cy = 0
      for (const c of members) { cx += posOf.get(c)!.x; cy += posOf.get(c)!.y; grouped.add(c) }
      out.push({ cx: cx / members.length, cy: cy / members.length, items: members.map((c) => ({ code: c, color: LINE_COLOR[c[0]] })) })
    }
    for (const l of GEO_LABELS) {
      if (grouped.has(l.code)) continue
      out.push({ cx: l.x, cy: l.y, items: [{ code: l.code, color: LINE_COLOR[l.code[0]] }] })
    }
    return out
  }, [])
}

// Tight bounding box of all geometry so the map sits centered in the frame.
function useViewBox() {
  return useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const eat = (x: number, y: number) => { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y }
    for (const l of GEO_LINES) for (const p of l.points.split(' ')) { const [x, y] = p.split(',').map(Number); eat(x, y) }
    for (const c of GEO_CIRCLES) { eat(c.x - 9, c.y - 9); eat(c.x + 9, c.y + 9) }
    for (const g of GEO_LABELS) { eat(g.x - BW / 2, g.y - BH); eat(g.x + BW / 2, g.y + BH) }
    const pad = 16
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
  }, [])
}

export function OsakaMetroMap({ from, to, zoom = 1, onSelect }: {
  from?: string | null
  to?: string | null
  zoom?: number
  onSelect?: (code: string) => void
}) {
  const stacks = useStacks()
  const vb = useViewBox()
  return (
    <svg width={vb.w * zoom} height={vb.h * zoom} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="block mx-auto">
      {/* lines */}
      {GEO_LINES.map((l, i) => (
        <polyline key={i} points={l.points} fill="none" stroke={l.color}
          strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
      ))}

      {/* through-service circle stations (other operators, display only) */}
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

      {/* station code boxes (stacked at interchanges, tappable) */}
      {stacks.map((g, gi) => {
        const total = g.items.length
        const blockH = total * BH + (total - 1) * GAP
        const top = g.cy - blockH / 2
        return (
          <g key={gi}>
            {g.items.map((it, k) => {
              const y = top + k * (BH + GAP)
              const sel = it.code === from ? '#0270fb' : it.code === to ? '#e5006d' : null
              return (
                <g key={k} onClick={() => onSelect?.(it.code)} style={{ cursor: 'pointer' }}>
                  {sel && <rect x={g.cx - BW / 2 - 3} y={y - 3} width={BW + 6} height={BH + 6} rx={5} fill="none" stroke={sel} strokeWidth={3} />}
                  <rect x={g.cx - BW / 2} y={y} width={BW} height={BH} rx={3.5}
                    fill={it.color} stroke="#fff" strokeWidth={1.4} />
                  <text x={g.cx} y={y + BH / 2} fontSize={10} fontWeight={700}
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
