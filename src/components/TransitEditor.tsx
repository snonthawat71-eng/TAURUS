import { useEffect, useMemo, useState } from 'react'
import { IconPlus, IconTrash, IconArrowDown, IconMap2 } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { ColorPicker } from './ColorPicker'
import { Combobox } from './Combobox'
import { MetroMapPicker } from './MetroMapPicker'
import { HKMapViewer } from './HKMapViewer'
import { useTrip } from '@/contexts/TripContext'
import { getNetworkForTrip } from '@/lib/metro'
import { getTransitSuggestions, findLine, legBetween } from '@/lib/metro/suggest'
import type { Transit, TransitLeg } from '@/lib/database.types'

const field = 'hairline rounded-md text-[13px] h-9 px-2.5 bg-surface w-full outline-none focus:border-brand'
const lbl = 'text-[10px] text-ink-3'

function isHongKong(hay: string) {
  const s = hay.toLowerCase()
  return ['hong kong', 'hongkong', 'ฮ่องกง', ' hk', 'mtr'].some((k) => s.includes(k))
}

function emptyLeg(): TransitLeg {
  return { line: '', color: '#185FA5', from: '', to: '', direction: '', stops: undefined, minutes: undefined }
}

export function TransitEditor({
  open, onClose, initial, placeName, onSave,
}: {
  open: boolean
  onClose: () => void
  initial: Transit | null
  placeName?: string | null
  onSave: (transit: Transit | null) => Promise<void>
}) {
  const { trip, places } = useTrip()
  const net = getNetworkForTrip(trip)
  const sug = useMemo(() => getTransitSuggestions(trip), [trip])
  // station/line of THIS stop's place (if it matches one in the plan); fall back
  // to all in-plan places only when this stop isn't linked to a known place.
  const withStation = places.filter((p) => p.in_plan && (p.station_line || p.station_name))
  const matched = placeName
    ? withStation.find((p) => (p.name ?? '').trim().toLowerCase() === placeName.trim().toLowerCase())
    : undefined
  const stationPlaces = matched ? [matched] : (placeName ? [] : withStation)
  const hk = isHongKong([trip?.country ?? '', ...(trip?.cities ?? []), trip?.name ?? ''].join(' '))
  const [legs, setLegs] = useState<TransitLeg[]>([])
  const [exitLabel, setExitLabel] = useState('')
  const [exitNote, setExitNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [hkOpen, setHkOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setLegs(initial?.legs?.length ? initial.legs.map((l) => ({ ...l })) : [emptyLeg()])
      setExitLabel(initial?.exit?.label ?? '')
      setExitNote(initial?.exit?.note ?? '')
    }
  }, [open, initial])

  function patch(i: number, p: Partial<TransitLeg>) {
    setLegs((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...p } : l)))
  }
  // line name → auto-fill the line color when it matches a known line
  function patchLine(i: number, value: string) {
    const known = findLine(sug, value)
    patch(i, { line: value, ...(known ? { color: known.color } : {}) })
  }
  // station fields → when both ends sit on a known line, auto-fill stop count + terminus
  function patchEnds(i: number, p: Partial<TransitLeg>) {
    setLegs((ls) => ls.map((l, idx) => {
      if (idx !== i) return l
      const merged: TransitLeg = { ...l, ...p }
      const known = findLine(sug, merged.line)
      if (known && merged.from && merged.to) {
        const r = legBetween(known, merged.from, merged.to)
        if (r) { merged.stops = r.stops; merged.direction = `ปลายทาง ${r.terminus}` }
      }
      return merged
    }))
  }
  function patchTransfer(i: number, p: { walkMeters?: number; minutes?: number } | null) {
    setLegs((ls) => ls.map((l, idx) => (idx === i ? { ...l, transferAfter: p ?? undefined } : l)))
  }

  async function save() {
    setBusy(true)
    const clean = legs.filter((l) => l.line || l.from || l.to)
    const transit: Transit | null = clean.length
      ? { legs: clean, ...(exitLabel ? { exit: { label: exitLabel, note: exitNote || undefined } } : {}) }
      : null
    await onSave(transit)
    setBusy(false)
    onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title="เส้นทางรถไฟฟ้า">
      <div className="space-y-3">
        {net && (
          <button onClick={() => setMapOpen(true)}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-md text-[13px] font-medium"
            style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }}>
            <IconMap2 size={17} /> เลือกจากแผนที่ {net.name} (คำนวณจุดเปลี่ยนสายให้)
          </button>
        )}
        {hk && (
          <button onClick={() => setHkOpen(true)}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-md text-[13px] font-medium"
            style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }}>
            <IconMap2 size={17} /> เลือกจากแผนที่ MTR ฮ่องกง (คำนวณจุดเปลี่ยนสายให้)
          </button>
        )}
        {legs.map((leg, i) => (
          <div key={i} className="card p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-ink-2">ช่วงที่ {i + 1}</span>
              <button onClick={() => setLegs((ls) => ls.filter((_, idx) => idx !== i))}
                className="text-ink-3 hover:text-[#D85A30]"><IconTrash size={15} /></button>
            </div>

            {/* line + color */}
            <div>
              <div className={lbl}>ชื่อสาย</div>
              <Combobox className={field} value={leg.line} placeholder="เช่น Line 5 / Airport Express"
                options={sug.lines.map((l) => ({ value: l.name, color: l.color }))}
                onChange={(v) => patchLine(i, v)} />
              <ColorPicker value={leg.color} onChange={(c) => patch(i, { color: c })} />
            </div>

            {(() => {
              const known = findLine(sug, leg.line)
              const stations = known ? known.stations : sug.stations.map((name) => ({ name } as { name: string; num?: string }))
              const stationOpts = stations.map((s) => ({ value: s.name, label: s.num }))
              return (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className={lbl}>สถานีขึ้น</div>
                      <Combobox className={field} value={leg.from} options={stationOpts} onChange={(v) => patchEnds(i, { from: v })} />
                    </div>
                    <div>
                      <div className={lbl}>สถานีลง</div>
                      <Combobox className={field} value={leg.to} options={stationOpts} onChange={(v) => patchEnds(i, { to: v })} />
                    </div>
                  </div>
                </>
              )
            })()}

            {/* quick-fill this leg from an in-plan place's saved station/line */}
            {stationPlaces.length > 0 && (
              <div>
                <div className={lbl}>ดึงสาย/สถานีจากสถานที่ในแพลน — แตะเพื่อเติม</div>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-1 pb-0.5">
                  {stationPlaces.map((p) => (
                    <button key={p.id}
                      onClick={() => patch(i, { line: p.station_line || leg.line, color: p.station_color || leg.color, to: p.station_name || leg.to })}
                      className="inline-flex items-center gap-1.5 shrink-0 h-7 px-2.5 rounded-full text-[11px] font-medium bg-surface-2 hover:bg-line">
                      <span className="size-2 rounded-full shrink-0" style={{ background: p.station_color ?? '#888780' }} />
                      <span className="truncate max-w-[140px]">{p.name} · {[p.station_line, p.station_name].filter(Boolean).join(' ')}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className={lbl}>สถานีปลายทาง</div>
              <input className={field} value={leg.direction ?? ''} onChange={(e) => patch(i, { direction: e.target.value })} placeholder="เช่น ปลายทาง Tuen Mun" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className={lbl}>จำนวนสถานี</div>
                <input type="number" className={field} value={leg.stops ?? ''} onChange={(e) => patch(i, { stops: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div>
                <div className={lbl}>เวลา (นาที)</div>
                <input type="number" className={field} value={leg.minutes ?? ''} onChange={(e) => patch(i, { minutes: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
            </div>

            {/* transfer to next */}
            {i < legs.length - 1 && (
              <label className="flex items-center gap-2 text-[12px] text-ink-2">
                <input type="checkbox" checked={!!leg.transferAfter}
                  onChange={(e) => patchTransfer(i, e.target.checked ? { minutes: 2 } : null)} />
                มีเดินเปลี่ยนสายก่อนช่วงถัดไป
              </label>
            )}
            {i < legs.length - 1 && leg.transferAfter && (
              <div className="grid grid-cols-2 gap-2 pl-6">
                <div>
                  <div className={lbl}>ระยะเดิน (เมตร)</div>
                  <input type="number" className={field} value={leg.transferAfter.walkMeters ?? ''} onChange={(e) => patchTransfer(i, { ...leg.transferAfter, walkMeters: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
                <div>
                  <div className={lbl}>เวลาเดิน (นาที)</div>
                  <input type="number" className={field} value={leg.transferAfter.minutes ?? ''} onChange={(e) => patchTransfer(i, { ...leg.transferAfter, minutes: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
              </div>
            )}
          </div>
        ))}

        <button onClick={() => setLegs((ls) => [...ls, emptyLeg()])} className="btn-link flex items-center gap-1.5">
          <IconPlus size={15} /> เพิ่มช่วงเดินทาง
        </button>

        <div className="card p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2"><IconArrowDown size={14} /> ทางออกปลายทาง</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className={lbl}>ป้ายทางออก</div>
              <input className={field} value={exitLabel} onChange={(e) => setExitLabel(e.target.value)} placeholder="เช่น Exit E3" />
            </div>
            <div>
              <div className={lbl}>โน้ต</div>
              <input className={field} value={exitNote} onChange={(e) => setExitNote(e.target.value)} placeholder="เช่น เดิน ~3 นาที" />
            </div>
          </div>
        </div>

        <button onClick={save} disabled={busy} className="btn-primary w-full h-10 disabled:opacity-50">
          {busy ? 'กำลังบันทึก...' : 'บันทึกเส้นทาง'}
        </button>
      </div>

      {net && mapOpen && (
        <MetroMapPicker
          net={net}
          onClose={() => setMapOpen(false)}
          onResult={(t) => { setLegs(t.legs.map((l) => ({ ...l }))); setMapOpen(false) }}
        />
      )}
      {hk && hkOpen && <HKMapViewer onClose={() => setHkOpen(false)}
        onResult={(t) => { setLegs(t.legs.map((l) => ({ ...l }))); setHkOpen(false) }} />}
    </Drawer>
  )
}
