import { useEffect, useMemo, useRef, useState } from 'react'
import {
  IconTrash, IconPhoto, IconLoader2, IconCheck, IconPlus, IconToolsKitchen2, IconFileTypePdf,
  IconX, IconCrop, IconWorld, IconRoute, IconNotes, IconUpload, IconLink,
} from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { SectionCard } from './SectionCard'
import { ColorPicker } from './ColorPicker'
import { Combobox } from './Combobox'
import { SignedImage } from './SignedImage'
import { PhotoCropper } from './PhotoCropper'
import { uploadImage } from '@/lib/files'
import { useTrip } from '@/contexts/TripContext'
import { getTransitSuggestions, findLine } from '@/lib/metro/suggest'
import { cityImage } from '@/lib/cityImages'
import { optimizeImageUrl } from '@/lib/cloudinary'
import { nameFromMapUrl, resolveMapName, isMapLink } from '@/lib/geo'
import { catMeta, CATEGORY, PLACE_CATEGORIES, FOOD_CATEGORIES, FOOD_GROUPS } from '@/lib/placeMeta'
import type { Place, PlaceGroup, ExploreRoute, PlaceBranch } from '@/lib/database.types'
import { buildBranchRemap } from '@/lib/placeMutations'
import type { BranchRemap, PlaceInput } from '@/lib/placeMutations'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'
const lbl = 'text-[11px] text-ink-3'

function emptyRoute(): ExploreRoute { return { line: '', color: '#185FA5', station: '' } }
function emptyBranch(): PlaceBranch { return { label: '', map_url: '', line: '', color: '#185FA5', station: '' } }
/** A stored menu file is a PDF when its path/URL ends in .pdf (ignoring query). */
function isPdfRef(ref: string): boolean { return /\.pdf($|\?)/i.test(ref) }
const isHttp = (ref: string) => /^https?:\/\//i.test(ref)

type CardKey = 'where' | 'info' | 'photos' | 'menu' | 'routes' | 'note'

export function PlaceEditor({
  open, onClose, group, tripId, initial, onSave, onDelete,
}: {
  open: boolean
  onClose: () => void
  group: PlaceGroup
  tripId: string
  initial: Place | null
  /** `remap` is set when branches were deleted/reordered — the caller must
   *  re-point the plan's stored branch positions (see remapBranchIndexes) */
  onSave: (fields: PlaceInput, remap?: BranchRemap) => Promise<void>
  /** owns its own confirmation (it knows how many itinerary stops go with the
   *  place, and offers the undo). Return false when the user backs out, so the
   *  editor stays open. */
  onDelete?: () => Promise<boolean | void>
}) {
  const { trip, places } = useTrip()
  const editing = !!initial
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
  const [openCard, setOpenCard] = useState<CardKey | null>('where')
  const [city, setCity] = useState('')
  const [name, setName] = useState('')
  const [autoFilled, setAutoFilled] = useState(false) // name came from the map link
  const [category, setCategory] = useState(cats[0]) // a known key, or 'other'
  const [customCat, setCustomCat] = useState('')
  const [routes, setRoutes] = useState<ExploreRoute[]>([emptyRoute()])
  const [branches, setBranches] = useState<PlaceBranch[]>([])
  // where each row sat in the SAVED branch list (null = added in this session).
  // Branch choices are stored as positions, so deleting a row has to renumber
  // them — see BranchRemap / remapBranchIndexes.
  const [branchFrom, setBranchFrom] = useState<(number | null)[]>([])
  const [multiBranch, setMultiBranch] = useState(false)
  const [mapUrl, setMapUrl] = useState('')
  const [note, setNote] = useState('')
  // photos: up to 4 (storage paths or http URLs); one is the cover
  const [allPhotos, setAllPhotos] = useState<string[]>([])
  const [coverIdx, setCoverIdx] = useState(0)
  const [photoFocus, setPhotoFocus] = useState<string | null>(null)
  const [cropping, setCropping] = useState(false)
  const [menuPaths, setMenuPaths] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [menuUploading, setMenuUploading] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setAutoFilled(false)
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
    setBranchFrom(initial?.branches?.map((_, i) => i) ?? [])
    setMultiBranch(!!initial?.multi_branch)
    setMapUrl(initial?.map_url ?? '')
    setNote(initial?.note ?? '')
    setAllPhotos([initial?.photo_path || initial?.photo_url, ...(initial?.photos ?? [])].filter(Boolean) as string[])
    setCoverIdx(0)
    setPhotoFocus(initial?.photo_focus ?? null)
    setCropping(false)
    setMenuPaths(initial?.menu_paths ?? [])
    setCity(initial?.city ?? (tripCities.length === 1 ? tripCities[0] : ''))
    setLinkState('idle')
    setOpenCard(initial ? null : 'where')
  }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps

  // paste a map link → auto-fill the name (still editable). Short links resolve
  // via /api/resolve-map; a hand-typed name is never overwritten.
  const [linkState, setLinkState] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle')
  const nameRef = useRef(name); nameRef.current = name
  const autoRef = useRef(autoFilled); autoRef.current = autoFilled
  useEffect(() => {
    if (!open) return
    let raw = mapUrl.trim()
    if (!raw) { setLinkState('idle'); return }
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
      if (got) { setName(got); setAutoFilled(true); setLinkState('ok') }
      else setLinkState('fail')
    }, 450)
    return () => { stop = true; clearTimeout(t) }
  }, [mapUrl, open])

  // multi-upload, up to 4 photos total (private bucket — stored as paths)
  async function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const files = Array.from(input.files ?? [])
    if (!files.length) return
    setUploading(true)
    const room = Math.max(0, 4 - allPhotos.length)
    for (const file of files.slice(0, room)) {
      const { path } = await uploadImage(tripId, 'place-photo', file)
      if (path) setAllPhotos((prev) => (prev.length >= 4 ? prev : [...prev, path]))
    }
    setUploading(false)
    input.value = ''
  }
  function removePhoto(i: number) {
    setAllPhotos((prev) => prev.filter((_, idx) => idx !== i))
    setCoverIdx((c) => (i === c ? 0 : i < c ? c - 1 : c))
    if (i === coverIdx) { setPhotoFocus(null); setCropping(false) }
  }
  function chooseCover(i: number) {
    if (i === coverIdx) return
    setCoverIdx(i)
    setPhotoFocus(null)
    setCropping(false)
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
    // keep track of where every surviving branch USED to sit, so the caller can
    // re-point the plan's branch choices (they're stored as positions)
    const keptFrom: (number | null)[] = []
    const cleanBranches = branches.filter((b, i) => {
      const keep = !!(b.label || b.map_url || b.line || b.station)
      if (keep) keptFrom.push(branchFrom[i] ?? null)
      return keep
    })
    const remap = buildBranchRemap(initial?.branches ?? [], keptFrom)
    const finalCategory = category === 'other' ? (customCat.trim() || 'other') : category
    const cover = allPhotos[coverIdx] ?? allPhotos[0] ?? null
    const others = allPhotos.filter((p) => p !== cover)
    await onSave({
      group_type: group, name: name.trim(), category: finalCategory,
      station_line: first?.line || null, station_color: first?.color || null, station_name: first?.station || null,
      routes: clean.length ? clean : null,
      branches: cleanBranches.length ? cleanBranches : null,
      multi_branch: multiBranch ? true : null,
      map_url: mapUrl, note,
      photo_path: cover && !isHttp(cover) ? cover : null,
      photo_url: cover && isHttp(cover) ? cover : null,
      photo_focus: cover ? photoFocus : null,
      photos: others.length ? others : null, city: city || null,
      menu_paths: group === 'food' && menuPaths.length ? menuPaths : null,
    }, remap)
    setBusy(false)
    onClose()
  }
  const meta = catMeta(category === 'other' ? (customCat.trim() || 'other') : category)
  async function del() {
    if (!onDelete) return
    setBusy(true)
    const ok = await onDelete()
    setBusy(false)
    if (ok !== false) onClose()
  }

  // ---- section states + summaries ----
  const infoDone = !!name.trim()
  const catLabel = category === 'other' ? (customCat.trim() || 'อื่นๆ') : (CATEGORY[category]?.label ?? category)
  const routeFilled = routes.filter((r) => r.line || r.station)
  const routesSum = routeFilled.length
    ? `${[routeFilled[0].line, routeFilled[0].station].filter(Boolean).join(' → ')}${routeFilled.length > 1 ? ` · +${routeFilled.length - 1} เส้นทาง` : ''}`
    : ''
  const cover = allPhotos[coverIdx] ?? allPhotos[0]
  const toggle = (k: CardKey) => setOpenCard((c) => (c === k ? null : k))
  const showBranch = group === 'food' || multiBranch || branches.length > 0

  const routeStationOpts = (line: string) => {
    const known = findLine(sug, line)
    return known ? known.stations.map((s) => ({ value: s.name, label: s.num })) : sug.stations.map((n) => ({ value: n }))
  }

  return (
    <Drawer open={open} onClose={onClose} title={initial ? 'แก้ไขรายการ' : (group === 'food' ? 'เพิ่มร้าน' : 'เพิ่มสถานที่')}>
      <div className="space-y-2">

        {/* เมือง — ชิปเมืองของทริป (มีรูป) + พิมพ์เองได้ */}
        <SectionCard open={openCard === 'where'} done={!!city.trim()} onToggle={() => toggle('where')}
          icon={<IconWorld size={15} />} title="อยู่เมืองไหน?" sub="แตะเมืองของทริปเพื่อเลือก" summary={city}>
          {tripCities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tripCities.map((c) => {
                const on = city === c
                const img = cityImage(c)
                return (
                  <button key={c} onClick={() => { setCity(on ? '' : c); if (!on && !editing) setOpenCard('info') }}
                    className={['flex items-center gap-1.5 p-1 pr-3 rounded-full transition-colors', on ? 'bg-brand' : 'bg-surface-2'].join(' ')}>
                    <span className="size-6 rounded-full overflow-hidden grid place-items-center shrink-0"
                      style={{ background: on ? 'rgba(255,255,255,0.25)' : 'var(--color-line)' }}>
                      {img
                        ? <img src={optimizeImageUrl(img, 64) ?? img} alt="" className="w-full h-full object-cover" />
                        : <IconWorld size={12} className={on ? 'text-white' : 'text-ink-3'} />}
                    </span>
                    <span className={['text-[11px] font-medium whitespace-nowrap', on ? 'text-white' : 'text-ink-2'].join(' ')}>{c}</span>
                  </button>
                )
              })}
            </div>
          )}
          <input className={field} value={city} onChange={(e) => setCity(e.target.value)} placeholder="พิมพ์ชื่อเมือง เช่น Beijing" />
        </SectionCard>

        {/* ลิงก์ (auto-fill ชื่อ) + ชื่อ + หมวด + หลายสาขา */}
        <SectionCard open={openCard === 'info'} done={infoDone} onToggle={() => toggle('info')}
          icon={<IconLink size={15} />} title={group === 'food' ? 'ลิงก์ & ชื่อร้าน' : 'ลิงก์ & ชื่อสถานที่'}
          sub="วางลิงก์แล้วเราเติมชื่อให้ — แก้ไขได้" summary={[name, catLabel].filter(Boolean).join(' · ')}>
          <div className="space-y-2.5">
            <div>
              <div className={lbl}>ลิงก์แผนที่ (Google Maps / AMap)</div>
              <input className={field} value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="https://maps..." inputMode="url" />
              {linkState === 'busy' && (
                <div className="flex items-center gap-1 mt-1 text-[10.5px] font-medium text-ink-3">
                  <IconLoader2 size={12} className="animate-spin" /> กำลังอ่านชื่อจากลิงก์…
                </div>
              )}
              {linkState === 'ok' && autoFilled && name.trim() && (
                <div className="flex items-center gap-1 mt-1 text-[10.5px] font-medium" style={{ color: '#16A34A' }}>
                  <IconCheck size={12} /> เติมชื่อจากลิงก์ให้แล้ว — แก้ไขได้
                </div>
              )}
              {linkState === 'fail' && (
                <div className="mt-1 text-[10.5px] text-ink-3">อ่านชื่อจากลิงก์นี้ไม่ได้ — พิมพ์ชื่อเองได้เลย</div>
              )}
            </div>
            <div>
              <div className={lbl}>{group === 'food' ? 'ชื่อร้าน *' : 'ชื่อสถานที่ *'}</div>
              <input className={field} value={name} onChange={(e) => { setName(e.target.value); setAutoFilled(false) }} placeholder="เช่น Forbidden City" />
            </div>
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
            {/* หลายสาขา ต่อท้าย (เฉพาะร้านอาหาร) */}
            {showBranch && (
              <div>
                <div className="flex items-center gap-2.5">
                  <button onClick={() => setMultiBranch((v) => !v)}
                    className={['chip !text-[13px] !px-3.5 !py-2', multiBranch ? '!bg-brand-soft !text-brand-dark' : ''].join(' ')}
                    style={multiBranch ? { border: '0.5px solid var(--color-brand-border)' } : undefined}>
                    {multiBranch && <IconCheck size={14} />} มีหลายสาขา
                  </button>
                  {multiBranch
                    ? <button onClick={() => { setBranches((bs) => [...bs, emptyBranch()]); setBranchFrom((o) => [...o, null]) }} className="btn-link flex items-center gap-1.5"><IconPlus size={15} /> เพิ่มสาขา</button>
                    : <span className="text-[10.5px] text-ink-3">กดถ้ามีหลายที่ — ใส่แค่ชื่อสาขาก็ได้</span>}
                </div>
                {multiBranch && branches.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {branches.map((b, i) => (
                      <div key={i} className="rounded-[10px] hairline p-2.5 space-y-2 bg-canvas">
                        <div className="flex items-center gap-2">
                          <input className={field} value={b.label ?? ''} onChange={(e) => patchBranch(i, { label: e.target.value })} placeholder="ชื่อสาขา เช่น สาขาสยาม" />
                          <button onClick={() => { setBranches((bs) => bs.filter((_, idx) => idx !== i)); setBranchFrom((o) => o.filter((_, idx) => idx !== i)) }} className="text-ink-3 hover:text-[#D85A30] shrink-0"><IconTrash size={15} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Combobox className={field} value={b.line ?? ''} placeholder="สาย เช่น Line 1"
                            options={sug.lines.map((l) => ({ value: l.name, color: l.color }))}
                            onChange={(v) => { const k = findLine(sug, v); patchBranch(i, { line: v, ...(k ? { color: k.color } : {}) }) }} />
                          <Combobox className={field} value={b.station ?? ''} placeholder="สถานี"
                            options={routeStationOpts(b.line ?? '')} onChange={(v) => patchBranch(i, { station: v })} />
                        </div>
                        <ColorPicker value={b.color ?? '#185FA5'} onChange={(c) => patchBranch(i, { color: c })} />
                        <input className={field} value={b.map_url ?? ''} onChange={(e) => patchBranch(i, { map_url: e.target.value })} placeholder="ลิงก์แผนที่ของสาขานี้ https://maps..." />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </SectionCard>

        {/* รูปภาพ: dropzone + อัปทีเดียว 4 รูป + ติ๊กเลือกปก + ครอปปก */}
        <SectionCard open={openCard === 'photos'} done={allPhotos.length > 0} onToggle={() => toggle('photos')}
          icon={<IconPhoto size={15} />} title="รูปภาพ" sub="สูงสุด 4 รูป — เลือกพร้อมกันได้เลย"
          summary={`${allPhotos.length} รูป${allPhotos.length > 1 ? ' · เลือกปกแล้ว' : ''}`}>
          {cropping && cover ? (
            <div className="space-y-2">
              <div className={lbl}>ลากเพื่อจัดตำแหน่ง / เลื่อนเพื่อซูม</div>
              <PhotoCropper url={isHttp(cover) ? cover : null} path={isHttp(cover) ? null : cover} focus={photoFocus} onChange={setPhotoFocus}
                fallback={<div className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><meta.icon size={28} style={{ color: meta.fg, opacity: 0.85 }} /></div>} />
              <button onClick={() => setCropping(false)} className="btn-icon !w-auto px-3 gap-1.5 text-[12px]"><IconCheck size={14} /> เสร็จ</button>
            </div>
          ) : (
            <div className="space-y-2">
              {allPhotos.length < 4 && (
                <label htmlFor="place-photo-input" aria-disabled={uploading}
                  className="block rounded-[12px] text-center py-5 px-3 cursor-pointer aria-disabled:opacity-50 aria-disabled:pointer-events-none [-webkit-tap-highlight-color:transparent]"
                  style={{ border: '1.5px dashed var(--color-line-2)', background: 'var(--color-canvas)' }}>
                  <span className="mx-auto mb-2 size-11 rounded-full bg-surface-2 grid place-items-center text-ink-2">
                    {uploading ? <IconLoader2 size={19} className="animate-spin" /> : <IconUpload size={19} />}
                  </span>
                  <span className="block text-[13px] font-semibold text-ink">ลากรูปมาวาง หรือแตะเพื่อเลือก</span>
                  <span className="block text-[11px] text-ink-3 mt-0.5">PNG · JPG — อัปได้ทีเดียวสูงสุด 4 รูป</span>
                  <span className="inline-block mt-2 text-[12px] font-semibold underline" style={{ color: 'var(--color-brand-mid)' }}>เลือกรูปจากเครื่อง</span>
                </label>
              )}
              <input id="place-photo-input" type="file" accept="image/*" multiple hidden onChange={onPickPhotos} />
              {allPhotos.length > 0 && (
                <>
                  <div className="grid grid-cols-4 gap-1.5">
                    {allPhotos.map((ref, i) => {
                      const isCover = i === coverIdx
                      return (
                        <div key={`${ref}-${i}`} className="relative aspect-square rounded-[9px] overflow-hidden bg-surface-2 hairline">
                          <SignedImage url={isHttp(ref) ? ref : undefined} path={isHttp(ref) ? undefined : ref}
                            className="w-full h-full object-cover" width={300}
                            fallback={<div className="w-full h-full grid place-items-center text-ink-3"><IconPhoto size={18} /></div>} />
                          <button onClick={() => removePhoto(i)} aria-label="ลบรูป"
                            className="absolute top-1 left-1 size-5 rounded-full bg-black/50 text-white grid place-items-center">
                            <IconX size={11} />
                          </button>
                          <button onClick={() => chooseCover(i)} aria-label="เลือกเป็นรูปปก"
                            className="absolute top-1 right-1 size-5 rounded-full grid place-items-center"
                            style={isCover
                              ? { background: 'var(--color-brand)', color: '#fff', border: '1.5px solid #fff' }
                              : { background: 'rgba(0,0,0,0.3)', border: '1.5px solid #fff' }}>
                            {isCover && <IconCheck size={11} />}
                          </button>
                          {isCover && (
                            <span className="absolute bottom-1 left-1 text-[8.5px] font-bold text-white px-1.5 py-px rounded-[5px]"
                              style={{ background: 'var(--color-brand)' }}>ปก</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] text-ink-3">แตะวงกลมบนรูปเพื่อเลือกเป็น “รูปปก”</span>
                    <button onClick={() => setCropping(true)} className="btn-link text-[11px] flex items-center gap-1"><IconCrop size={12} /> ครอปรูปปก</button>
                  </div>
                </>
              )}
            </div>
          )}
        </SectionCard>

        {/* รูปเมนู (เฉพาะร้านอาหาร) */}
        {group === 'food' && (
          <SectionCard open={openCard === 'menu'} done={menuPaths.length > 0} onToggle={() => toggle('menu')}
            icon={<IconToolsKitchen2 size={15} />} title="รูปเมนู" sub="รูปหรือไฟล์ PDF ก็ได้ — เลือกได้หลายไฟล์"
            summary={`แนบไว้ ${menuPaths.length} ไฟล์`}>
            <div className="space-y-2">
              <label htmlFor="place-menu-input" aria-disabled={menuUploading}
                className="block rounded-[12px] text-center py-4 px-3 cursor-pointer aria-disabled:opacity-50 aria-disabled:pointer-events-none [-webkit-tap-highlight-color:transparent]"
                style={{ border: '1.5px dashed var(--color-line-2)', background: 'var(--color-canvas)' }}>
                <span className="mx-auto mb-1.5 size-9 rounded-full bg-surface-2 grid place-items-center text-ink-2">
                  {menuUploading ? <IconLoader2 size={16} className="animate-spin" /> : <IconUpload size={16} />}
                </span>
                <span className="block text-[12.5px] font-semibold text-ink">แนบรูปเมนู / ไฟล์ PDF</span>
                <span className="block text-[10.5px] text-ink-3 mt-0.5">เลือกได้หลายไฟล์พร้อมกัน</span>
              </label>
              <input id="place-menu-input" type="file" accept="image/*,application/pdf" multiple hidden onChange={onPickMenu} />
              {menuPaths.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {menuPaths.map((ref, i) => (
                    <div key={ref} className="relative w-16 h-16 rounded-md overflow-hidden bg-surface-2 hairline">
                      {isPdfRef(ref)
                        ? <div className="w-full h-full grid place-items-center text-ink-3"><IconFileTypePdf size={22} /></div>
                        : <SignedImage url={isHttp(ref) ? ref : undefined} path={isHttp(ref) ? undefined : ref}
                            className="w-full h-full object-cover" width={160}
                            fallback={<div className="w-full h-full grid place-items-center text-ink-3"><IconPhoto size={18} /></div>} />}
                      <button onClick={() => setMenuPaths((m) => m.filter((_, idx) => idx !== i))}
                        aria-label="ลบไฟล์เมนู" className="absolute top-0.5 right-0.5 size-5 rounded-full bg-black/55 text-white grid place-items-center">
                        <IconX size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* การเดินทาง + ปุ่มเพิ่มเส้นทางชัดๆ */}
        <SectionCard open={openCard === 'routes'} done={routeFilled.length > 0} onToggle={() => toggle('routes')}
          icon={<IconRoute size={15} />} title="การเดินทาง" sub="เพิ่มได้หลายเส้นทาง" summary={routesSum}>
          <div className="space-y-2">
            {routes.map((r, i) => (
              <div key={i} className="rounded-[10px] hairline p-2.5 space-y-2 bg-canvas">
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
                    options={routeStationOpts(r.line ?? '')} onChange={(v) => patchRoute(i, { station: v })} />
                </div>
                <ColorPicker value={r.color ?? '#185FA5'} onChange={(c) => patchRoute(i, { color: c })} />
              </div>
            ))}
            <button onClick={() => setRoutes((rs) => [...rs, emptyRoute()])}
              className="w-full h-10 rounded-[10px] text-[12.5px] font-semibold flex items-center justify-center gap-1.5"
              style={{ border: '1.5px dashed var(--color-brand-border)', background: 'var(--color-brand-soft)', color: 'var(--color-brand-mid)' }}>
              <IconPlus size={15} /> เพิ่มเส้นทางที่ {routes.length + 1}
            </button>
          </div>
        </SectionCard>

        {/* โน้ต */}
        <SectionCard open={openCard === 'note'} done={!!note.trim()} onToggle={() => toggle('note')}
          icon={<IconNotes size={15} />} title="โน้ต" sub="รายละเอียด เช่น ควรจองล่วงหน้า" summary={note.trim()}>
          <textarea className="hairline rounded-md text-[13px] p-3 bg-surface w-full outline-none focus:border-brand resize-none" rows={2}
            value={note} onChange={(e) => setNote(e.target.value)} placeholder="รายละเอียด เช่น ควรจองล่วงหน้า" />
        </SectionCard>

        {!name.trim() && (
          <p className="text-[11px] text-center pt-1" style={{ color: '#D85A30' }}>ยังขาด: {group === 'food' ? 'ชื่อร้าน' : 'ชื่อสถานที่'}</p>
        )}
        <button onClick={save} disabled={busy || !name.trim()} className="btn-primary w-full h-11 disabled:opacity-50 !mt-3">
          {busy ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
        {initial && onDelete && (
          <button onClick={del} disabled={busy} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] text-[#D85A30]"><IconTrash size={15} /> ลบรายการ</button>
        )}
      </div>
    </Drawer>
  )
}
