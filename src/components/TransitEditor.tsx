import { useEffect, useMemo, useState } from 'react'
import { IconPlus, IconTrash, IconDoorExit, IconMap2, IconSparkles, IconWalk, IconCoin, IconX } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { SectionCard } from './SectionCard'
import { ColorPicker } from './ColorPicker'
import { Combobox } from './Combobox'
import { MetroMapPicker } from './MetroMapPicker'
import { HKMapViewer } from './HKMapViewer'
import { ShanghaiMapViewer } from './ShanghaiMapViewer'
import { ShenzhenMapViewer } from './ShenzhenMapViewer'
import { SingaporeMapViewer } from './SingaporeMapViewer'
import { useTrip } from '@/contexts/TripContext'
import { getNetworkForTrip, getNetworkForText } from '@/lib/metro'
import { isSingapore } from '@/lib/metro/singaporeNetwork'
import { suggestionsFromText, findLine, legBetween } from '@/lib/metro/suggest'
import { modeMeta } from '@/lib/transitModes'
import { CURRENCIES } from '@/lib/fx'
import { cityMatchKey } from '@/lib/cities'
import { confirmDialog } from '@/lib/confirm'
import { ModePicker } from './ModePicker'
import type { Transit, TransitLeg, ExploreRoute, Place } from '@/lib/database.types'

const field = 'hairline rounded-md text-[13px] h-9 px-2.5 bg-surface w-full outline-none focus:border-brand'
const lbl = 'text-[10px] text-ink-3'

/** A plain field with an ✕ to empty it — the fields here are filled in from a
 *  saved route as often as they're typed, and a wrong one had to be selected
 *  and deleted by hand before it could be replaced. */
function Field({ value, onChange, type, placeholder, inputMode }: {
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'number'
  placeholder?: string
  inputMode?: 'decimal'
}) {
  return (
    <div className="relative">
      <input type={type} inputMode={inputMode} className={field} value={value} placeholder={placeholder}
        style={value ? { paddingRight: 26 } : undefined}
        onChange={(e) => onChange(e.target.value)} />
      {!!value && (
        <button type="button" tabIndex={-1} aria-label="ล้างช่องนี้"
          onMouseDown={(e) => { e.preventDefault(); onChange('') }}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2 p-1">
          <IconX size={14} />
        </button>
      )}
    </div>
  )
}

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
  open, onClose, initial, placeName, branchIdx, onSave,
}: {
  open: boolean
  onClose: () => void
  initial: Transit | null
  placeName?: string | null
  /** which branch THIS visit goes to (from the stop) — the route should be
   *  suggested for that branch, not for the place's default one */
  branchIdx?: number | null
  onSave: (transit: Transit | null) => Promise<void>
}) {
  const { trip, places } = useTrip()
  // station/line of THIS stop's place (if it matches one saved in the trip);
  // fall back to every saved place with a station when this stop isn't linked
  // to a known one
  const withStation = places.filter((p) => p.station_line || p.station_name || p.routes?.length)
  const matched = placeName
    ? withStation.find((p) => (p.name ?? '').trim().toLowerCase() === placeName.trim().toLowerCase())
    : undefined
  const stationPlaces = matched ? [matched] : (placeName ? [] : withStation)
  // The stop's place tells us which CITY this route is in — scope the metro maps
  // and line/station suggestions to that city, so a multi-city trip (e.g.
  // Hongkong–Shenzhen) doesn't offer every network at once. Falls back to the
  // trip-wide match when the place has no city / the city has no built-in network.
  const placeCity = (placeName
    ? places.find((p) => (p.name ?? '').trim().toLowerCase() === placeName.trim().toLowerCase())?.city
    : null)?.trim() ?? ''
  const cityScoped = !!placeCity && suggestionsFromText(placeCity).lines.length > 0
  const tripHay = [trip?.country ?? '', ...(trip?.cities ?? []), trip?.name ?? ''].join(' ')
  const hay = cityScoped ? placeCity : tripHay
  const net = cityScoped ? getNetworkForText(placeCity) : getNetworkForTrip(trip)
  const sug = useMemo(() => suggestionsFromText(hay), [hay])
  const hk = isHongKong(hay)
  const sh = isShanghai(hay)
  const sz = isShenzhen(hay)
  const sg = isSingapore(hay)
  // Money for THIS leg. A multi-city trip pays in a different currency in each
  // city, so the fare row picks one per leg — defaulting to the currency of the
  // segment whose city this stop is in, then the trip's own.
  const tripMonies = useMemo(() => {
    const out: string[] = []
    for (const s of trip?.segments ?? []) if (s?.currency && !out.includes(s.currency)) out.push(s.currency)
    if (trip?.currency && !out.includes(trip.currency)) out.push(trip.currency)
    return out
  }, [trip])
  const cityMoney = useMemo(() => {
    const seg = (trip?.segments ?? []).find((s) => s?.city && cityMatchKey(s.city) === cityMatchKey(placeCity))
    return seg?.currency ?? trip?.currency ?? ''
  }, [trip, placeCity])
  const moneyOptions = useMemo(
    () => [...new Set([...tripMonies, ...CURRENCIES.map((c) => c.code)])],
    [tripMonies],
  )

  const [legs, setLegs] = useState<TransitLeg[]>([])
  const [busy, setBusy] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [hkOpen, setHkOpen] = useState(false)
  const [shOpen, setShOpen] = useState(false)
  const [szOpen, setSzOpen] = useState(false)
  const [sgOpen, setSgOpen] = useState(false)
  // which leg card is unfolded (null = all folded); new routes open leg 1
  const [openLeg, setOpenLeg] = useState<number | null>(0)
  // legs whose fare row is expanded (a filled fare always shows)
  const [fareOpen, setFareOpen] = useState<Set<number>>(new Set())
  // the top "เติมเส้นทางอัตโนมัติ" chooser (when a place has multiple routes)
  const [autoPick, setAutoPick] = useState(false)

  useEffect(() => {
    if (open) {
      const ls = initial?.legs?.length ? initial.legs.map((l) => ({ ...l })) : [emptyLeg()]
      // migrate a legacy single destination exit onto the last leg
      if (initial?.exit && ls.length && !ls[ls.length - 1].exit) {
        ls[ls.length - 1] = { ...ls[ls.length - 1], exit: { ...initial.exit } }
      }
      setLegs(ls)
      setOpenLeg(initial?.legs?.length ? null : 0)
      setFareOpen(new Set())
      setAutoPick(false)
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
  // fill a leg from one chosen route of an in-plan place (the top ⚡ button —
  // targets the open leg, else the first)
  function applyRoute(r: ExploreRoute) {
    const i = openLeg ?? 0
    setLegs((ls) => ls.map((l, idx) => (idx === i
      ? { ...l, line: r.line || l.line, color: r.color || l.color, to: r.station || l.to }
      : l)))
    setAutoPick(false)
    setOpenLeg(i)
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
  async function delRoute() {
    if (!(await confirmDialog({ message: 'ลบเส้นทางการเดินทางนี้?', danger: true, confirmLabel: 'ลบ' }))) return
    setBusy(true)
    await onSave(null)
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
        {sg && (
          <button onClick={() => setSgOpen(true)}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-md text-[13px] font-medium"
            style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }}>
            <IconMap2 size={17} /> เลือกจากแผนที่ MRT สิงคโปร์ (คำนวณจุดเปลี่ยนสายให้)
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
        {/* ⚡ เติมเส้นทางอัตโนมัติ — moved up from the per-leg "ดึงสาย/สถานี" chips.
            Multi-branch places first ask: the branch picked for the list, or another. */}
        {(() => {
          interface Opt { label: string; sub?: string; color?: string | null; r: ExploreRoute }
          const opts: Opt[] = []
          let branchAsk: { listed: Opt; others: Opt[] } | null = null
          for (const p of stationPlaces) {
            const branches = (p.branches ?? []).filter((b) => b.line || b.station)
            if (branches.length) {
              const bOpts = branches.map((b, bi): Opt => ({
                label: b.label || `สาขา ${bi + 1}`,
                sub: [b.line, b.station].filter(Boolean).join(' · '),
                color: b.color, r: { line: b.line, color: b.color, station: b.station },
              }))
              const mains = routesOf(p).map((r): Opt => ({
                label: 'ที่ตั้งหลัก', sub: [r.line, r.station].filter(Boolean).join(' · '), color: r.color, r,
              }))
              // this VISIT's branch wins over the place's default (a chain can be
              // scheduled at different branches on different days)
              const prefer = branchIdx ?? p.plan_branch
              const li = prefer != null && branches[prefer] ? prefer : null
              if (li != null && p === matched) {
                branchAsk = { listed: bOpts[li], others: [...bOpts.filter((_, bi) => bi !== li), ...mains] }
              }
              opts.push(...bOpts, ...mains)
            } else {
              opts.push(...routesOf(p).map((r): Opt => ({
                label: p.name ?? '', sub: [r.line, r.station].filter(Boolean).join(' · '), color: r.color, r,
              })))
            }
          }
          if (!opts.length) return null
          const single = opts.length === 1 && !branchAsk
          const optRow = (o: Opt, key: number) => (
            <button key={key} onClick={() => applyRoute(o.r)}
              className="w-full flex items-center gap-2 px-2 h-9 rounded-md text-[12px] hover:bg-surface-2 text-left">
              <span className="size-2.5 rounded-full shrink-0" style={{ background: o.color ?? '#888780' }} />
              <span className="truncate font-medium">{o.label}</span>
              {o.sub && <span className="ml-auto text-[10.5px] text-ink-3 truncate max-w-[150px] shrink-0">{o.sub}</span>}
            </button>
          )
          return (
            <div>
              <button onClick={() => (single ? applyRoute(opts[0].r) : setAutoPick((v) => !v))}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-md text-[13px] font-medium"
                style={{ background: 'var(--color-surface)', color: 'var(--color-brand-mid)', border: '0.5px solid var(--color-brand-border)' }}>
                <IconSparkles size={16} /> เติมเส้นทางอัตโนมัติจากสถานที่{!single && !branchAsk ? ` (${opts.length} เส้นทาง)` : ''}
              </button>
              {autoPick && (
                <div className="card p-2 mt-1.5 space-y-1">
                  {branchAsk ? (
                    <>
                      <div className={lbl}>ร้านนี้มีหลายสาขา — ใช้สาขาที่เลือกไว้ของวันนี้มั้ย?</div>
                      <button onClick={() => applyRoute(branchAsk!.listed.r)}
                        className="w-full flex items-center gap-2 px-2 h-10 rounded-md text-[12.5px] text-left"
                        style={{ background: 'var(--color-brand-soft)', border: '0.5px solid var(--color-brand-border)', color: 'var(--color-brand-dark)' }}>
                        <span className="size-2.5 rounded-full shrink-0" style={{ background: branchAsk.listed.color ?? '#888780' }} />
                        <span className="truncate font-semibold">สาขาของวันนี้ · {branchAsk.listed.label}</span>
                        {branchAsk.listed.sub && <span className="ml-auto text-[10.5px] truncate max-w-[120px] shrink-0 opacity-75">{branchAsk.listed.sub}</span>}
                      </button>
                      {branchAsk.others.length > 0 && (
                        <>
                          <div className={`${lbl} pt-1`}>หรือสาขาอื่น</div>
                          {branchAsk.others.map(optRow)}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className={lbl}>เลือกเส้นทางที่บันทึกไว้ — เติมลงช่วงที่ {(openLeg ?? 0) + 1}</div>
                      {opts.map(optRow)}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {legs.map((leg, i) => {
          const mm = modeMeta(leg.mode)
          const rail = mm.rail
          const ModeIcon = mm.icon
          const legDone = !!(leg.line || leg.from || leg.to)
          const summary = [
            leg.line,
            [leg.from, leg.to].filter(Boolean).join(' → '),
            leg.stops != null ? `${leg.stops} ${rail ? 'สถานี' : 'ป้าย'}` : '',
            leg.exit?.label,
            leg.fare != null ? `≈${leg.fare} ${leg.fareCurrency ?? cityMoney}` : '',
          ].filter(Boolean).join(' · ')
          const fareShown = fareOpen.has(i) || leg.fare != null
          return (
          <div key={i} className="space-y-2">
            {/* ── ช่วงที่ N — fold-when-done card, same as the place editor ── */}
            <SectionCard open={openLeg === i} done={legDone} showCheck={false} onToggle={() => setOpenLeg((c) => (c === i ? null : i))}
              icon={<ModeIcon size={15} />} title={`ช่วงที่ ${i + 1}${legDone ? ` · ${mm.label}` : ''}`}
              sub="เดินทางด้วยอะไร ขึ้นที่ไหน ลงที่ไหน" summary={summary}>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className={lbl}>เดินทางด้วย</div>
                  {legs.length > 1 && (
                    <button onClick={() => { setLegs((ls) => ls.filter((_, idx) => idx !== i)); setOpenLeg(null) }}
                      className="text-ink-3 hover:text-[#D85A30]" aria-label="ลบช่วงนี้"><IconTrash size={15} /></button>
                  )}
                </div>
                <ModePicker value={leg.mode} onChange={(m) => patchMode(i, m)} />

                {/* line / route + color */}
                <div>
                  <div className={lbl}>{mm.fields.line}</div>
                  {rail ? (
                    <Combobox className={field} value={leg.line} placeholder={mm.fields.linePlaceholder}
                      options={sug.lines.map((l) => ({ value: l.name, color: l.color }))}
                      onChange={(v) => patchLine(i, v)} />
                  ) : (
                    <Field value={leg.line} placeholder={mm.fields.linePlaceholder}
                      onChange={(v) => patch(i, { line: v })} />
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
                      <Field value={leg.from} onChange={(v) => patchEnds(i, { from: v })} />
                    </div>
                    <div>
                      <div className={lbl}>{mm.fields.to}</div>
                      <Field value={leg.to} onChange={(v) => patchEnds(i, { to: v })} />
                    </div>
                  </div>
                )}

                <div>
                  <div className={lbl}>ทิศทาง / ปลายทาง</div>
                  <Field value={leg.direction ?? ''} onChange={(v) => patch(i, { direction: v })} placeholder={rail ? 'เช่น ปลายทาง Tuen Mun' : 'เช่น มุ่งหน้าตัวเมือง'} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className={lbl}>{rail ? 'จำนวนสถานี' : 'จำนวนป้าย/จุด'}</div>
                    <Field type="number" value={leg.stops?.toString() ?? ''} onChange={(v) => patch(i, { stops: v ? Number(v) : undefined })} />
                  </div>
                  <div>
                    <div className={lbl}>เวลา (นาที)</div>
                    <Field type="number" value={leg.minutes?.toString() ?? ''} onChange={(v) => patch(i, { minutes: v ? Number(v) : undefined })} />
                  </div>
                </div>

                {/* exit for this leg */}
                <div>
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2"><IconDoorExit size={14} /> ทางออก</div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Field value={leg.exit?.label ?? ''} onChange={(v) => patchExit(i, { label: v })} placeholder="เช่น Exit E3" />
                    <Field value={leg.exit?.note ?? ''} onChange={(v) => patchExit(i, { note: v })} placeholder="เช่น เดิน ~3 นาที" />
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* ── ราคาค่าเดินทางโดยประมาณของช่วงนี้ — slim dashed row until tapped ── */}
            {fareShown ? (
              <div className="rounded-[10px] bg-surface hairline px-3 py-2 flex items-center gap-2">
                <IconCoin size={15} className="text-ink-3 shrink-0" />
                <span className="text-[11.5px] text-ink-2 shrink-0">ราคาโดยประมาณ</span>
                <input type="number" inputMode="decimal" className="flex-1 min-w-0 h-8 hairline rounded-md px-2 text-[12.5px] bg-surface outline-none focus:border-brand"
                  value={leg.fare ?? ''} autoFocus={leg.fare == null}
                  onChange={(e) => patch(i, { fare: e.target.value ? Number(e.target.value) : undefined })} placeholder="0" />
                <select value={leg.fareCurrency ?? cityMoney} aria-label="สกุลเงินของราคานี้"
                  onChange={(e) => patch(i, { fareCurrency: e.target.value })}
                  className="shrink-0 h-8 rounded-md px-1.5 text-[11.5px] font-medium text-ink-2 bg-surface-2 outline-none focus:border-brand">
                  {moneyOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={() => { patch(i, { fare: undefined }); setFareOpen((s) => { const n = new Set(s); n.delete(i); return n }) }}
                  className="text-ink-3 hover:text-ink-2 shrink-0" aria-label="เอาราคาออก"><IconX size={14} /></button>
              </div>
            ) : (
              <button onClick={() => { patch(i, { fareCurrency: leg.fareCurrency ?? cityMoney }); setFareOpen((s) => new Set(s).add(i)) }}
                className="w-full h-8 rounded-[10px] text-[11.5px] font-medium inline-flex items-center gap-1.5 text-ink-3 px-3"
                style={{ border: '1px dashed var(--color-line-2)' }}>
                <IconCoin size={13} /> ราคาค่าเดินทางโดยประมาณ
                <IconPlus size={14} className="ml-auto shrink-0" />
              </button>
            )}

            {/* ── มีเดินต่อก่อนช่วงถัดไป — slim dashed row right under the fare;
                shown for every leg (on the last one it covers the walk to the
                next leg you're about to add / to the destination) ── */}
            {(
              leg.transferAfter ? (
                <div className="rounded-[10px] bg-surface hairline px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-2">
                    <IconWalk size={14} className="text-brand" /> เดินต่อก่อนช่วงถัดไป
                    <button onClick={() => patchTransfer(i, null)} className="ml-auto text-ink-3 hover:text-ink-2" aria-label="เอาการเดินต่อออก"><IconX size={14} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    <div>
                      <div className={lbl}>ระยะเดิน (เมตร)</div>
                      <Field type="number" value={leg.transferAfter.walkMeters?.toString() ?? ''} onChange={(v) => patchTransfer(i, { ...leg.transferAfter, walkMeters: v ? Number(v) : undefined })} />
                    </div>
                    <div>
                      <div className={lbl}>เวลาเดิน (นาที)</div>
                      <Field type="number" value={leg.transferAfter.minutes?.toString() ?? ''} onChange={(v) => patchTransfer(i, { ...leg.transferAfter, minutes: v ? Number(v) : undefined })} />
                    </div>
                  </div>
                </div>
              ) : (
                <button onClick={() => patchTransfer(i, { minutes: 2 })}
                  className="w-full h-8 rounded-[10px] text-[11.5px] font-medium inline-flex items-center gap-1.5 text-ink-3 px-3"
                  style={{ border: '1px dashed var(--color-line-2)' }}>
                  <IconWalk size={13} /> มีเดินต่อก่อนช่วงถัดไป — กดถ้ามี
                  <IconPlus size={14} className="ml-auto shrink-0" />
                </button>
              )
            )}
          </div>
          )
        })}

        {/* เพิ่มช่วงใหม่ — สถานีขึ้นต่อจากสถานีลงของช่วงก่อนให้เลย */}
        <button onClick={() => {
          setLegs((ls) => {
            const prev = ls[ls.length - 1]
            return [...ls, { ...emptyLeg(), from: prev?.to ?? '' }]
          })
          setOpenLeg(legs.length)
        }}
          className="w-full h-10 rounded-[10px] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5"
          style={{ border: '1.5px dashed var(--color-brand-border)', color: 'var(--color-brand-mid)', background: 'var(--color-brand-soft)' }}>
          <IconPlus size={15} /> เพิ่มช่วงที่ {legs.length + 1}
        </button>

        <button onClick={save} disabled={busy} className="btn-primary w-full h-10 disabled:opacity-50">
          {busy ? 'กำลังบันทึก...' : 'บันทึกเส้นทาง'}
        </button>
        {/* ลบเส้นทางที่บันทึกไว้ — จงใจไม่เด่น (ตัวหนังสือแดงอ่อน) */}
        {!!initial?.legs?.length && (
          <button onClick={delRoute} disabled={busy}
            className="w-full h-9 text-[12.5px] text-[#D85A30]/60 hover:text-[#D85A30]">
            ลบการเดินทาง
          </button>
        )}
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
      {sg && sgOpen && <SingaporeMapViewer onClose={() => setSgOpen(false)}
        onResult={(t) => { setLegs(t.legs.map((l) => ({ ...l }))); setSgOpen(false) }} />}
    </Drawer>
  )
}
