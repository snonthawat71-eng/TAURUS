import { useEffect, useMemo, useRef, useState } from 'react'
import {
  IconPhoto, IconLoader2, IconPlus, IconTrash, IconCheck, IconToolsKitchen2, IconFileTypePdf,
  IconX, IconCrop, IconAlertTriangle, IconWorld, IconMapPin, IconRoute, IconNotes,
  IconUpload, IconLink,
} from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { SectionCard } from './SectionCard'
import { PhotoCropper } from './PhotoCropper'
import { ColorPicker } from './ColorPicker'
import { Combobox, type ComboOption } from './Combobox'
import { ModePicker } from './ModePicker'
import { suggestionsFromText, findLine } from '@/lib/metro/suggest'
import { modeMeta } from '@/lib/transitModes'
import { uploadPublicImage } from '@/lib/files'
import { hscroll } from '@/lib/hscroll'
import { cityImage } from '@/lib/cityImages'
import { canonicalCountry } from '@/lib/countries'
import { canonicalCity, citySuggestions } from '@/lib/cities'
import { optimizeImageUrl } from '@/lib/cloudinary'
import { nameFromMapUrl, resolveMapName, isMapLink } from '@/lib/geo'
import { CATEGORY, PLACE_CATEGORIES, FOOD_CATEGORIES, FOOD_GROUPS } from '@/lib/placeMeta'
import { searchExploreSimilar, findChainPhotos, type ExploreDupe } from '@/lib/exploreMutations'
import { confirmDialog } from '@/lib/confirm'
import type { ExploreInput } from '@/lib/exploreMutations'
import { buildBranchRemap } from '@/lib/placeMutations'
import type { BranchRemap } from '@/lib/placeMutations'
import type { PlaceGroup, ExplorePlace, ExploreRoute, PlaceBranch } from '@/lib/database.types'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'
const lbl = 'text-[11px] text-ink-3'

function emptyRoute(): ExploreRoute { return { line: '', color: '#0270FB', station: '', mode: 'metro' } }
function emptyBranch(): PlaceBranch { return { label: '', map_url: '', line: '', color: '#185FA5', station: '' } }
const isPdfRef = (ref: string) => /\.pdf($|\?)/i.test(ref)

type CardKey = 'where' | 'type' | 'info' | 'photos' | 'menu' | 'routes' | 'note'

export function ExploreEditor({ open, onClose, initial, existing, onSave }: {
  open: boolean
  onClose: () => void
  initial?: ExplorePlace | null
  existing?: ExplorePlace[]
  /** `remap` is set when branches were deleted/reordered — the caller must
   *  re-point the branch choices stored on the saved copies (see
   *  remapExploreCopyBranches) */
  onSave: (input: ExploreInput, remap?: BranchRemap) => Promise<void>
}) {
  const editing = !!initial
  const [openCard, setOpenCard] = useState<CardKey | null>('where')
  const [group, setGroup] = useState<PlaceGroup>('place')
  const [typeChosen, setTypeChosen] = useState(false)
  const cats = group === 'food' ? FOOD_CATEGORIES : PLACE_CATEGORIES
  const [name, setName] = useState('')
  const [autoFilled, setAutoFilled] = useState(false) // name came from the map link
  const [category, setCategory] = useState(cats[0])
  const [customCat, setCustomCat] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [routes, setRoutes] = useState<ExploreRoute[]>([emptyRoute()])
  const [branches, setBranches] = useState<PlaceBranch[]>([])
  // name of the item's OWN location once it's one of several branches
  const [branchLabel, setBranchLabel] = useState('')
  // where each row sat in the SAVED branch list (null = added in this session).
  // Branch choices are stored as positions, so deleting a row has to renumber
  // them — see BranchRemap / remapExploreCopyBranches.
  const [branchFrom, setBranchFrom] = useState<(number | null)[]>([])
  const [multiBranch, setMultiBranch] = useState(false)
  const [mapUrl, setMapUrl] = useState('')
  // photos: up to 4, one of them is the cover (photo_url); the rest go to photos[]
  const [allPhotos, setAllPhotos] = useState<string[]>([])
  const [coverIdx, setCoverIdx] = useState(0)
  const [photoFocus, setPhotoFocus] = useState<string | null>(null)
  const [cropping, setCropping] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')
  const [menuPaths, setMenuPaths] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [menuUploading, setMenuUploading] = useState(false)
  const [busy, setBusy] = useState(false)

  // กันกรอกซ้ำชั้นที่ 1: live-warn while typing the name
  const [dupes, setDupes] = useState<ExploreDupe[]>([])
  useEffect(() => {
    if (!open || name.trim().length < 3) { setDupes([]); return }
    const t = setTimeout(async () => setDupes(await searchExploreSimilar(name, initial?.id, country)), 350)
    return () => clearTimeout(t)
  }, [name, open, initial?.id, country])

  // รูปที่สาขาอื่นของร้านชื่อเดียวกันมีอยู่แล้ว — ไม่ผูกกับประเทศ ต่างจากคำเตือน
  // ซ้ำ เพราะเชนหนึ่งย่อมมีสาขาข้ามประเทศอยู่แล้ว
  const [chainPool, setChainPool] = useState<{ url: string; from: string }[]>([])
  useEffect(() => {
    if (!open || name.trim().length < 3) { setChainPool([]); return }
    const t = setTimeout(async () => setChainPool(await findChainPhotos(name, initial?.id)), 350)
    return () => clearTimeout(t)
  }, [name, open, initial?.id])
  const chainPhotos = useMemo(() => chainPool.filter((c) => !allPhotos.includes(c.url)), [chainPool, allPhotos])

  // previously-used city/country pairs — for the quick city chips + comboboxes.
  const sugg = useMemo(() => {
    const placeKeys = new Map<string, { city: string; country: string }>()
    for (const e of existing ?? []) {
      if (e.city || e.country) placeKeys.set(`${e.city ?? ''}|${e.country ?? ''}`, { city: e.city ?? '', country: e.country ?? '' })
    }
    return { cityChips: [...placeKeys.values()].filter((p) => p.city || p.country) }
  }, [existing])

  // built-in metro data for the selected country/city
  const metroSug = useMemo(() => suggestionsFromText(`${country} ${city}`), [country, city])
  const lineColorAll = useMemo(() => {
    const m: Record<string, string> = {}
    for (const l of metroSug.lines) m[l.name] = l.color
    return m
  }, [metroSug])
  const lineOptions = useMemo<ComboOption[]>(() => {
    const seen = new Set<string>(); const out: ComboOption[] = []
    for (const l of metroSug.lines) {
      const k = l.name.trim().toLowerCase()
      if (l.name.trim() && !seen.has(k)) { seen.add(k); out.push({ value: l.name, color: l.color }) }
    }
    return out
  }, [metroSug])
  const allStationOptions = useMemo<ComboOption[]>(() => {
    const seen = new Set<string>(); const out: ComboOption[] = []
    for (const l of metroSug.lines) for (const s of l.stations) {
      const k = s.name.trim().toLowerCase()
      if (s.name.trim() && !seen.has(k)) { seen.add(k); out.push({ value: s.name, label: s.num }) }
    }
    return out
  }, [metroSug])

  useEffect(() => {
    if (!open) return
    const g = (initial?.group_type as PlaceGroup) || 'place'
    setGroup(g)
    setTypeChosen(!!initial)
    setName(initial?.name ?? '')
    setAutoFilled(false)
    const catsForG = g === 'food' ? FOOD_CATEGORIES : PLACE_CATEGORIES
    const initCat = initial?.category ?? ''
    const known = catsForG.includes(initCat)
    setCategory(known ? initCat : (initCat ? 'other' : catsForG[0]))
    setCustomCat(!known && initCat && initCat !== 'other' ? initCat : '')
    setCity(initial?.city ?? '')
    setCountry(initial?.country ?? '')
    const r = initial?.routes?.length
      ? initial.routes.map((x) => ({ line: x.line ?? '', color: x.color ?? '#185FA5', station: x.station ?? '', mode: x.mode ?? 'metro' }))
      : [{ line: initial?.station_line ?? '', color: initial?.station_color ?? '#185FA5', station: initial?.station_name ?? '', mode: 'metro' }]
    setRoutes(r)
    setBranches(initial?.branches?.length
      ? initial.branches.map((b) => ({ label: b.label ?? '', map_url: b.map_url ?? '', line: b.line ?? '', color: b.color ?? '#185FA5', station: b.station ?? '' }))
      : [])
    setBranchFrom(initial?.branches?.map((_, i) => i) ?? [])
    setMultiBranch(!!initial?.multi_branch)
    setBranchLabel(initial?.branch_label ?? '')
    setMapUrl(initial?.map_url ?? '')
    setAllPhotos([initial?.photo_url, ...(initial?.photos ?? [])].filter(Boolean) as string[])
    setCoverIdx(0)
    setPhotoFocus(initial?.photo_focus ?? null)
    setCropping(false)
    setUrlDraft('')
    setMenuPaths(initial?.menu_paths ?? [])
    setNote(initial?.note ?? '')
    setLinkState('idle')
    setOpenCard(initial ? null : 'where')
  }, [open, initial])

  // ข้อ 3: paste a map link → auto-fill the name (still editable). Short links go
  // through /api/resolve-map; manual edits to the name stop future overwrites.
  // linkState makes the outcome visible instead of failing silently.
  const [linkState, setLinkState] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle')
  const nameRef = useRef(name); nameRef.current = name
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
      // only auto-fill when the name is empty or still ours — a hand-typed name
      // never gets overwritten, so don't even resolve (no pointless requests)
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

  function changeGroup(g: PlaceGroup) {
    if (g === group) return
    setGroup(g)
    setCategory((g === 'food' ? FOOD_CATEGORIES : PLACE_CATEGORIES)[0])
    setCustomCat('')
  }
  function patchRoute(i: number, p: Partial<ExploreRoute>) {
    setRoutes((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)))
  }
  function patchRouteMode(i: number, mode: string) {
    setRoutes((rs) => rs.map((r, idx) => {
      if (idx !== i) return r
      const color = (!r.color || r.color === modeMeta(r.mode).color) ? modeMeta(mode).color : r.color
      return { ...r, mode, color }
    }))
  }
  function patchBranch(i: number, p: Partial<PlaceBranch>) {
    setBranches((bs) => bs.map((b, idx) => (idx === i ? { ...b, ...p } : b)))
  }

  // ข้อ 7: multi-upload, up to 4 photos total
  async function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const files = Array.from(input.files ?? [])
    if (!files.length) return
    setUploading(true)
    const room = Math.max(0, 4 - allPhotos.length)
    for (const file of files.slice(0, room)) {
      const { url } = await uploadPublicImage(file)
      if (url) setAllPhotos((prev) => (prev.length >= 4 ? prev : [...prev, url]))
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
  function addUrlPhoto() {
    const u = urlDraft.trim()
    if (!u) return
    setAllPhotos((prev) => (prev.length >= 4 ? prev : [...prev, u]))
    setUrlDraft('')
  }

  const usePhoto = (url: string) => setAllPhotos((prev) => (prev.length >= 4 || prev.includes(url) ? prev : [...prev, url]))
  const useAllChainPhotos = () => setAllPhotos((prev) => [...prev, ...chainPhotos.map((c) => c.url)].slice(0, 4))

  async function onPickMenu(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const files = Array.from(input.files ?? [])
    if (!files.length) return
    setMenuUploading(true)
    for (const file of files) {
      const { url } = await uploadPublicImage(file)
      if (url) setMenuPaths((m) => [...m, url])
    }
    setMenuUploading(false)
    input.value = ''
  }

  async function save() {
    setBusy(true)
    // กันกรอกซ้ำชั้นที่ 2: fresh fuzzy check right before writing
    const conflicts = await searchExploreSimilar(name, initial?.id, country)
    if (conflicts.length > 0) {
      const first = conflicts[0]
      const where = [first.city, first.country].filter(Boolean).join(', ')
      const ok = await confirmDialog({
        message: conflicts.length === 1
          ? `มี "${first.name}"${where ? ` (${where})` : ''} อยู่ใน Explore แล้ว — ยืนยันเพิ่มเป็นรายการใหม่อีกอัน?`
          : `มีรายการคล้ายกันใน Explore แล้ว ${conflicts.length} รายการ เช่น "${first.name}"${where ? ` (${where})` : ''} — ยืนยันเพิ่มเป็นรายการใหม่อีกอัน?`,
        confirmLabel: 'เพิ่มต่อ',
      })
      if (!ok) { setBusy(false); return }
    }
    const clean = routes.filter((r) => r.line || r.station)
    const first = clean[0]
    // keep track of where every surviving branch USED to sit, so the caller can
    // re-point the branch choices on copies already saved into trips
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
      group_type: group, name, category: finalCategory, city: canonicalCity(city) || null, country: country || null,
      station_line: first?.line || null, station_color: first?.color || null, station_name: first?.station || null,
      routes: clean.length ? clean : null,
      branches: cleanBranches.length ? cleanBranches : null,
      multi_branch: multiBranch ? true : null,
      branch_label: multiBranch && branchLabel.trim() ? branchLabel.trim() : null,
      menu_paths: group === 'food' && menuPaths.length ? menuPaths : null,
      map_url: mapUrl || null, photo_url: cover, photo_focus: cover ? photoFocus : null, photos: others.length ? others : null, note: note || null,
    }, remap)
    setBusy(false)
    onClose()
  }

  // ---- section states + summaries ----
  const whereDone = !!(city.trim() && country.trim())
  const infoDone = !!name.trim()
  const catLabel = category === 'other' ? (customCat.trim() || 'อื่นๆ') : (CATEGORY[category]?.label ?? category)
  const routeFilled = routes.filter((r) => r.line || r.station)
  const routesSum = routeFilled.length
    ? `${modeMeta(routeFilled[0].mode).short} ${[routeFilled[0].line, routeFilled[0].station].filter(Boolean).join(' → ')}${routeFilled.length > 1 ? ` · +${routeFilled.length - 1} เส้นทาง` : ''}`
    : ''
  const cover = allPhotos[coverIdx] ?? allPhotos[0]
  const toggle = (k: CardKey) => setOpenCard((c) => (c === k ? null : k))

  const missing = [
    !city.trim() && 'เมือง', !country.trim() && 'ประเทศ',
    !typeChosen && !editing && 'ประเภท', !name.trim() && 'ชื่อ',
  ].filter(Boolean) as string[]

  const showBranch = group === 'food' || multiBranch || branches.length > 0

  return (
    <Drawer open={open} onClose={onClose} title={editing ? 'แก้ไขสถานที่' : 'เพิ่มลง Explore'}>
      <div className="space-y-2">

        {/* ข้อ 1 — เมือง/ประเทศ ก่อน พร้อมชิปเมืองมีรูป */}
        <SectionCard open={openCard === 'where'} done={whereDone} onToggle={() => toggle('where')}
          icon={<IconWorld size={15} />} title="เมืองไหน ประเทศอะไร?" sub="แตะเมืองที่เคยใช้เพื่อเติมอัตโนมัติ"
          summary={[city, country].filter(Boolean).join(', ')}>
          {sugg.cityChips.length > 0 && (
            <div ref={hscroll} className="flex gap-1.5 mb-2 overflow-x-auto no-scrollbar">
              {sugg.cityChips.map((p, i) => {
                const sel = p.city === city && p.country === country
                const img = cityImage(p.city)
                return (
                  <button key={i} onClick={() => { setCity(p.city); setCountry(p.country); if (!typeChosen) setOpenCard('type') }}
                    className={['shrink-0 flex items-center gap-1.5 p-1 pr-3 rounded-full transition-colors', sel ? 'bg-brand' : 'bg-surface-2'].join(' ')}>
                    <span className="size-6 rounded-full overflow-hidden grid place-items-center shrink-0"
                      style={{ background: sel ? 'rgba(255,255,255,0.25)' : 'var(--color-line)' }}>
                      {img
                        ? <img src={optimizeImageUrl(img, 64) ?? img} alt="" className="w-full h-full object-cover" />
                        : <IconMapPin size={12} className={sel ? 'text-white' : 'text-ink-3'} />}
                    </span>
                    <span className={['text-[11px] font-medium whitespace-nowrap', sel ? 'text-white' : 'text-ink-2'].join(' ')}>
                      {[p.city, p.country].filter(Boolean).join(', ')}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><div className={lbl}>เมือง *</div>
              <Combobox className={field} value={city} onChange={setCity} placeholder="Osaka"
                options={[...new Set([
                  ...citySuggestions(canonicalCountry(country)),
                  ...sugg.cityChips.map((p) => p.city).filter(Boolean),
                ].map(canonicalCity))].map((c) => ({ value: c }))} />
            </div>
            <div><div className={lbl}>ประเทศ *</div>
              <Combobox className={field} value={country} onChange={setCountry} placeholder="Japan"
                options={[...new Set(sugg.cityChips.map((p) => p.country).filter(Boolean))].map((c) => ({ value: c }))} />
            </div>
          </div>
        </SectionCard>

        {/* ข้อ 2 — สถานที่ หรือ ร้านอาหาร */}
        <SectionCard open={openCard === 'type'} done={typeChosen} onToggle={() => toggle('type')}
          icon={<IconMapPin size={15} />} title="สถานที่ หรือ ร้านอาหาร?"
          summary={(group === 'food' ? 'ร้านอาหาร / คาเฟ่' : 'สถานที่') + (multiBranch ? ' · มีหลายสาขา' : '')}>
          <div className="grid grid-cols-2 gap-2">
            {([['place', 'สถานที่', IconMapPin], ['food', 'ร้านอาหาร / คาเฟ่', IconToolsKitchen2]] as const).map(([g, label, Icon]) => {
              const on = group === g
              return (
                <button key={g} onClick={() => { changeGroup(g); setTypeChosen(true); setOpenCard('info') }}
                  className="rounded-[11px] py-3 flex flex-col items-center gap-1 transition-colors"
                  style={on
                    ? { border: '1.5px solid var(--color-brand)', background: 'var(--color-brand-soft)' }
                    : { border: '0.5px solid var(--color-line)', background: 'var(--color-surface)' }}>
                  <Icon size={20} className={on ? 'text-brand' : 'text-ink-3'} />
                  <span className={['text-[12px] font-semibold', on ? 'text-brand-dark' : 'text-ink-2'].join(' ')}>{label}</span>
                </button>
              )
            })}
          </div>
        </SectionCard>

        {/* ข้อ 3–6 — ลิงก์ (auto-fill ชื่อ) + ชื่อ + หมวด + หลายสาขา */}
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
              <input className={field} value={name} onChange={(e) => { setName(e.target.value); setAutoFilled(false) }} placeholder="เช่น Farmily" />
              {dupes.length > 0 && (
                <div className="rounded-md px-2.5 py-2 mt-1.5 text-[12px]"
                  style={{ background: 'rgba(217,119,6,0.08)', border: '0.5px solid rgba(217,119,6,0.35)' }}>
                  <div className="flex items-center gap-1 font-medium" style={{ color: '#B45309' }}>
                    <IconAlertTriangle size={13} /> มีใน Explore แล้ว — เช็คก่อนเพิ่มซ้ำ
                  </div>
                  <ul className="mt-1 space-y-0.5 text-ink-2">
                    {dupes.map((d) => (
                      <li key={d.id} className="truncate">• {d.name}{[d.city, d.country].filter(Boolean).length ? ` — ${[d.city, d.country].filter(Boolean).join(', ')}` : ''}</li>
                    ))}
                  </ul>
                  <div className="text-[11px] text-ink-3 mt-1">ถ้าใช่ที่เดียวกัน ลองค้นหาในหน้า Explore แล้วกด ⭐ เซฟของเดิมแทน</div>
                </div>
              )}
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
            {/* ข้อ 6 — หลายสาขา ต่อท้าย (เฉพาะร้านอาหาร) */}
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
                {/* the location typed into this form IS one of the branches, so
                    it needs a name too — otherwise the picker offers a
                    meaningless "ที่ตั้งหลัก" next to real branch names */}
                {multiBranch && (
                  <div className="mt-2.5">
                    <div className={lbl}>ชื่อสาขาของที่ตั้งด้านบน</div>
                    <input className={field} value={branchLabel} onChange={(e) => setBranchLabel(e.target.value)}
                      placeholder="เช่น สาขาสยาม (ที่ตั้ง/ลิงก์แผนที่ที่กรอกไว้ข้างบน)" />
                  </div>
                )}
                {multiBranch && branches.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {branches.map((b, i) => {
                      const known = findLine(metroSug, b.line ?? '')
                      const stationOptions = known ? known.stations.map((s) => ({ value: s.name, label: s.num })) : allStationOptions
                      return (
                        <div key={i} className="rounded-[10px] hairline p-2.5 space-y-2 bg-canvas">
                          <div className="flex items-center gap-2">
                            <input className={field} value={b.label ?? ''} onChange={(e) => patchBranch(i, { label: e.target.value })} placeholder="ชื่อสาขา เช่น สาขาสยาม" />
                            <button onClick={() => { setBranches((bs) => bs.filter((_, idx) => idx !== i)); setBranchFrom((o) => o.filter((_, idx) => idx !== i)) }} className="text-ink-3 hover:text-[#D85A30] shrink-0"><IconTrash size={15} /></button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Combobox className={field} value={b.line ?? ''} placeholder="สาย เช่น Midosuji"
                              options={lineOptions}
                              onChange={(v) => patchBranch(i, { line: v, ...(lineColorAll[v] ? { color: lineColorAll[v] } : {}) })} />
                            <Combobox className={field} value={b.station ?? ''} placeholder="สถานี เช่น Namba"
                              options={stationOptions} onChange={(v) => patchBranch(i, { station: v })} />
                          </div>
                          <ColorPicker value={b.color ?? '#185FA5'} onChange={(c) => patchBranch(i, { color: c })} />
                          <input className={field} value={b.map_url ?? ''} onChange={(e) => patchBranch(i, { map_url: e.target.value })} placeholder="ลิงก์แผนที่ของสาขานี้ https://maps..." />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </SectionCard>

        {/* ข้อ 7 — รูปภาพ: dropzone + อัปทีเดียว 4 รูป + ติ๊กเลือกปก */}
        <SectionCard open={openCard === 'photos'} done={allPhotos.length > 0} onToggle={() => toggle('photos')}
          icon={<IconPhoto size={15} />} title="รูปภาพ" sub="สูงสุด 4 รูป — เลือกพร้อมกันได้เลย"
          summary={allPhotos.length === 0 && chainPhotos.length > 0
            ? 'มีรูปเดิมของร้านนี้ให้ใช้'
            : `${allPhotos.length} รูป${allPhotos.length > 1 ? ' · เลือกปกแล้ว' : ''}`}>
          {cropping && cover ? (
            <div className="space-y-2">
              <div className={lbl}>ลากเพื่อจัดตำแหน่ง / เลื่อนเพื่อซูม</div>
              {/* 4:5 — the exact frame the Explore card shows, so what you line
                  up here is what the card gets */}
              <PhotoCropper url={cover} focus={photoFocus} onChange={setPhotoFocus} aspect="4 / 5" maxWidth={240}
                fallback={<div className="w-full h-full grid place-items-center bg-surface-2"><IconPhoto size={22} className="text-ink-3" /></div>} />
              <button onClick={() => setCropping(false)} className="btn-icon !w-auto px-3 gap-1.5 text-[12px]"><IconCheck size={14} /> เสร็จ</button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* สาขาใหม่ของร้านเดิม (ICHIRAN, HEYTEA …) — เสนอรูปที่สาขาก่อนหน้า
                  มีอยู่แล้ว จะได้ไม่ต้องหารูปใหม่ทุกครั้ง */}
              {allPhotos.length < 4 && chainPhotos.length > 0 && (
                <div className="rounded-[12px] p-2.5" style={{ background: 'var(--color-brand-soft)', border: '0.5px solid var(--color-brand-border)' }}>
                  <div className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-brand-dark)' }}>
                    <IconPhoto size={13} /> ใช้รูปเดิมของร้านนี้มั้ย?
                  </div>
                  <div className="text-[11px] text-ink-3 mt-0.5">
                    “{chainPhotos[0].from}” มีรูปอยู่แล้ว — แตะรูปเพื่อใช้เลย
                  </div>
                  <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar">
                    {chainPhotos.map((c) => (
                      <button key={c.url} onClick={() => usePhoto(c.url)} title={`ใช้รูปจาก ${c.from}`}
                        className="relative size-16 rounded-[9px] overflow-hidden shrink-0 hairline bg-surface-2">
                        <img src={optimizeImageUrl(c.url, 200) ?? c.url} alt="" className="w-full h-full object-cover" />
                        <span className="absolute inset-x-0 bottom-0 text-[8.5px] font-bold text-white py-px" style={{ background: 'rgba(0,0,0,.45)' }}>ใช้รูปนี้</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={useAllChainPhotos} className="btn-link text-[11px] mt-1.5">ใช้ทั้งหมด</button>
                </div>
              )}
              {allPhotos.length < 4 && (
                <label htmlFor="exp-photo-input" aria-disabled={uploading}
                  className="block rounded-[12px] text-center py-5 px-3 cursor-pointer aria-disabled:opacity-50 aria-disabled:pointer-events-none [-webkit-tap-highlight-color:transparent]"
                  style={{ border: '1.5px dashed var(--color-line-2)', background: 'var(--color-canvas)' }}>
                  <span className="mx-auto mb-2 size-11 rounded-full bg-surface-2 grid place-items-center text-ink-2">
                    {uploading ? <IconLoader2 size={19} className="animate-spin" /> : <IconUpload size={19} />}
                  </span>
                  <span className="block text-[13px] font-semibold text-ink">ลากรูปมาวาง หรือแตะเพื่อเลือก</span>
                  <span className="block text-[11px] text-ink-3 mt-0.5">PNG · JPG · WebP — อัปได้ทีเดียวสูงสุด 4 รูป</span>
                  <span className="inline-block mt-2 text-[12px] font-semibold underline" style={{ color: 'var(--color-brand-mid)' }}>เลือกรูปจากเครื่อง</span>
                </label>
              )}
              <input id="exp-photo-input" type="file" accept="image/*" multiple hidden onChange={onPickPhotos} />
              {allPhotos.length > 0 && (
                <>
                  <div className="grid grid-cols-4 gap-1.5">
                    {allPhotos.map((ref, i) => {
                      const isCover = i === coverIdx
                      return (
                        <div key={`${ref}-${i}`} className="relative aspect-square rounded-[9px] overflow-hidden bg-surface-2 hairline">
                          <img src={optimizeImageUrl(ref, 300) ?? ref} alt="" className="w-full h-full object-cover" />
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
              {allPhotos.length < 4 && (
                <div className="flex items-center gap-1.5">
                  <input className={field} value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} placeholder="หรือวาง URL รูปภาพ" inputMode="url" />
                  {urlDraft.trim() && (
                    <button onClick={addUrlPhoto} className="btn-icon shrink-0" aria-label="เพิ่มรูปจาก URL"><IconPlus size={15} /></button>
                  )}
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* ข้อ 8 — รูปเมนู (เฉพาะร้านอาหาร) */}
        {group === 'food' && (
          <SectionCard open={openCard === 'menu'} done={menuPaths.length > 0} onToggle={() => toggle('menu')}
            icon={<IconToolsKitchen2 size={15} />} title="รูปเมนู" sub="รูปหรือไฟล์ PDF ก็ได้ — เลือกได้หลายไฟล์"
            summary={`แนบไว้ ${menuPaths.length} ไฟล์`}>
            <div className="space-y-2">
              <label htmlFor="exp-menu-input" aria-disabled={menuUploading}
                className="block rounded-[12px] text-center py-4 px-3 cursor-pointer aria-disabled:opacity-50 aria-disabled:pointer-events-none [-webkit-tap-highlight-color:transparent]"
                style={{ border: '1.5px dashed var(--color-line-2)', background: 'var(--color-canvas)' }}>
                <span className="mx-auto mb-1.5 size-9 rounded-full bg-surface-2 grid place-items-center text-ink-2">
                  {menuUploading ? <IconLoader2 size={16} className="animate-spin" /> : <IconUpload size={16} />}
                </span>
                <span className="block text-[12.5px] font-semibold text-ink">แนบรูปเมนู / ไฟล์ PDF</span>
                <span className="block text-[10.5px] text-ink-3 mt-0.5">เลือกได้หลายไฟล์พร้อมกัน</span>
              </label>
              <input id="exp-menu-input" type="file" accept="image/*,application/pdf" multiple hidden onChange={onPickMenu} />
              {menuPaths.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {menuPaths.map((ref, i) => (
                    <div key={ref} className="relative w-16 h-16 rounded-md overflow-hidden bg-surface-2 hairline grid place-items-center">
                      {isPdfRef(ref)
                        ? <span className="text-ink-3"><IconFileTypePdf size={22} /></span>
                        : <img src={ref} alt="" className="w-full h-full object-cover" />}
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

        {/* ข้อ 9 — การเดินทาง + ปุ่มเพิ่มเส้นทางชัดๆ */}
        <SectionCard open={openCard === 'routes'} done={routeFilled.length > 0} onToggle={() => toggle('routes')}
          icon={<IconRoute size={15} />} title="การเดินทาง" sub="เพิ่มได้หลายเส้นทาง" summary={routesSum}>
          <div className="space-y-2">
            {routes.map((r, i) => {
              const mm = modeMeta(r.mode)
              const known = mm.rail ? findLine(metroSug, r.line ?? '') : null
              const stationOptions = known ? known.stations.map((s) => ({ value: s.name, label: s.num })) : allStationOptions
              return (
                <div key={i} className="rounded-[10px] hairline p-2.5 space-y-2 bg-canvas">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-ink-2">เส้นทางที่ {i + 1}</span>
                    {routes.length > 1 && (
                      <button onClick={() => setRoutes((rs) => rs.filter((_, idx) => idx !== i))} className="text-ink-3 hover:text-[#D85A30]"><IconTrash size={14} /></button>
                    )}
                  </div>
                  <ModePicker value={r.mode} onChange={(m) => patchRouteMode(i, m)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Combobox className={field} value={r.line ?? ''} placeholder={mm.fields.line}
                      options={mm.rail ? lineOptions : []}
                      onChange={(v) => patchRoute(i, { line: v, ...(lineColorAll[v] ? { color: lineColorAll[v] } : {}) })} />
                    <Combobox className={field} value={r.station ?? ''} placeholder={mm.rail ? 'สถานี เช่น Namba' : mm.fields.to}
                      options={mm.rail ? stationOptions : []}
                      onChange={(v) => patchRoute(i, { station: v })} />
                  </div>
                  {mm.rail && <ColorPicker value={r.color ?? '#185FA5'} onChange={(c) => patchRoute(i, { color: c })} />}
                </div>
              )
            })}
            <button onClick={() => setRoutes((rs) => [...rs, emptyRoute()])}
              className="w-full h-10 rounded-[10px] text-[12.5px] font-semibold flex items-center justify-center gap-1.5"
              style={{ border: '1.5px dashed var(--color-brand-border)', background: 'var(--color-brand-soft)', color: 'var(--color-brand-mid)' }}>
              <IconPlus size={15} /> เพิ่มเส้นทางที่ {routes.length + 1}
            </button>
          </div>
        </SectionCard>

        {/* ข้อ 10 — โน้ต */}
        <SectionCard open={openCard === 'note'} done={!!note.trim()} onToggle={() => toggle('note')}
          icon={<IconNotes size={15} />} title="โน้ต" sub="แนะนำสั้นๆ ถึงคนอื่น" summary={note.trim()}>
          <textarea className="hairline rounded-md text-[13px] p-3 bg-surface w-full outline-none focus:border-brand resize-none"
            rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="แนะนำสั้นๆ" />
        </SectionCard>

        {missing.length > 0 && (
          <p className="text-[11px] text-center pt-1" style={{ color: '#D85A30' }}>ยังขาด: {missing.join(' · ')}</p>
        )}
        <button onClick={save} disabled={busy || !name.trim() || !city.trim() || !country.trim()}
          className="btn-primary w-full h-11 disabled:opacity-50 !mt-3">
          {busy ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'เพิ่มลง Explore'}
        </button>
      </div>
    </Drawer>
  )
}
