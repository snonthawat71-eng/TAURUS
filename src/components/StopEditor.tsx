import { useEffect, useMemo, useRef, useState } from 'react'
import { IconBuildingStore, IconCheck, IconCompass, IconLink, IconLoader2, IconNotes, IconX } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { SectionCard } from './SectionCard'
import { SignedImage } from './SignedImage'
import { QuickExplorePicker, type QuickPick } from './QuickExplorePicker'
import { useTrip } from '@/contexts/TripContext'
import { catMeta } from '@/lib/placeMeta'
import { planMapUrl, branchesOf, hasOwnLocation } from '@/lib/branches'
import { nameFromMapUrl, resolveMapName, isMapLink } from '@/lib/geo'
import type { StopInput } from '@/lib/mutations'

// Flat form: what you fill in EVERY time (place, time) sits open under a small
// label with no box around it — a filled field instead of an outlined one, so
// there's no frame-inside-a-frame. The two optional parts fold away into the
// same SectionCard the other editors use, keeping the form one screen tall.
const field = 'rounded-[11px] text-[13px] h-10 px-3 bg-surface-2 w-full outline-none border-0 focus:[box-shadow:inset_0_0_0_1.5px_var(--color-brand)]'
// same size/weight as `lbl` in the place & Explore editors, so every form reads alike
const groupLabel = 'block text-[11px] text-ink-3 mb-1.5'

/** What tapping the stop's name does — also the folded section's summary. */
const LINK_MODE_LABEL: Record<string, string> = {
  map: 'เปิดแผนที่', detail: 'ดูรายละเอียด', none: 'ไม่มี',
}

export function StopEditor({
  open, onClose, initial, onSave,
}: {
  open: boolean
  onClose: () => void
  initial: (StopInput & { id?: string }) | null
  onSave: (input: StopInput) => Promise<void>
}) {
  const { trip, places } = useTrip()
  const [time, setTime] = useState('')
  const [place, setPlace] = useState('')
  const [note, setNote] = useState('')
  const [mapUrl, setMapUrl] = useState('')
  const [linkMode, setLinkMode] = useState('map')
  const [role, setRole] = useState<'main' | 'backup'>('main')
  const [busy, setBusy] = useState(false)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [cityFilter, setCityFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState<'all' | 'place' | 'food'>('all')
  const [quickOpen, setQuickOpen] = useState(false)
  const [autoFilled, setAutoFilled] = useState(false)
  // WHICH branch of a multi-branch place this visit goes to (null = main location)
  const [branchIdx, setBranchIdx] = useState<number | null>(null)
  // which optional section is unfolded (null = both closed, the usual case)
  const [openCard, setOpenCard] = useState<'link' | 'note' | null>(null)

  // places the group has already added to the plan (from Places/Food/All),
  // most recently saved first
  const inPlan = useMemo(
    () => places.filter((p) => p.in_plan && p.name)
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
    [places],
  )

  // which group a planned place belongs to (stored group_type, else its category's group)
  const groupOf = (p: (typeof inPlan)[number]) =>
    p.group_type === 'food' || catMeta(p.category).group === 'food' ? 'food' : 'place'

  // cities to offer as filters: the trip's cities + any city set on a planned place
  const cities = useMemo(() => {
    const set = new Set<string>()
    ;(trip?.cities ?? []).forEach((c) => set.add(c))
    inPlan.forEach((p) => { if (p.city) set.add(p.city) })
    return Array.from(set)
  }, [trip, inPlan])

  const shown = useMemo(() => inPlan.filter((p) =>
    (cityFilter === 'all' || (p.city || '') === cityFilter) &&
    (groupFilter === 'all' || groupOf(p) === groupFilter)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [inPlan, cityFilter, groupFilter])

  useEffect(() => {
    if (open) {
      setTime(initial?.time ?? '')
      setPlace(initial?.place_name ?? '')
      setNote(initial?.note ?? '')
      setMapUrl(initial?.map_url ?? '')
      setLinkMode(initial?.link_mode ?? 'map')
      setRole(initial?.role === 'backup' ? 'backup' : 'main')
      setBranchIdx(initial?.branch_idx ?? null)
      setPickedId(null)
      setCityFilter('all')
      setGroupFilter('all')
      setQuickOpen(false)
      setAutoFilled(false)
      setLinkState('idle')
      // open the map-link section straight away when editing a stop that has
      // one, so an existing link isn't hidden behind a fold
      setOpenCard(initial?.map_url ? 'link' : null)
    }
  }, [open, initial])

  // paste a map link → auto-fill the name (still editable), same behaviour as
  // the Explore/Place editors. A hand-typed name never gets overwritten.
  const [linkState, setLinkState] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle')
  const nameRef = useRef(place); nameRef.current = place
  const autoRef = useRef(autoFilled); autoRef.current = autoFilled
  useEffect(() => {
    if (!open) return
    let raw = mapUrl.trim()
    if (!raw) { setLinkState('idle'); return }
    // tolerate a pasted link without the scheme ("maps.app.goo.gl/xxx")
    if (!/^https?:\/\//i.test(raw)) {
      if (/^[\w-]+(\.[\w-]+)+\//.test(raw)) raw = `https://${raw}`
      else { setLinkState('idle'); return }
    }
    let stop = false
    const t = setTimeout(async () => {
      if (nameRef.current.trim() && !autoRef.current) { setLinkState('idle'); return }
      let got = nameFromMapUrl(raw)
      if (!got && isMapLink(raw)) {
        setLinkState('busy')
        got = await resolveMapName(raw)
      }
      if (stop) return
      if (got) { setPlace(got); setAutoFilled(true); setLinkState('ok') }
      else setLinkState('fail')
    }, 450)
    return () => { stop = true; clearTimeout(t) }
  }, [open, mapUrl])

  // Desktop: let the place strip be dragged with the mouse (touch already scrolls
  // natively). We track the drag on a ref and swallow the click that follows a
  // real drag so dragging never accidentally selects a card.
  const rowRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: false })
  function onRowDown(e: React.MouseEvent) {
    const el = rowRef.current
    if (!el) return
    drag.current = { down: true, startX: e.pageX, startLeft: el.scrollLeft, moved: false }
  }
  function onRowMove(e: React.MouseEvent) {
    const el = rowRef.current
    if (!el || !drag.current.down) return
    const dx = e.pageX - drag.current.startX
    if (Math.abs(dx) > 3) drag.current.moved = true
    el.scrollLeft = drag.current.startLeft - dx
  }
  function onRowUp() { drag.current.down = false }

  // The place this stop refers to — the card just picked, else matched by name
  // (a stop saved earlier only stores the name). Drives the branch chips below.
  const stopPlace = useMemo(() => {
    if (pickedId) return places.find((p) => p.id === pickedId) ?? null
    const n = place.trim().toLowerCase()
    if (!n) return null
    return places.find((p) => (p.name ?? '').trim().toLowerCase() === n) ?? null
  }, [places, pickedId, place])
  const stopBranches = branchesOf(stopPlace)

  /** Switch which branch THIS visit goes to — also swaps in that branch's map
   *  link so navigation follows it (other days keep their own choice). */
  function pickBranch(i: number | null) {
    setBranchIdx(i)
    const url = i == null ? (stopPlace?.map_url ?? '') : (stopBranches[i]?.map_url ?? stopPlace?.map_url ?? '')
    if (url) { setMapUrl(url); setLinkMode('detail') }
  }

  /** Undo everything picking a place filled in. Time and หลัก/สำรอง are the
   *  user's own input, not the place's, so they stay. */
  function clearPick() {
    setPickedId(null)
    setPlace('')
    setMapUrl('')
    setNote('')
    setBranchIdx(null)
    setLinkMode('map')
    setAutoFilled(false)
  }

  function pickPlanned(id: string) {
    if (drag.current.moved) return // ignore the click that ends a drag
    const p = inPlan.find((x) => x.id === id)
    if (!p) return
    // tap the selected card again to deselect — and clear what it filled in,
    // otherwise the name/link/note of a place you just unpicked gets saved
    if (pickedId === id) { clearPick(); return }
    setPickedId(id)
    setPlace(p.name ?? '')
    setMapUrl(planMapUrl(p) ?? '') // branch picked for the plan, else main
    setBranchIdx(p.plan_branch ?? null) // that place's default branch
    setNote(p.note ?? '')
    setLinkMode('detail')
    setAutoFilled(false)
  }

  // a place just quick-added from Explore — it's now in the plan (and Places/Food);
  // pre-select it for this stop so the user can save right away
  function onQuickPicked(pick: QuickPick) {
    setPickedId(pick.id)
    setBranchIdx(null) // freshly collected — no branch chosen yet
    setPlace(pick.name ?? '')
    setMapUrl(pick.map_url ?? '')
    setNote(pick.note ?? '')
    setLinkMode('detail')
    setAutoFilled(false)
  }

  async function save() {
    setBusy(true)
    await onSave({
      time: time || null, place_name: place.trim() || null, note: note || null, map_url: mapUrl || null,
      link_mode: linkMode, role: role === 'backup' ? 'backup' : null,
      // only meaningful for a multi-branch place; null otherwise
      branch_idx: stopPlace ? branchIdx : null,
    })
    setBusy(false)
    onClose()
  }

  return (
    <>
    <Drawer open={open} onClose={onClose} title={initial?.id ? 'แก้ไขจุดแวะ' : 'เพิ่มจุดแวะ'}>
      <div>
        {/* ── จากสถานที่ในแพลน ───────────────────────────────── */}
        <div className="pb-4">
          <span className={groupLabel}>จากสถานที่ในแพลน</span>
          {inPlan.length > 0 && (
            <div className="flex items-center gap-2 mb-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
              <div className="inline-flex p-0.5 rounded-full bg-surface-2 shrink-0">
                {([['all', 'ทั้งหมด'], ['place', 'Places'], ['food', 'Food']] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setGroupFilter(v)}
                    className={['px-3 h-7 rounded-full text-[12px] font-semibold transition-colors',
                      groupFilter === v ? 'bg-surface shadow-sm text-ink' : 'text-ink-3'].join(' ')}>
                    {label}
                  </button>
                ))}
              </div>
              {/* cities sit on the SAME row — each one toggles, so there's no
                  second "ทั้งหมด" chip fighting the one in the group switch */}
              {cities.map((c) => (
                <button key={c} onClick={() => setCityFilter((cur) => (cur === c ? 'all' : c))}
                  className={['px-3 h-7 rounded-full text-[12px] font-semibold whitespace-nowrap shrink-0 transition-colors',
                    cityFilter === c ? 'bg-brand-soft text-brand-dark' : 'text-ink-3'].join(' ')}>
                  {c}
                </button>
              ))}
            </div>
          )}
          <div ref={rowRef} onMouseDown={onRowDown} onMouseMove={onRowMove} onMouseUp={onRowUp} onMouseLeave={onRowUp}
            className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1 cursor-grab active:cursor-grabbing select-none">
            {/* quick-select straight from Explore — always the first card */}
            <button type="button" onClick={() => setQuickOpen(true)}
              className="shrink-0 w-[104px] min-h-[104px] rounded-[12px] flex flex-col items-center justify-center gap-1.5 text-center"
              style={{ border: '1.5px dashed var(--color-brand-border)', background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)' }}>
              <IconCompass size={24} />
              <span className="text-[11px] font-medium leading-tight px-1">เลือกด่วน<br />จาก Explore</span>
            </button>
            {shown.map((p) => {
              const meta = catMeta(p.category)
              const Icon = meta.icon
              const sel = pickedId === p.id
              return (
                <button key={p.id} onClick={() => pickPlanned(p.id)}
                  className="relative shrink-0 w-[104px] rounded-[12px] overflow-hidden text-left bg-surface transition flex flex-col"
                  style={{ border: `1.5px solid ${sel ? 'var(--color-brand)' : 'var(--color-line)'}` }}>
                  {/* flex-col + shrink-0 pins the photo to the TOP — a <button>
                      otherwise centres its content, so when the flex row stretches a
                      short-name card taller the photo dropped, baring a white strip. */}
                  <div className="h-[68px] shrink-0 relative overflow-hidden" style={{ background: meta.bg }}>
                    {/* Render the photo EXACTLY like PlaceCard (w-full h-full object-cover
                        + focus) — that markup fills cleanly on iOS, whereas an
                        absolutely-positioned object-cover img leaves a white strip there. */}
                    <SignedImage url={p.photo_url} path={p.photo_path} focus={p.photo_focus} alt={p.name ?? ''}
                      className="w-full h-full object-cover" width={300}
                      fallback={<div className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><Icon size={22} style={{ color: meta.fg }} /></div>} />
                    {sel && <div className="absolute inset-0 grid place-items-center" style={{ background: 'rgba(2,112,251,0.35)' }}><span className="size-6 rounded-full bg-brand grid place-items-center"><IconCheck size={15} className="text-white" /></span></div>}
                  </div>
                  <div className="p-1.5">
                    <div className="text-[11px] font-medium leading-tight line-clamp-2">{p.name}</div>
                    <div className="flex items-center gap-1 text-[10px] mt-0.5" style={{ color: meta.fg }}>
                      <Icon size={11} /> <span className="truncate">{meta.label}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          {inPlan.length === 0 && (
            <p className="text-[11px] text-ink-3 mt-1.5">ยังไม่มีสถานที่ในแพลน — แตะ "เลือกด่วนจาก Explore" เพื่อเพิ่มได้เลย</p>
          )}
        </div>

        {/* ── สถานที่ ────────────────────────────────────────── */}
        <div className="pb-4">
          <span className={groupLabel}>สถานที่</span>
          <input className={field} value={place}
            onChange={(e) => { setPlace(e.target.value); setAutoFilled(false) }}
            placeholder="ชื่อสถานที่ / กิจกรรม" />

          {/* ร้านมีหลายสาขา — วันนี้ไปสาขาไหน (เก็บแยกต่อวัน วันอื่นไม่เปลี่ยนตาม) */}
          {stopBranches.length > 0 && (
            <div className="mt-2">
              <div className="text-[11px] text-ink-3 mb-1.5 flex items-center gap-1">
                <IconBuildingStore size={12} /> วันนี้ไปสาขาไหน?
              </div>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
                {hasOwnLocation(stopPlace) && (
                  <button type="button" onClick={() => pickBranch(null)}
                    className={['chip shrink-0', branchIdx === null ? '!bg-brand-soft !text-brand-dark' : ''].join(' ')}
                    style={branchIdx === null ? { border: '0.5px solid var(--color-brand-border)' } : undefined}>
                    {branchIdx === null && <IconCheck size={12} />} ที่ตั้งหลัก
                  </button>
                )}
                {stopBranches.map((b, i) => (
                  <button type="button" key={i} onClick={() => pickBranch(i)}
                    className={['chip shrink-0', branchIdx === i ? '!bg-brand-soft !text-brand-dark' : ''].join(' ')}
                    style={branchIdx === i ? { border: '0.5px solid var(--color-brand-border)' } : undefined}>
                    {branchIdx === i && <IconCheck size={12} />} {b.label || `สาขา ${i + 1}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── เวลา ───────────────────────────────────────────── */}
        <div className="pb-4">
          <span className={groupLabel}>เวลา</span>
          <div className="flex items-center gap-2">
            <div className={`${field} flex items-center !px-0 overflow-hidden`}>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="เวลา"
                className="flex-1 min-w-0 h-full bg-transparent outline-none text-[13px] px-3 appearance-none" />
              {time && (
                <button type="button" onClick={() => setTime('')} aria-label="ล้างเวลา"
                  className="shrink-0 size-9 grid place-items-center text-ink-3 hover:text-ink-2"><IconX size={14} /></button>
              )}
            </div>
            {/* แผนหลัก / สำรอง — สำรองไปอยู่โซนพับท้ายวัน ไม่นับ/ไม่เตือน */}
            <div className="inline-flex gap-0.5 p-0.5 rounded-[11px] bg-surface-2 h-10 items-center shrink-0">
              {([['main', 'หลัก'], ['backup', 'สำรอง']] as const).map(([v, label]) => (
                <button key={v} onClick={() => setRole(v)}
                  className={['px-3 h-9 rounded-[9px] text-[12px] font-semibold', role === v ? 'bg-surface text-ink shadow-sm' : 'text-ink-3'].join(' ')}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── ส่วนที่พับไว้: การ์ดเหมือนฟอร์มอื่นในแอป ─────────── */}
        <div className="space-y-2.5">
          <SectionCard open={openCard === 'link'} done={!!mapUrl.trim()} showCheck={false}
            icon={<IconLink size={15} />} title="ลิงก์แผนที่" sub="แตะชื่อแล้วให้เปิดอะไร"
            summary={[mapUrl.trim() ? 'ใส่ลิงก์แล้ว' : '', LINK_MODE_LABEL[linkMode] ?? ''].filter(Boolean).join(' · ')}
            onToggle={() => setOpenCard((c) => (c === 'link' ? null : 'link'))}>
            <div className="space-y-2">
              <input className={field} value={mapUrl} onChange={(e) => setMapUrl(e.target.value)}
                placeholder="วางลิงก์แผนที่ (ถ้ามี)" inputMode="url" />
              {linkState === 'busy' && (
                <div className="flex items-center gap-1 text-[10.5px] font-medium text-ink-3">
                  <IconLoader2 size={12} className="animate-spin" /> กำลังอ่านชื่อจากลิงก์…
                </div>
              )}
              {linkState === 'ok' && autoFilled && place.trim() && (
                <div className="flex items-center gap-1 text-[10.5px] font-medium" style={{ color: '#16A34A' }}>
                  <IconCheck size={12} /> เติมชื่อจากลิงก์ให้แล้ว — แก้ไขได้
                </div>
              )}
              {linkState === 'fail' && (
                <div className="text-[10.5px] text-ink-3">อ่านชื่อจากลิงก์นี้ไม่ได้ — พิมพ์ชื่อเองได้เลย</div>
              )}
              <div className="flex gap-1.5">
                {(Object.entries(LINK_MODE_LABEL) as [string, string][]).map(([v, label]) => (
                  <button key={v} onClick={() => setLinkMode(v)}
                    className="flex-1 h-9 rounded-[10px] text-[12px] font-semibold transition-colors"
                    style={linkMode === v
                      ? { background: 'var(--color-brand)', color: '#fff' }
                      : { background: 'var(--color-surface-2)', color: 'var(--color-ink-2)' }}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[10.5px] text-ink-3">เมื่อแตะชื่อสถานที่ · "ดูรายละเอียด" ใช้ได้เมื่อชื่อตรงกับสถานที่ในหน้า Places/Food</p>
            </div>
          </SectionCard>

          <SectionCard open={openCard === 'note'} done={!!note.trim()} showCheck={false}
            icon={<IconNotes size={15} />} title="รายละเอียด" sub="โน้ตเพิ่มเติม (ไม่บังคับ)"
            summary={note.trim()}
            onToggle={() => setOpenCard((c) => (c === 'note' ? null : 'note'))}>
            <textarea className={`${field} !h-auto py-2.5 resize-none`} rows={3}
              value={note} onChange={(e) => setNote(e.target.value)} placeholder="รายละเอียดเพิ่มเติม" />
          </SectionCard>
        </div>

        <button onClick={save} disabled={busy || !place.trim()} className="btn-primary w-full h-11 mt-4 disabled:opacity-50">
          {busy ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </Drawer>
    <QuickExplorePicker open={quickOpen} onClose={() => setQuickOpen(false)} onPicked={onQuickPicked} />
    </>
  )
}
