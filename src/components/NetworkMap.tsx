// A tappable schematic drawn straight from a BuiltNetwork — no per-city artwork
// needed, so any network that carries station coordinates (`hubs`) gets a map
// for free. Singapore uses this today; Tokyo can once it has coordinates.
//
// Osaka keeps its own bespoke component: its geometry came out of the official
// route-map PDF and is nicer than anything generated.
import { useMemo } from 'react'
import type { BuiltNetwork, StationNode } from '@/lib/metro/types'

/** Station codes across the lines it sits on, e.g. ["NS1", "EW24"]. */
export function codesOf(_net: BuiltNetwork, s: StationNode): string[] {
  return s.lineIds.map((id) => s.numbers[id]).filter(Boolean)
}

export function NetworkMap({ net, from, to, zoom = 1, onSelect }: {
  net: BuiltNetwork
  /** station ids */
  from?: string | null
  to?: string | null
  zoom?: number
  onSelect?: (id: string) => void
}) {
  // one polyline per line, through its stations in order
  const polys = useMemo(() => net.lines.map((l) => ({
    id: l.id,
    color: l.color,
    points: l.stations.map((s) => {
      const n = net.stationById[s.id]
      return `${n.x},${n.y}`
    }).join(' '),
    thin: l.stations.length < 16, // LRT / shuttle lines read better thinner
  })), [net])

  const pad = 26
  const w = net.width + pad * 2
  const h = net.height + pad * 2

  return (
    <svg width={w * zoom} height={h * zoom} viewBox={`${-pad} ${-pad} ${w} ${h}`} className="block mx-auto">
      {polys.map((p) => (
        <polyline key={p.id} points={p.points} fill="none" stroke={p.color}
          strokeWidth={p.thin ? 5 : 8} strokeLinejoin="round" strokeLinecap="round" opacity={p.thin ? 0.9 : 1} />
      ))}

      {net.stations.map((s) => {
        const many = s.lineIds.length > 1
        const sel = s.id === from ? '#0270fb' : s.id === to ? '#e5006d' : null
        const color = net.lineById[s.lineIds[0]]?.color ?? '#888780'
        return (
          <g key={s.id} onClick={() => onSelect?.(s.id)} style={{ cursor: 'pointer' }}>
            {sel && <circle cx={s.x} cy={s.y} r={many ? 12 : 9} fill="none" stroke={sel} strokeWidth={3} />}
            <circle cx={s.x} cy={s.y} r={many ? 6 : 3.6} fill="#fff"
              stroke={many ? '#222' : color} strokeWidth={many ? 2.6 : 2} />
            {/* tap target — comfortably bigger than the dot it sits on */}
            <circle cx={s.x} cy={s.y} r={11} fill="transparent">
              <title>{`${s.name} (${codesOf(net, s).join(' / ')})`}</title>
            </circle>
            <text x={s.x + 8} y={s.y + 3} fontSize={7.5} fontWeight={many ? 700 : 500}
              fill="#1b2430" stroke="#fff" strokeWidth={1.6} paintOrder="stroke"
              style={{ pointerEvents: 'none' }}>{s.name}</text>
          </g>
        )
      })}
    </svg>
  )
}
