import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconX, IconPlus, IconMinus, IconSearch, IconMapPin, IconFlag, IconArrowsExchange } from '@tabler/icons-react'
import { ShanghaiMetroMap } from './ShanghaiMetroMap'
import { MetroRoute } from './MetroRoute'
import { SH_NETWORK, SH_STATION_LIST, computeRouteShanghai } from '@/lib/metro/shanghaiNetwork'
import type { Transit } from '@/lib/database.types'

export function ShanghaiMapViewer({ onClose, onResult }: { onClose: () => void; onResult?: (t: Transit) => void }) {
  const [zoom, setZoom] = useState(1)
  const [from, setFrom] = useState<string | null>(null)
  const [to, setTo] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const transit = useMemo(() => (from && to ? computeRouteShanghai(from, to) : null), [from, to])
  function pick(name: string) {
    if (!from) setFrom(name)
    else if (name === from) setFrom(null)
    else if (!to) setTo(name)
    else { setFrom(name); setTo(null) }
  }
  const matches = q.trim()
    ? SH_STATION_LIST.filter((s) => s.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
    : []

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-canvas flex flex-col">
      <div className="flex items-center justify-between px-4 h-14 shrink-0" style={{ borderBottom: '0.5px solid var(--color-line)' }}>
        <div className="text-[15px] font-medium">รถไฟฟ้าเซี่ยงไฮ้ · เลือกสถานี</div>
        <button onClick={onClose} className="btn-icon !border-0"><IconX size={18} /></button>
      </div>

      {/* search */}
      <div className="px-4 py-2.5 shrink-0 relative">
        <div className="flex items-center gap-2 rounded-md hairline px-3 h-10 bg-surface">
          <IconSearch size={16} className="text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อสถานี (เช่น People's Square, Lujiazui)"
            className="flex-1 bg-transparent outline-none text-[13px]" />
        </div>
        {matches.length > 0 && (
          <div className="absolute left-4 right-4 mt-1 card p-1 shadow-lg z-20 max-h-60 overflow-y-auto">
            {matches.map((s) => (
              <button key={s} onClick={() => { pick(s); setQ('') }}
                className="w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-[13px] hover:bg-surface-2">
                {SH_NETWORK.filter((l) => l.stations.includes(s)).map((l) => <span key={l.id} className="size-2.5 rounded-full" style={{ background: l.color }} />)}
                <span className="flex-1 text-left">{s}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* map */}
      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0 overflow-auto bg-surface-2/40">
          <ShanghaiMetroMap zoom={zoom} from={from} to={to} onTap={pick} />
        </div>
        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-10">
          <button onClick={() => setZoom((z) => Math.min(3, z + 0.3))} className="btn-icon bg-surface shadow"><IconPlus size={16} /></button>
          <button onClick={() => setZoom((z) => Math.max(0.6, z - 0.3))} className="btn-icon bg-surface shadow"><IconMinus size={16} /></button>
        </div>
      </div>

      {/* bottom panel */}
      <div className="shrink-0 p-4 bg-surface" style={{ borderTop: '0.5px solid var(--color-line)', maxHeight: '45dvh', overflowY: 'auto' }}>
        <div className="flex items-center gap-2 text-[13px] flex-wrap">
          <span className="chip"><IconMapPin size={13} /> ต้นทาง: <b className="ml-1">{from || '—'}</b></span>
          {(from || to) && (
            <button onClick={() => { setFrom(to); setTo(from) }} aria-label="สลับต้นทาง/ปลายทาง" title="สลับต้นทาง/ปลายทาง"
              className="size-7 rounded-full grid place-items-center bg-surface-2 hover:bg-line text-ink-2 shrink-0">
              <IconArrowsExchange size={15} />
            </button>
          )}
          <span className="chip"><IconFlag size={13} /> ปลายทาง: <b className="ml-1">{to || '—'}</b></span>
          {(from || to) && <button onClick={() => { setFrom(null); setTo(null) }} className="btn-link text-[12px]">ล้าง</button>}
        </div>
        {transit && transit.legs.length > 0 ? (
          <>
            <MetroRoute transit={transit} />
            {onResult && <button onClick={() => onResult(transit)} className="btn-primary w-full h-10 mt-3">ใช้เส้นทางนี้ (กรอกเวลา/ทางออกเพิ่มได้)</button>}
          </>
        ) : (
          <p className="text-[12px] text-ink-3 mt-2">แตะสถานีบนแผนที่ (หรือค้นหา) เลือกต้นทาง + ปลายทาง ระบบจะคำนวณจุดเปลี่ยนสายให้</p>
        )}
      </div>
    </div>,
    document.body,
  )
}
