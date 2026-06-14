// Hand-drawn schematic of the Osaka Metro (colored lines only), styled after the
// official route map. Purely presentational geometry — routing still uses the
// network topology in src/lib/metro. Interchange squares are tappable and carry a
// real station id so taps feed straight into the router.
import type { BuiltNetwork } from '@/lib/metro'

// official-ish line colors
const LINES: { id: string; color: string; points: string }[] = [
  { id: 'M', color: '#E5171F', points: '350,70 350,910' },
  { id: 'Y', color: '#0078BE', points: '250,150 250,560 305,730 305,895' },
  { id: 'K', color: '#8E591F', points: '365,868 405,845 470,770 470,150 760,150 760,95' },
  { id: 'T', color: '#762F8E', points: '835,915 700,855 570,735 570,235 660,120 820,120 820,95' },
  { id: 'I', color: '#EE7B1A', points: '705,615 705,255 770,255 770,205' },
  { id: 'C', color: '#009944', points: '65,615 110,565 175,470 865,470' },
  { id: 'N', color: '#9DC238', points: '120,635 205,545 660,545 745,470 905,470' },
  { id: 'S', color: '#E5007F', points: '150,470 150,560 215,615 745,615 850,690 905,720' },
  { id: 'P', color: '#00A6CF', points: '65,565 65,790 215,905 305,895' },
]

// interchange squares (id must exist in the network so taps reach the router)
const NODES: { id: string; x: number; y: number }[] = [
  { id: 'umeda', x: 350, y: 250 },
  { id: 'hommachi', x: 350, y: 470 },
  { id: 'shinsaibashi', x: 350, y: 545 },
  { id: 'namba', x: 350, y: 615 },
  { id: 'dobutsuen-mae', x: 408, y: 715 },
  { id: 'tennoji', x: 350, y: 800 },
  { id: 'awaza', x: 250, y: 470 },
  { id: 'cosmosquare', x: 65, y: 565 },
  { id: 'suminoekoen', x: 305, y: 895 },
  { id: 'sakaisuji-hommachi', x: 470, y: 470 },
  { id: 'nagahoribashi', x: 470, y: 545 },
  { id: 'nippombashi', x: 470, y: 615 },
  { id: 'tanimachi-4', x: 570, y: 470 },
  { id: 'tanimachi-6', x: 570, y: 545 },
  { id: 'tanimachi-9', x: 570, y: 615 },
  { id: 'morinomiya', x: 660, y: 470 },
  { id: 'midoribashi', x: 705, y: 470 },
  { id: 'gamo-4', x: 745, y: 520 },
  { id: 'imazato', x: 705, y: 615 },
  { id: 'tenjimbashi-6', x: 520, y: 150 },
  { id: 'minami-morimachi', x: 470, y: 300 },
  { id: 'kitahama', x: 470, y: 415 },
  { id: 'kyobashi', x: 745, y: 440 },
  { id: 'taishibashi', x: 690, y: 150 },
]

export function OsakaMetroMap({ net, from, to, zoom = 1, onTap }: {
  net: BuiltNetwork
  from: string | null
  to: string | null
  zoom?: number
  onTap: (id: string) => void
}) {
  const W = 960
  const H = 960
  return (
    <svg width={W * zoom} height={H * zoom} viewBox={`0 0 ${W} ${H}`} className="block">
      {/* lines */}
      {LINES.map((l) => (
        <polyline key={l.id} points={l.points} fill="none" stroke={l.color}
          strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" />
      ))}

      {/* interchange squares */}
      {NODES.map((n) => {
        const sel = n.id === from ? 'from' : n.id === to ? 'to' : null
        const name = net.stationById[n.id]?.name ?? n.id
        return (
          <g key={n.id} onClick={() => onTap(n.id)} style={{ cursor: 'pointer' }}>
            <rect x={n.x - 16} y={n.y - 16} width={32} height={32} fill="transparent" />
            <rect x={n.x - 9} y={n.y - 9} width={18} height={18} rx={3.5}
              fill="#fff"
              stroke={sel === 'from' ? '#0270fb' : sel === 'to' ? '#e5006d' : '#52606e'}
              strokeWidth={sel ? 3.5 : 2} />
            {sel && (
              <text x={n.x + 13} y={n.y + 4} fontSize={13} fontWeight={600}
                fill={sel === 'from' ? '#0270fb' : '#e5006d'} style={{ pointerEvents: 'none' }}>{name}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
