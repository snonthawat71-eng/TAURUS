import { useEffect, useMemo, useRef, useState } from 'react'
import { IconTrash, IconPhoto, IconLoader2, IconCheck, IconPlus, IconBuildingStore } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { ColorPicker } from './ColorPicker'
import { Combobox } from './Combobox'
import { SignedImage } from './SignedImage'
import { uploadImage } from '@/lib/files'
import { useTrip } from '@/contexts/TripContext'
import { getTransitSuggestions, findLine } from '@/lib/metro/suggest'
import { catMeta, CATEGORY, PLACE_CATEGORIES, FOOD_CATEGORIES, FOOD_GROUPS } from '@/lib/placeMeta'
import type { Place, PlaceGroup, ExploreRoute, PlaceBranch } from '@/lib/database.types'
import type { PlaceInput } from '@/lib/placeMutations'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'
const lbl = 'text-[11px] text-ink-3'

function emptyRoute(): ExploreRoute { return { line: '', color: '#185FA5', station: '' } }
function emptyBranch(): PlaceBranch { return { label: '', map_url: '', line: '', color: '#185FA5', station: '' } }

export function PlaceEditor({
  open, onClose, group, tripId, initial, onSave, onDelete,
}: {
  open: boolean
  onClose: () => void
  group: PlaceGroup
  tripId: string
  initial: Place | null
  onSave: (fields: PlaceInput) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const { trip, places } = useTrip()
  // cities to offer = trip's cities ∪ cities already used on other places
  const tripCities = useMemo(() => {
    const set = new Set<string>()
    ;(trip?.cities ?? []).forEach((c) => set.add(c))
    places.forEach((p) => { if (p.city) set.add(p.city) })
    return Array.from(set)
  }, [trip, places])
  // built-in metro lines/stations for the trip's matched city only (no mixing).
  const sug = useMemo(() => getTransitSuggestions(trip), [trip])
  const cats = group === 'food' ? FOOD_CATEGORIES : PLACE_CATEGORIES
  const [city, setCity] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState(cats[0]) // a known key, or 'other'
  const [customCat, setCustomCat] = useState('')
  const [routes, setRoutes] = useState<ExploreRoute[]>([emptyRoute()])
  const [branches, setBranches] = useState<PlaceBranch[]>([])
  const [mapUrl, setMapUrl] = useState('')
  const [note, setNote] = useState('')
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    const initCat = initial?.category ?? ''
    const known = cats.includes(initCat)
    setCategory(known ? initCat : (initCat ? 'other' : cats[0]))
    setCustomCat(!known && initCat && initCat !== 'other' ? initCat : '')
    setRoutes(initial?.routes?.length
      ? initial.routes.map((r) => ({ line: r.line ?? '', color: r.color ?? '#185FA5', station: r.station ?? '' }))
      : [{ line: initial?.station_line ?? '', color: initial?.station_color ?? '#185FA5', station: initial?.station_name ?? '' }])
    setBranches(initial?.branches?.length
      ? initial.branches.map((b) => ({ label: b.label ?? '', map_url: b.map_url ?? '', line: b.line ?? '', color: b.color ?? '#185FA5', station: b.station ?? '' }))
      : [])
    setMapUrl(initial?.map_url ?? '')
    setNote(initial?.note ?? '')
    setPhotoPath(initial?.photo_path ?? null)
    setPhotoUrl(initial?.photo_url ?? null)
    setCity(initial?.city ?? (tripCities.length === 1 ? tripCities[0] : ''))
  }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const { path } = await uploadImage(tripId, 'place-photo', file)
    if (path) { setPhotoPath(path); setPhotoUrl(null) }
    setUploading(false)
    if (photoInput.current) photoInput.current.value = ''
  }

  function patchRoute(i: number, p: Partial<ExploreRoute>) {
    setRoutes((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)))
  }
  function patchBranch(i: number, p: Partial<PlaceBranch>) {
    setBranches((bs) => bs.map((b, idx) => (idx === i ? { ...b, ...p } : b)))
  }

  async function save() {
    setBusy(true)
    const clean = routes.filter((r) => r.line || r.station)
    const first = clean[0]
    const cleanBranches = branches.filter((b) => b.label || b.map_url || b.line || b.station)
    const finalCategory = category === 'other' ? (customCat.trim() || 'other') : category
    await onSave({
      group_type: group, name, category: finalCategory,
      station_line: first?.line || null, station_color: first?.color || null, station_name: first?.station || null,
      routes: clean.length ? clean : null,
      branches: cleanBranches.length ? cleanBranches : null,
      map_url: mapUrl, note, photo_path: photoPath, photo_url: photoUrl, city: city || null,
    })
    setBusy(false)
    onClose()
  }
  const meta = catMeta(category === 'other' ? (customCat.trim() || 'other') : category)
  async function del() {
    if (!onDelete || !confirm('ลบรายการนี้?')) return
    setBusy(true); await onDelete(); setBusy(false); onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title={initial ? 'แก้ไขรายการ' : (group === 'food' ? 'เพิ่มร้าน' : 'เพิ่มสถานที่')}>
      <div className="space-y-3">
        {/* Photo */}
        <div className="flex items-center gap-3">
          <div className="w-20 h-16 rounded-md overflow-hidden shrink-0 grid place-items-center" style={{ background: meta.bg }}>
            <SignedImage url={photoUrl} path={photoPath} className="w-full h-full object-cover"
              fallback={<meta.icon size={22} style={{ color: meta.fg, opacity: 0.85 }} />} />
          </div>
          <div>
            <button onClick={() => photoInput.current?.click()} disabled={uploading} className="btn-icon !w-auto px-3 gap-1.5 text-[12px] disabled:opacity-50">
              {uploading ? <IconLoader2 size={14} className="animate-spin" /> : <IconPhoto size={14} />}
              {(photoPath || photoUrl) ? 'เปลี่ยนรูป' : 'เพิ่มรูปสถานที่'}
            </button>
            {(photoPath || photoUrl) && <button onClick={() => { setPhotoPath(null); setPhotoUrl(null) }} className="btn-link text-[12px] ml-2">เอาออก</button>}
            <input ref={photoInput} type="file" accept="image/*" hidden onChange={onPickPhoto} />
          </div>
        </div>
        <div><div className={lbl}>ชื่อ</div><input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Forbidden City" /></div>
        <div>
          <div className={lbl}>หมวด</div>
          <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
            {group === 'food'
              ? FOOD_GROUPS.map((g) => (
                  <optgroup key={g.key} label={g.label}>
                    {g.cats.map((c) => <option key={c} value={c}>{CATEGORY[c].label}</option>)}
                  </optgroup>
                ))
              : cats.map((c) => <option key={c} value={c}>{CATEGORY[c].label}</option>)}
            <option value="other">อื่นๆ</option>
          </select>
          {category === 'other' && (
            <input className={`${field} mt-2`} value={customCat} onChange={(e) => setCustomCat(e.target.value)} placeholder="ระบุหมวดเอง เช่น ตลาดน้ำ" />
          )}
        </div>
        <div>
          <div className={lbl}>เมือง</div>
          {tripCities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tripCities.map((c) => {
                const on = city === c
                return (
                  <button key={c} onClick={() => setCity(on ? '' : c)}
                    className={['chip', on ? '!bg-brand-soft !text-brand-dark' : ''].join(' ')}
                    style={on ? { border: '0.5px solid var(--color-brand-border)' } : undefined}>
                    {on && <IconCheck size={12} />} {c}
                  </button>
                )
              })}
            </div>
          )}
          <input className={field} value={city} onChange={(e) => setCity(e.target.value)} placeholder="พิมพ์ชื่อเมือง เช่น Beijing" />
        </div>
        {/* multiple ways to get there — each its own line + station + colour */}
        <div>
          <div className={lbl}>การเดินทาง (เพิ่มได้หลายเส้นทาง)</div>
          <div className="space-y-2 mt-1">
            {routes.map((r, i) => {
              const known = findLine(sug, r.line ?? '')
              const stationOpts = known
                ? known.stations.map((s) => ({ value: s.name, label: s.num }))
                : sug.stations.map((name) => ({ value: name }))
              return (
                <div key={i} className="card p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-ink-2">เส้นทางที่ {i + 1}</span>
                    {routes.length > 1 && (
                      <button onClick={() => setRoutes((rs) => rs.filter((_, idx) => idx !== i))} className="text-ink-3 hover:text-[#D85A30]"><IconTrash size={14} /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Combobox className={field} value={r.line ?? ''} placeholder="สาย เช่น Line 1 / Bus"
                      options={sug.lines.map((l) => ({ value: l.name, color: l.color }))}
                      onChange={(v) => { const k = findLine(sug, v); patchRoute(i, { line: v, ...(k ? { color: k.color } : {}) }) }} />
                    <Combobox className={field} value={r.station ?? ''} placeholder="สถานี เช่น Wangfujing"
                      options={stationOpts} onChange={(v) => patchRoute(i, { station: v })} />
                  </div>
                  <ColorPicker value={r.color ?? '#185FA5'} onChange={(c) => patchRoute(i, { color: c })} />
                </div>
              )
            })}
            <button onClick={() => setRoutes((rs) => [...rs, emptyRoute()])} className="btn-link flex items-center gap-1.5 text-[12px]">
              <IconPlus size={14} /> เพิ่มเส้นทาง
            </button>
          </div>
        </div>

        {/* multiple branches (chains) — food only; each branch has its own map + station */}
        {group === 'food' && (
          <div>
            <div className="flex items-center gap-1.5">
              <IconBuildingStore size={13} className="text-ink-3" />
              <span className={lbl}>หลายสาขา (ถ้าร้านนี้มีหลายที่ — เลือกสาขาได้ในหน้ารายละเอียด)</span>
            </div>
            <div className="space-y-2 mt-1">
              {branches.map((b, i) => {
                const known = findLine(sug, b.line ?? '')
                const stationOpts = known
                  ? known.stations.map((s) => ({ value: s.name, label: s.num }))
                  : sug.stations.map((name) => ({ value: name }))
                return (
                  <div key={i} className="card p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <input className={field} value={b.label ?? ''} onChange={(e) => patchBranch(i, { label: e.target.value })} placeholder={`ชื่อสาขา เช่น สาขาสยาม`} />
                      <button onClick={() => setBranches((bs) => bs.filter((_, idx) => idx !== i))} className="text-ink-3 hover:text-[#D85A30] shrink-0"><IconTrash size={15} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Combobox className={field} value={b.line ?? ''} placeholder="สาย เช่น Line 1"
                        options={sug.lines.map((l) => ({ value: l.name, color: l.color }))}
                        onChange={(v) => { const k = findLine(sug, v); patchBranch(i, { line: v, ...(k ? { color: k.color } : {}) }) }} />
                      <Combobox className={field} value={b.station ?? ''} placeholder="สถานี"
                        options={stationOpts} onChange={(v) => patchBranch(i, { station: v })} />
                    </div>
                    <ColorPicker value={b.color ?? '#185FA5'} onChange={(c) => patchBranch(i, { color: c })} />
                    <input className={field} value={b.map_url ?? ''} onChange={(e) => patchBranch(i, { map_url: e.target.value })} placeholder="ลิงก์แผนที่ของสาขานี้ https://maps..." />
                  </div>
                )
              })}
              <button onClick={() => setBranches((bs) => [...bs, emptyBranch()])} className="btn-link flex items-center gap-1.5 text-[12px]">
                <IconPlus size={14} /> เพิ่มสาขา
              </button>
            </div>
          </div>
        )}

        <div><div className={lbl}>โน้ต</div>
          <textarea className="hairline rounded-md text-[13px] p-3 bg-surface w-full outline-none focus:border-brand resize-none" rows={2}
            value={note} onChange={(e) => setNote(e.target.value)} placeholder="รายละเอียด เช่น ควรจองล่วงหน้า" />
        </div>
        <div><div className={lbl}>ลิงก์แผนที่</div><input className={field} value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="https://maps.apple.com/?q=..." /></div>
        <button onClick={save} disabled={busy || !name} className="btn-primary w-full h-10 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        {initial && onDelete && (
          <button onClick={del} disabled={busy} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] text-[#D85A30]"><IconTrash size={15} /> ลบรายการ</button>
        )}
      </div>
    </Drawer>
  )
}
