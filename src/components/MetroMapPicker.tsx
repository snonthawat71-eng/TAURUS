import { useMemo, useState } from 'react'
import { IconX, IconSearch, IconPlus, IconMinus, IconMapPin, IconFlag } from '@tabler/icons-react'
import { createPortal } from 'react-dom'
import { MetroRoute } from './MetroRoute'
import { OsakaMetroMap } from './OsakaMetroMap'
import { computeRouteByCode, stationName, STATION_LIST } from '@/lib/metro/osakaRoute'
import type { BuiltNetwork } from '@/lib/metro'
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

  const transit = useMemo<Transit | null>(() => (from && to ? computeRouteByCode(from, to) : null), [from, to])

  function tap(code: string) {
    if (!from) setFrom(code)
    else if (code === from) setFrom(null)
    else if (!to) setTo(code)
    else { setFrom(code); setTo(null) }
  }
  const label = (code: string | null) => (code ? `${stationName(code)} (${code})` : '')

  const matches = q.trim()
    ? STATION_LIST.filter((s) => {
        const t = q.trim().toLowerCase()
        return s.code.toLowerCase().includes(t) || s.name.toLowerCase().includes(t)
      }).slice(0, 8)
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
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหารหัส/ชื่อสถานี หรือแตะกล่องบนแผนที่"
            className="flex-1 bg-transparent outline-none text-[13px]" />
        </div>
        {matches.length > 0 && (
          <div className="absolute left-4 right-4 mt-1 card p-1 shadow-lg z-20 max-h-60 overflow-y-auto">
            {matches.map((sn) => (
              <button key={sn.code} onClick={() => { tap(sn.code); setQ('') }}
                className="w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-[13px] hover:bg-surface-2">
                <span className="font-medium">{sn.code}</span>
                <span className="flex-1 text-left text-ink-2 truncate">{sn.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* map (scrollable) + fixed zoom controls */}
      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0 overflow-auto bg-surface-2/40">
          <OsakaMetroMap from={from} to={to} zoom={zoom} onSelect={tap} />
        </div>
        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-10">
          <button onClick={() => setZoom((z) => Math.min(2.6, z + 0.3))} className="btn-icon bg-surface shadow"><IconPlus size={16} /></button>
          <button onClick={() => setZoom((z) => Math.max(0.6, z - 0.3))} className="btn-icon bg-surface shadow"><IconMinus size={16} /></button>
        </div>
      </div>

      {/* bottom panel */}
      <div className="shrink-0 p-4 bg-surface" style={{ borderTop: '0.5px solid var(--color-line)', maxHeight: '45dvh', overflowY: 'auto' }}>
        <div className="flex items-center gap-2 text-[13px] flex-wrap">
          <span className="chip"><IconMapPin size={13} /> ต้นทาง: <b className="ml-1">{label(from) || '—'}</b></span>
          <span className="chip"><IconFlag size={13} /> ปลายทาง: <b className="ml-1">{label(to) || '—'}</b></span>
          {(from || to) && <button onClick={() => { setFrom(null); setTo(null) }} className="btn-link text-[12px]">ล้าง</button>}
        </div>
        {transit && transit.legs.length > 0 ? (
          <>
            <MetroRoute transit={transit} />
            <button onClick={() => onResult(transit)} className="btn-primary w-full h-10 mt-3">ใช้เส้นทางนี้ (กรอกเวลา/ทางออกเพิ่มได้)</button>
          </>
        ) : (
          <p className="text-[12px] text-ink-3 mt-2">แตะกล่องรหัสสถานีต้นทางและปลายทางบนแผนที่ (หรือค้นหา) ระบบจะคำนวณจุดเปลี่ยนสายให้</p>
        )}
      </div>
    </div>,
    document.body,
  )
}
