import { useEffect, useMemo, useRef, useState } from 'react'
import { IconCheck } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { ClearableField } from './ClearableField'
import { SignedImage } from './SignedImage'
import { useTrip } from '@/contexts/TripContext'
import { catMeta } from '@/lib/placeMeta'
import type { StopInput } from '@/lib/mutations'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'

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
  const [busy, setBusy] = useState(false)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [cityFilter, setCityFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState<'all' | 'place' | 'food'>('all')

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
      setPickedId(null)
      setCityFilter('all')
      setGroupFilter('all')
    }
  }, [open, initial])

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

  function pickPlanned(id: string) {
    if (drag.current.moved) return // ignore the click that ends a drag
    const p = inPlan.find((x) => x.id === id)
    if (!p) return
    if (pickedId === id) { setPickedId(null); return } // tap again to deselect
    setPickedId(id)
    setPlace(p.name ?? '')
    setMapUrl(p.map_url ?? '')
    setNote(p.note ?? '')
    setLinkMode('detail')
  }

  async function save() {
    setBusy(true)
    await onSave({ time: time || null, place_name: place.trim() || null, note: note || null, map_url: mapUrl || null, link_mode: linkMode })
    setBusy(false)
    onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title={initial?.id ? 'แก้ไขจุดแวะ' : 'เพิ่มจุดแวะ'}>
      <div className="space-y-3">
        {inPlan.length > 0 && (
          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] text-ink-3">ดึงจากสถานที่ในแพลน</label>
              <div className="inline-flex p-0.5 rounded-full bg-surface-2 shrink-0">
                {([['all', 'ทั้งหมด'], ['place', 'Places'], ['food', 'Food']] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setGroupFilter(v)}
                    className={['px-2.5 h-7 rounded-full text-[12px] font-medium transition-colors',
                      groupFilter === v ? 'bg-surface shadow-sm text-ink' : 'text-ink-3'].join(' ')}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {cities.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-2 -mx-1 px-1">
                {[{ key: 'all', label: 'ทั้งหมด' }, ...cities.map((c) => ({ key: c, label: c }))].map((c) => (
                  <button key={c.key} onClick={() => setCityFilter(c.key)}
                    className={['px-2.5 h-7 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors',
                      cityFilter === c.key ? 'bg-brand-soft text-brand-dark' : 'text-ink-3'].join(' ')}>
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            {shown.length === 0 ? (
              <p className="text-[12px] text-ink-3 mt-2">ไม่มีสถานที่ในหมวดนี้</p>
            ) : (
            <div ref={rowRef} onMouseDown={onRowDown} onMouseMove={onRowMove} onMouseUp={onRowUp} onMouseLeave={onRowUp}
              className="flex gap-2 overflow-x-auto no-scrollbar mt-1.5 -mx-1 px-1 pb-1 cursor-grab active:cursor-grabbing select-none">
              {shown.map((p) => {
                const meta = catMeta(p.category)
                const Icon = meta.icon
                const sel = pickedId === p.id
                return (
                  <button key={p.id} onClick={() => pickPlanned(p.id)}
                    className="relative shrink-0 w-[104px] rounded-[10px] overflow-hidden text-left bg-surface transition"
                    style={{ border: `1.5px solid ${sel ? 'var(--color-brand)' : 'var(--color-line)'}` }}>
                    <div className="h-[68px] relative overflow-hidden" style={{ background: meta.bg }}>
                      {/* Honour the place's saved crop (photo_focus) so the thumb shows
                          the same framing as its card/detail — that crop is what hides
                          plain sky / white edges the user cropped away. object-cover still
                          fills the box; a coloured bg backs it so it never flashes white. */}
                      <SignedImage url={p.photo_url} path={p.photo_path} focus={p.photo_focus} alt={p.name ?? ''}
                        className="absolute inset-0 w-full h-full object-cover"
                        fallback={<div className="absolute inset-0 grid place-items-center" style={{ background: meta.bg }}><Icon size={22} style={{ color: meta.fg }} /></div>} />
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
            )}
          </div>
        )}
        <div>
          <label className="text-[11px] text-ink-3">เวลา</label>
          <ClearableField type="time" ariaLabel="ล้างเวลา" value={time} onChange={setTime} onClear={() => setTime('')} />
        </div>
        <div>
          <label className="text-[11px] text-ink-3">ชื่อสถานที่ / กิจกรรม</label>
          <input className={field} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="เช่น Forbidden City" />
        </div>
        <div>
          <label className="text-[11px] text-ink-3">โน้ต</label>
          <textarea
            className="hairline rounded-md text-[13px] p-3 bg-surface w-full outline-none focus:border-brand resize-none"
            rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="รายละเอียดเพิ่มเติม"
          />
        </div>
        <div>
          <label className="text-[11px] text-ink-3">ลิงก์แผนที่ (ถ้ามี)</label>
          <input className={field} value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="https://maps.apple.com/?q=..." />
        </div>
        <div>
          <label className="text-[11px] text-ink-3">เมื่อแตะชื่อสถานที่</label>
          <div className="grid grid-cols-3 gap-1.5 mt-1.5">
            {([['map', 'เปิดแผนที่'], ['detail', 'ดูรายละเอียด'], ['none', 'ไม่มี']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setLinkMode(v)}
                className="h-9 rounded-md text-[12px] font-medium transition-colors"
                style={linkMode === v
                  ? { background: 'var(--color-brand)', color: '#fff' }
                  : { background: 'var(--color-surface-2)', color: 'var(--color-ink-2)' }}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-ink-3 mt-1.5">"ดูรายละเอียด" ใช้ได้เมื่อชื่อตรงกับสถานที่ในหน้า Places/Food</p>
        </div>
        <button onClick={save} disabled={busy || !place.trim()} className="btn-primary w-full h-10 disabled:opacity-50">
          {busy ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </Drawer>
  )
}
