import { useEffect, useMemo, useState } from 'react'
import { IconPlus, IconTrash, IconDoorExit, IconMap2 } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { ColorPicker } from './ColorPicker'
import { Combobox } from './Combobox'
import { MetroMapPicker } from './MetroMapPicker'
import { HKMapViewer } from './HKMapViewer'
import { ShanghaiMapViewer } from './ShanghaiMapViewer'
import { ShenzhenMapViewer } from './ShenzhenMapViewer'
import { useTrip } from '@/contexts/TripContext'
import { getNetworkForTrip } from '@/lib/metro'
import { getTransitSuggestions, findLine, legBetween } from '@/lib/metro/suggest'
import { modeMeta } from '@/lib/transitModes'
import { ModePicker } from './ModePicker'
import type { Transit, TransitLeg, ExploreRoute, Place } from '@/lib/database.types'

const field = 'hairline rounded-md text-[13px] h-9 px-2.5 bg-surface w-full outline-none focus:border-brand'
const lbl = 'text-[10px] text-ink-3'

function isHongKong(hay: string) {
  const s = hay.toLowerCase()
  return ['hong kong', 'hongkong', 'ฮ่องกง', ' hk', 'mtr'].some((k) => s.includes(k))
}

function isShanghai(hay: string) {
  const s = hay.toLowerCase()
  return ['shanghai', 'เซี่ยงไฮ้', '上海'].some((k) => s.includes(k))
}

function isShenzhen(hay: string) {
  const s = hay.toLowerCase()
  return ['shenzhen', 'เซินเจิ้น', '深圳'].some((k) => s.includes(k))
}

function emptyLeg(): TransitLeg {
  return { mode: 'metro', line: '', color: '#0270FB', from: '', to: '', direction: '', stops: undefined, minutes: undefined }
}

/** All saved ways to reach a place — its multi-route list, or the single legacy station. */
function routesOf(p: Place): ExploreRoute[] {
  const rs = (p.routes ?? []).filter((r): r is ExploreRoute => !!r && !!(r.line || r.station))
  if (rs.length) return rs
  return (p.station_line || p.station_name)
    ? [{ line: p.station_line, color: p.station_color, station: p.station_name }]
    : []
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
  const withStation = places.filter((p) => p.in_plan && (p.station_line || p.station_name || p.routes?.length))
  const matched = placeName
    ? withStation.find((p) => (p.name ?? '').trim().toLowerCase() === placeName.trim().toLowerCase())
    : undefined
  const stationPlaces = matched ? [matched] : (placeName ? [] : withStation)
  const tripHay = [trip?.country ?? '', ...(trip?.cities ?? []), trip?.name ?? ''].join(' ')
  const hk = isHongKong(tripHay)
  const sh = isShanghai(tripHay)
  const sz = isShenzhen(tripHay)
  const [legs, setLegs] = useState<TransitLeg[]>([])
  const [busy, setBusy] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [hkOpen, setHkOpen] = useState(false)
  const [shOpen, setShOpen] = useState(false)
  const [szOpen, setSzOpen] = useState(false)
  // when a place has multiple routes, tapping it opens a chooser for this leg
  const [routePick, setRoutePick] = useState<{ leg: number; place: string } | null>(null)

  useEffect(() => {
    if (open) {
      const ls = initial?.legs?.length ? initial.legs.map((l) => ({ ...l })) : [emptyLeg()]
      // migrate a legacy single destination exit onto the last leg
      if (initial?.exit && ls.length && !ls[ls.length - 1].exit) {
        ls[ls.length - 1] = { ...ls[ls.length - 1], exit: { ...initial.exit } }
      }
      setLegs(ls)
    }
  }, [open, initial])

  function patch(i: number, p: Partial<TransitLeg>) {
    setLegs((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...p } : l)))
  }
  // switch how a leg is travelled; swap in the mode's default colour unless the
  // user had already picked a custom one
  function patchMode(i: number, mode: string) {
    setLegs((ls) => ls.map((l, idx) => {
      if (idx !== i) return l
      const color = (!l.color || l.color === modeMeta(l.mode).color) ? modeMeta(mode).color : l.color
      return { ...l, mode, color }
    }))
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
  // fill a leg from one chosen route of an in-plan place
  function applyRoute(i: number, r: ExploreRoute) {
    setLegs((ls) => ls.map((l, idx) => (idx === i
      ? { ...l, line: r.line || l.line, color: r.color || l.color, to: r.station || l.to }
      : l)))
    setRoutePick(null)
  }
  function patchTransfer(i: number, p: { walkMeters?: number; minutes?: number } | null) {
    setLegs((ls) => ls.map((l, idx) => (idx === i ? { ...l, transferAfter: p ?? undefined } : l)))
  }
  function patchExit(i: number, p: { label?: string; note?: string }) {
    setLegs((ls) => ls.map((l, idx) => {
      if (idx !== i) return l
      const ex = { label: l.exit?.label ?? '', note: l.exit?.note, ...p }
      return { ...l, exit: (ex.label || ex.note) ? ex : undefined }
    }))
  }

  async function save() {
    setBusy(true)
    const clean = legs.filter((l) => l.line || l.from || l.to)
    const transit: Transit | null = clean.length ? { legs: clean } : null
    await onSave(transit)
    setBusy(false)
    onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title="เส้นทางการเดินทาง">
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
        {sh && (
          <button onClick={() => setShOpen(true)}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-md text-[13px] font-medium"
            style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }}>
            <IconMap2 size={17} /> เลือกจากแผนที่รถไฟฟ้าเซี่ยงไฮ้ (คำนวณจุดเปลี่ยนสายให้)
          </button>
        )}
        {sz && (
          <button onClick={() => setSzOpen(true)}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-md text-[13px] font-medium"
            style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }}>
            <IconMap2 size={17} /> เลือกจากแผนที่รถไฟฟ้าเซินเจิ้น (คำนวณจุดเปลี่ยนสายให้)
          </button>
        )}
        {legs.map((leg, i) => {
          const mm = modeMeta(leg.mode)
          const rail = mm.rail
          return (
          <div key={i} className="card p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-ink-2">ช่วงที่ {i + 1}</span>
              <button onClick={() => setLegs((ls) => ls.filter((_, idx) => idx !== i))}
                className="text-ink-3 hover:text-[#D85A30]"><IconTrash size={15} /></button>
            </div>

            {/* travel mode */}
            <div>
              <div className={`${lbl} mb-1`}>เดินทางด้วย</div>
              <ModePicker value={leg.mode} onChange={(m) => patchMode(i, m)} />
            </div>

            {/* line / route + color */}
            <div>
              <div className={lbl}>{mm.fields.line}</div>
              {rail ? (
                <Combobox className={field} value={leg.line} placeholder={mm.fields.linePlaceholder}
                  options={sug.lines.map((l) => ({ value: l.name, color: l.color }))}
                  onChange={(v) => patchLine(i, v)} />
              ) : (
                <input className={field} value={leg.line} placeholder={mm.fields.linePlaceholder}
                  onChange={(e) => patch(i, { line: e.target.value })} />
              )}
              {/* colour applies to the metro line only */}
              {rail && <ColorPicker value={leg.color} onChange={(c) => patch(i, { color: c })} />}
            </div>

            {rail ? (() => {
              const known = findLine(sug, leg.line)
              const stations = known ? known.stations : sug.stations.map((name) => ({ name } as { name: string; num?: string }))
              const stationOpts = stations.map((s) => ({ value: s.name, label: s.num }))
              return (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className={lbl}>{mm.fields.from}</div>
                    <Combobox className={field} value={leg.from} options={stationOpts} onChange={(v) => patchEnds(i, { from: v })} />
                  </div>
                  <div>
                    <div className={lbl}>{mm.fields.to}</div>
                    <Combobox className={field} value={leg.to} options={stationOpts} onChange={(v) => patchEnds(i, { to: v })} />
                  </div>
                </div>
              )
            })() : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className={lbl}>{mm.fields.from}</div>
                  <input className={field} value={leg.from} onChange={(e) => patch(i, { from: e.target.value })} />
                </div>
                <div>
                  <div className={lbl}>{mm.fields.to}</div>
                  <input className={field} value={leg.to} onChange={(e) => patch(i, { to: e.target.value })} />
                </div>
              </div>
            )}

            {/* quick-fill this leg from an in-plan place's saved route(s) */}
            {rail && stationPlaces.length > 0 && (
              <div>
                <div className={lbl}>ดึงสาย/สถานีจากสถานที่ในลิสต์ — แตะเพื่อเติม</div>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-1 pb-0.5">
                  {stationPlaces.map((p) => {
                    const rs = routesOf(p)
                    if (!rs.length) return null
                    const multi = rs.length > 1
                    return (
                      <button key={p.id}
                        onClick={() => { if (multi) setRoutePick((cur) => (cur?.leg === i && cur.place === p.id ? null : { leg: i, place: p.id })); else applyRoute(i, rs[0]) }}
                        className="inline-flex items-center gap-1.5 shrink-0 h-7 px-2.5 rounded-full text-[11px] font-medium bg-surface-2 hover:bg-line">
                        <span className="size-2 rounded-full shrink-0" style={{ background: rs[0].color ?? '#888780' }} />
                        <span className="truncate max-w-[140px]">{p.name}{multi ? ` · ${rs.length} เส้นทาง` : ` · ${[rs[0].line, rs[0].station].filter(Boolean).join(' ')}`}</span>
                      </button>
                    )
                  })}
                </div>
                {/* route chooser for the tapped multi-route place */}
                {routePick?.leg === i && (() => {
                  const p = stationPlaces.find((x) => x.id === routePick.place)
                  if (!p) return null
                  return (
                    <div className="card p-2 mt-1.5 space-y-1">
                      <div className={lbl}>เลือกเส้นทางของ {p.name}</div>
                      {routesOf(p).map((r, ri) => (
                        <button key={ri} onClick={() => applyRoute(i, r)}
                          className="w-full flex items-center gap-2 px-2 h-9 rounded-md text-[12px] hover:bg-surface-2 text-left">
                          <span className="size-2.5 rounded-full shrink-0" style={{ background: r.color ?? '#888780' }} />
                          <span className="truncate">{[r.line, r.station].filter(Boolean).join(' · ') || '(ไม่มีข้อมูล)'}</span>
                        </button>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}

            <div>
              <div className={lbl}>ทิศทาง / ปลายทาง</div>
              <input className={field} value={leg.direction ?? ''} onChange={(e) => patch(i, { direction: e.target.value })} placeholder={rail ? 'เช่น ปลายทาง Tuen Mun' : 'เช่น มุ่งหน้าตัวเมือง'} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className={lbl}>{rail ? 'จำนวนสถานี' : 'จำนวนป้าย/จุด'}</div>
                <input type="number" className={field} value={leg.stops ?? ''} onChange={(e) => patch(i, { stops: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div>
                <div className={lbl}>เวลา (นาที)</div>
                <input type="number" className={field} value={leg.minutes ?? ''} onChange={(e) => patch(i, { minutes: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
            </div>

            {/* exit for this leg */}
            <div>
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2"><IconDoorExit size={14} /> ทางออก</div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <input className={field} value={leg.exit?.label ?? ''} onChange={(e) => patchExit(i, { label: e.target.value })} placeholder="เช่น Exit E3" />
                <input className={field} value={leg.exit?.note ?? ''} onChange={(e) => patchExit(i, { note: e.target.value })} placeholder="เช่น เดิน ~3 นาที" />
              </div>
            </div>

            {/* transfer to next */}
            {i < legs.length - 1 && (
              <label className="flex items-center gap-2 text-[12px] text-ink-2">
                <input type="checkbox" checked={!!leg.transferAfter}
                  onChange={(e) => patchTransfer(i, e.target.checked ? { minutes: 2 } : null)} />
                มีเดินต่อก่อนช่วงถัดไป
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
          )
        })}

        <button onClick={() => setLegs((ls) => [...ls, emptyLeg()])} className="btn-link flex items-center gap-1.5">
          <IconPlus size={15} /> เพิ่มช่วงเดินทาง
        </button>

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
      {sh && shOpen && <ShanghaiMapViewer onClose={() => setShOpen(false)}
        onResult={(t) => { setLegs(t.legs.map((l) => ({ ...l }))); setShOpen(false) }} />}
      {sz && szOpen && <ShenzhenMapViewer onClose={() => setSzOpen(false)}
        onResult={(t) => { setLegs(t.legs.map((l) => ({ ...l }))); setSzOpen(false) }} />}
    </Drawer>
  )
}
