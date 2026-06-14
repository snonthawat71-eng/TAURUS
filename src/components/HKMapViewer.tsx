import { useState } from 'react'
import { createPortal } from 'react-dom'
import { IconX, IconPlus, IconMinus } from '@tabler/icons-react'
import { HKMetroMap } from './HKMetroMap'

const LEGEND: { label: string; color: string }[] = [
  { label: 'Tsuen Wan', color: '#E6000F' },
  { label: 'Kwun Tong', color: '#00A040' },
  { label: 'Island', color: '#0075C2' },
  { label: 'Tseung Kwan O', color: '#7D3C93' },
  { label: 'Tung Chung', color: '#F3982C' },
  { label: 'Airport Express', color: '#00888E' },
  { label: 'Tuen Ma', color: '#9C2E00' },
  { label: 'East Rail', color: '#5DB7E8' },
  { label: 'South Island', color: '#CBD300' },
  { label: 'Disneyland', color: '#EB6EA5' },
]

export function HKMapViewer({ onClose }: { onClose: () => void }) {
  const [zoom, setZoom] = useState(1)
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-canvas flex flex-col">
      <div className="flex items-center justify-between px-4 h-14 shrink-0" style={{ borderBottom: '0.5px solid var(--color-line)' }}>
        <div className="text-[15px] font-medium">MTR ฮ่องกง · แผนที่เส้นทาง</div>
        <button onClick={onClose} className="btn-icon !border-0"><IconX size={18} /></button>
      </div>

      {/* legend */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 py-2 shrink-0" style={{ borderBottom: '0.5px solid var(--color-line)' }}>
        {LEGEND.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5 text-[11px] text-ink-2 whitespace-nowrap">
            <span className="size-2.5 rounded-full" style={{ background: l.color }} /> {l.label}
          </span>
        ))}
      </div>

      {/* map */}
      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0 overflow-auto bg-surface-2/40">
          <HKMetroMap zoom={zoom} />
        </div>
        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-10">
          <button onClick={() => setZoom((z) => Math.min(3, z + 0.3))} className="btn-icon bg-surface shadow"><IconPlus size={16} /></button>
          <button onClick={() => setZoom((z) => Math.max(0.6, z - 0.3))} className="btn-icon bg-surface shadow"><IconMinus size={16} /></button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
