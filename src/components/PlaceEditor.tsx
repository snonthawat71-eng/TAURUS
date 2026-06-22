import { useEffect, useMemo, useState } from 'react'
import { IconTrash, IconPhoto, IconLoader2, IconCheck, IconPlus, IconBuildingStore, IconToolsKitchen2, IconFileTypePdf, IconX } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { ColorPicker } from './ColorPicker'
import { Combobox } from './Combobox'
import { SignedImage } from './SignedImage'
import { PhotoCropper } from './PhotoCropper'
import { uploadImage } from '@/lib/files'
import { confirmDialog } from '@/lib/confirm'
import { useTrip } from '@/contexts/TripContext'
import { getTransitSuggestions, findLine } from '@/lib/metro/suggest'
import { catMeta, CATEGORY, PLACE_CATEGORIES, FOOD_CATEGORIES, FOOD_GROUPS } from '@/lib/placeMeta'
import type { Place, PlaceGroup, ExploreRoute, PlaceBranch } from '@/lib/database.types'
import type { PlaceInput } from '@/lib/placeMutations'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'
const lbl = 'text-[11px] text-ink-3'

function emptyRoute(): ExploreRoute { return { line: '', color: '#185FA5', station: '' } }
function emptyBranch(): PlaceBranch { return { label: '', map_url: '', line: '', color: '#185FA5', station: '' } }
/** A stored menu file is a PDF when its path/URL ends in .pdf (ignoring query). */
function isPdfRef(ref: string): boolean { return /\.pdf($|\?)/i.test(ref) }

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
  const [multiBranch, setMultiBranch] = useState(false)
  const [mapUrl, setMapUrl] = useState('')
  const [note, setNote] = useState('')
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoFocus, setPhotoFocus] = useState<string | null>(null)
  const [photos, setPhotos] = useState<string[]>([]) // extra photos (2nd–4th)
  const [menuPaths, setMenuPaths] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [morePhotoUploading, setMorePhotoUploading] = useState(false)
  const [menuUploading, setMenuUploading] = useState(false)
  const [busy, setBusy] = useState(false)

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
    setMultiBranch(!!initial?.multi_branch)
    setMapUrl(initial?.map_url ?? '')
    setNote(initial?.note ?? '')
    setPhotoPath(initial?.photo_path ?? null)
    setPhotoUrl(initial?.photo_url ?? null)
    setPhotoFocus(initial?.photo_focus ?? null)
    setPhotos(initial?.photos ?? [])
    setMenuPaths(initial?.menu_paths ?? [])
    setCity(initial?.city ?? (tripCities.length === 1 ? tripCities[0] : ''))
  }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const file = input.files?.[0]
    if (!file) return
    setUploading(true)
    const { path } = await uploadImage(tripId, 'place-photo', file)
    if (path) { setPhotoPath(path); setPhotoUrl(null); setPhotoFocus(null) }
    setUploading(false)
    input.value = '' // allow re-picking the same file
  }

  // extra photos — up to 3 more (4 total with the primary above)
  async function onPickMorePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const files = Array.from(input.files ?? [])
    if (!files.length) return
    setMorePhotoUploading(true)
    for (const file of files) {
      const { path } = await uploadImage(tripId, 'place-photo', file)
      if (path) setPhotos((m) => (m.length >= 3 ? m : [...m, path]))
    }
    setMorePhotoUploading(false)
    input.value = ''
  }

  async function onPickMenu(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const files = Array.from(input.files ?? [])
    if (!files.length) return
    setMenuUploading(true)
    for (const file of files) {
      const { path } = await uploadImage(tripId, 'place-menu', file)
      if (path) setMenuPaths((m) => [...m, path])
    }
    setMenuUploading(false)
    input.value = ''
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
      group_type: group, name: name.trim(), category: finalCategory,
      station_line: first?.line || null, station_color: first?.color || null, station_name: first?.station || null,
      routes: clean.length ? clean : null,
      branches: cleanBranches.length ? cleanBranches : null,
      multi_branch: multiBranch ? true : null,
      map_url: mapUrl, note, photo_path: photoPath, photo_url: photoUrl, photo_focus: (photoPath || photoUrl) ? photoFocus : null, photos: photos.length ? photos : null, city: city || null,
      menu_paths: group === 'food' && menuPaths.length ? menuPaths : null,
    })
    setBusy(false)
    onClose()
  }
  const meta = catMeta(category === 'other' ? (customCat.trim() || 'other') : category)
  async function del() {
    if (!onDelete || !(await confirmDialog({ message: 'ลบรายการนี้?', danger: true, confirmLabel: 'ลบ' }))) return
    setBusy(true); await onDelete(); setBusy(false); onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title={initial ? 'แก้ไขรายการ' : (group === 'food' ? 'เพิ่มร้าน' : 'เพิ่มสถานที่')}>
      <div className="space-y-3">
        {/* Photo — drag to reposition, slider to zoom (the crop shown here is what
            appears on the card and detail view) */}
        <div className="space-y-2">
          {(photoPath || photoUrl) ? (
            <PhotoCropper url={photoUrl} path={photoPath} focus={photoFocus} onChange={setPhotoFocus}
              fallback={<div className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><meta.icon size={28} style={{ color: meta.fg, opacity: 0.85 }} /></div>} />
          ) : (
            <label htmlFor="place-photo-input" aria-disabled={uploading}
              className="w-full aspect-[16/10] rounded-lg hairline flex flex-col items-center justify-center gap-1 text-ink-3 cursor-pointer aria-disabled:opacity-50 aria-disabled:pointer-events-none [-webkit-tap-highlight-color:transparent]" style={{ background: meta.bg }}>
              {uploading ? <IconLoader2 size={20} className="animate-spin" /> : <><IconPhoto size={22} style={{ color: meta.fg, opacity: 0.85 }} /><span className="text-[12px]" style={{ color: meta.fg }}>เพิ่มรูปสถานที่</span></>}
            </label>
          )}
          {(photoPath || photoUrl) && (
            <div className="flex items-center gap-3">
              <label htmlFor="place-photo-input" aria-disabled={uploading}
                className="btn-icon !w-auto px-3 gap-1.5 text-[12px] cursor-pointer aria-disabled:opacity-50 aria-disabled:pointer-events-none [-webkit-tap-highlight-color:transparent]">
                {uploading ? <IconLoader2 size={14} className="animate-spin" /> : <IconPhoto size={14} />}
                เปลี่ยนรูป
              </label>
              <button onClick={() => { setPhotoPath(null); setPhotoUrl(null); setPhotoFocus(null) }} className="btn-link text-[12px]">เอาออก</button>
            </div>
          )}
          <input id="place-photo-input" type="file" accept="image/*" hidden onChange={onPickPhoto} />
        </div>

        {/* extra photos — up to 3 more (4 total). Shown in the detail view, not the card */}
        <div>
          <div className={lbl}>รูปเพิ่มเติม (อีกสูงสุด 3 รูป — โชว์ตอนเปิดดูรายละเอียด)</div>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {photos.map((ref, i) => (
              <div key={ref} className="relative w-16 h-16 rounded-md overflow-hidden bg-surface-2 hairline">
                <SignedImage url={ref.startsWith('http') ? ref : undefined} path={ref.startsWith('http') ? undefined : ref}
                  className="w-full h-full object-cover" width={160}
                  fallback={<div className="w-full h-full grid place-items-center text-ink-3"><IconPhoto size={18} /></div>} />
                <button onClick={() => setPhotos((m) => m.filter((_, idx) => idx !== i))}
                  aria-label="ลบรูป" className="absolute top-0.5 right-0.5 size-5 rounded-full bg-black/55 text-white grid place-items-center">
                  <IconX size={12} />
                </button>
              </div>
            ))}
            {photos.length < 3 && (
              <label htmlFor="place-morephotos-input" aria-disabled={morePhotoUploading}
                className="w-16 h-16 rounded-md hairline grid place-items-center text-ink-3 cursor-pointer aria-disabled:opacity-50 aria-disabled:pointer-events-none [-webkit-tap-highlight-color:transparent]">
                {morePhotoUploading ? <IconLoader2 size={18} className="animate-spin" /> : <IconPlus size={18} />}
              </label>
            )}
            <input id="place-morephotos-input" type="file" accept="image/*" multiple hidden onChange={onPickMorePhotos} />
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

        {/* multiple branches (chains) — for any place that has more than one
            location. Location (สาย/สถานี/แผนที่) per branch is optional — a branch
            can be just a name. */}
        <div>
            <div className="flex items-center gap-1.5">
              <IconBuildingStore size={13} className="text-ink-3" />
              <span className={lbl}>หลายสาขา (ถ้ามีหลายที่ — ใส่แค่ชื่อสาขาก็ได้ ไม่ต้องระบุโลเคชั่น)</span>
            </div>
            {/* simple flag: just mark "has many branches" → shows a label on the card */}
            <button onClick={() => setMultiBranch((v) => !v)}
              className={['chip mt-1.5', multiBranch ? '!bg-brand-soft !text-brand-dark' : ''].join(' ')}
              style={multiBranch ? { border: '0.5px solid var(--color-brand-border)' } : undefined}>
              {multiBranch && <IconCheck size={12} />} มีหลายสาขา
            </button>
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

        {/* menu files (restaurants) — photos/PDFs of the menu */}
        {group === 'food' && (
          <div>
            <div className="flex items-center gap-1.5">
              <IconToolsKitchen2 size={13} className="text-ink-3" />
              <span className={lbl}>เมนูอาหาร (แนบรูปเมนู หรือไฟล์ PDF ได้หลายไฟล์)</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {menuPaths.map((ref, i) => (
                <div key={ref} className="relative w-16 h-16 rounded-md overflow-hidden bg-surface-2 hairline">
                  {isPdfRef(ref)
                    ? <div className="w-full h-full grid place-items-center text-ink-3"><IconFileTypePdf size={22} /></div>
                    : <SignedImage url={ref.startsWith('http') ? ref : undefined} path={ref.startsWith('http') ? undefined : ref}
                        className="w-full h-full object-cover" width={160}
                        fallback={<div className="w-full h-full grid place-items-center text-ink-3"><IconPhoto size={18} /></div>} />}
                  <button onClick={() => setMenuPaths((m) => m.filter((_, idx) => idx !== i))}
                    aria-label="ลบไฟล์เมนู" className="absolute top-0.5 right-0.5 size-5 rounded-full bg-black/55 text-white grid place-items-center">
                    <IconX size={12} />
                  </button>
                </div>
              ))}
              <label htmlFor="place-menu-input" aria-disabled={menuUploading}
                className="w-16 h-16 rounded-md hairline grid place-items-center text-ink-3 cursor-pointer aria-disabled:opacity-50 aria-disabled:pointer-events-none [-webkit-tap-highlight-color:transparent]">
                {menuUploading ? <IconLoader2 size={18} className="animate-spin" /> : <IconPlus size={18} />}
              </label>
              <input id="place-menu-input" type="file" accept="image/*,application/pdf" multiple hidden onChange={onPickMenu} />
            </div>
          </div>
        )}

        <div><div className={lbl}>โน้ต</div>
          <textarea className="hairline rounded-md text-[13px] p-3 bg-surface w-full outline-none focus:border-brand resize-none" rows={2}
            value={note} onChange={(e) => setNote(e.target.value)} placeholder="รายละเอียด เช่น ควรจองล่วงหน้า" />
        </div>
        <div><div className={lbl}>ลิงก์แผนที่</div><input className={field} value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="https://maps.apple.com/?q=..." /></div>
        <button onClick={save} disabled={busy || !name.trim()} className="btn-primary w-full h-10 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        {initial && onDelete && (
          <button onClick={del} disabled={busy} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] text-[#D85A30]"><IconTrash size={15} /> ลบรายการ</button>
        )}
      </div>
    </Drawer>
  )
}
