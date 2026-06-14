import { useMemo, useState } from 'react'
import { IconX, IconSearch, IconPlus, IconMinus, IconMapPin, IconFlag } from '@tabler/icons-react'
import { createPortal } from 'react-dom'
import { MetroRoute } from './MetroRoute'
import { OsakaMetroMap } from './OsakaMetroMap'
import { computeRoute, type BuiltNetwork } from '@/lib/metro'
import type { Transit } from '@/lib/database.types'

export function MetroMapPicker({ net, onClose, onResult }: {
  net: BuiltNetwork
  onClose: () => void
  onResult: (t: Transit) => void
}) {
  const [from, setFrom] = useState<string | null>(null)
  const [to, setTo] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [q, setQ] = useState('')

  const transit = useMemo<Transit | null>(() => (from && to ? computeRoute(net, from, to) : null), [from, to, net])

  function tap(id: string) {
    if (!from) setFrom(id)
    else if (id === from) setFrom(null)
    else if (!to) setTo(id)
    else { setFrom(id); setTo(null) }
  }
  const name = (id: string | null) => (id ? net.stationById[id]?.name : '')

  const matches = q.trim()
    ? net.stations.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
    : []

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-canvas flex flex-col">
      {/* header */}
      <div className="flex items-center justify-between px-4 h-14 shrink-0" style={{ borderBottom: '0.5px solid var(--color-line)' }}>
        <div className="text-[15px] font-medium">{net.name} · เลือกสถานี</div>
        <button onClick={onClose} className="btn-icon !border-0"><IconX size={18} /></button>
      </div>

      {/* search */}
      <div className="px-4 py-2.5 shrink-0 relative">
        <div className="flex items-center gap-2 rounded-md hairline px-3 h-10 bg-surface">
          <IconSearch size={16} className="text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาสถานี แล้วแตะเพื่อเลือก"
            className="flex-1 bg-transparent outline-none text-[13px]" />
        </div>
        {matches.length > 0 && (
          <div className="absolute left-4 right-4 mt-1 card p-1 shadow-lg z-20 max-h-60 overflow-y-auto">
            {matches.map((sn) => (
              <button key={sn.id} onClick={() => { tap(sn.id); setQ('') }}
                className="w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-[13px] hover:bg-surface-2">
                {sn.lineIds.map((l) => <span key={l} className="size-2.5 rounded-full" style={{ background: net.lineById[l].color }} />)}
                <span className="flex-1 text-left">{sn.name}</span>
                <span className="text-ink-3 text-[11px]">{Object.values(sn.numbers).join(' ')}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* map */}
      <div className="flex-1 overflow-auto relative bg-surface-2/40">
        <OsakaMetroMap net={net} from={from} to={to} zoom={zoom} onTap={tap} />
        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
          <button onClick={() => setZoom((z) => Math.min(2.2, z + 0.25))} className="btn-icon bg-surface shadow"><IconPlus size={16} /></button>
          <button onClick={() => setZoom((z) => Math.max(0.6, z - 0.25))} className="btn-icon bg-surface shadow"><IconMinus size={16} /></button>
        </div>
      </div>

      {/* bottom panel */}
      <div className="shrink-0 p-4 bg-surface" style={{ borderTop: '0.5px solid var(--color-line)', maxHeight: '45dvh', overflowY: 'auto' }}>
        <div className="flex items-center gap-2 text-[13px]">
          <span className="chip"><IconMapPin size={13} /> ต้นทาง: <b className="ml-1">{name(from) || '—'}</b></span>
          <span className="chip"><IconFlag size={13} /> ปลายทาง: <b className="ml-1">{name(to) || '—'}</b></span>
          {(from || to) && <button onClick={() => { setFrom(null); setTo(null) }} className="btn-link text-[12px]">ล้าง</button>}
        </div>
        {transit && transit.legs.length > 0 ? (
          <>
            <MetroRoute transit={transit} />
            <button onClick={() => onResult(transit)} className="btn-primary w-full h-10 mt-3">ใช้เส้นทางนี้ (กรอกเวลา/ทางออกเพิ่มได้)</button>
          </>
        ) : (
          <p className="text-[12px] text-ink-3 mt-2">แตะสถานีต้นทางและปลายทางบนแผนที่ (หรือค้นหา) ระบบจะคำนวณจุดเปลี่ยนสายให้</p>
        )}
      </div>
    </div>,
    document.body,
  )
}
