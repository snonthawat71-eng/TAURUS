import { useState } from 'react'
import { createPortal } from 'react-dom'
import { IconX, IconPlus, IconMinus } from '@tabler/icons-react'
import { ShenzhenMetroMap } from './ShenzhenMetroMap'
import { PinchZoomPane } from './PinchZoomPane'
import { SZ_LEGEND } from '@/lib/metro/shenzhenGeo'

// Display-only reference map: the source PDF has only the coloured route lines
// (no station names), so this viewer shows the line map + legend for the user to
// read while filling in transit legs manually. No tap-to-route yet.
export function ShenzhenMapViewer({ onClose }: { onClose: () => void }) {
  const [zoom, setZoom] = useState(1)

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-canvas flex flex-col">
      <div className="flex items-center justify-between px-4 h-14 shrink-0" style={{ borderBottom: '0.5px solid var(--color-line)' }}>
        <div className="text-[15px] font-medium">รถไฟฟ้าเซินเจิ้น · แผนผังเส้นทาง</div>
        <button onClick={onClose} className="btn-icon !border-0"><IconX size={18} /></button>
      </div>

      {/* map */}
      <div className="flex-1 relative min-h-0">
        <PinchZoomPane zoom={zoom} setZoom={(z) => setZoom(z)} min={0.6} max={4} className="absolute inset-0 overflow-auto bg-surface-2/40">
          <ShenzhenMetroMap zoom={zoom} />
        </PinchZoomPane>
        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-10">
          <button onClick={() => setZoom((z) => Math.min(4, z + 0.3))} className="btn-icon bg-surface shadow"><IconPlus size={16} /></button>
          <button onClick={() => setZoom((z) => Math.max(0.6, z - 0.3))} className="btn-icon bg-surface shadow"><IconMinus size={16} /></button>
        </div>
      </div>

      {/* legend */}
      <div className="shrink-0 p-4 bg-surface" style={{ borderTop: '0.5px solid var(--color-line)', maxHeight: '40dvh', overflowY: 'auto' }}>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {SZ_LEGEND.map((l) => (
            <span key={l.name} className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
              <span className="inline-block w-5 h-1.5 rounded-full" style={{ background: l.color }} />
              {l.name}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-ink-3 mt-2.5">แผนผังนี้แสดงเฉพาะเส้นทาง/สี (ยังไม่มีชื่อสถานี) — ใช้ดูประกอบขณะกรอกเส้นทางการเดินทางด้านล่าง</p>
      </div>
    </div>,
    document.body,
  )
}
