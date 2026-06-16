import { useEffect, useMemo, useRef, useState } from 'react'
import { IconPhoto, IconLoader2, IconPlus, IconTrash, IconBuildingStore } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { ColorPicker } from './ColorPicker'
import { Combobox, type ComboOption } from './Combobox'
import { suggestionsFromText, findLine } from '@/lib/metro/suggest'
import { uploadPublicImage } from '@/lib/files'
import { hscroll } from '@/lib/hscroll'
import { CATEGORY, PLACE_CATEGORIES, FOOD_CATEGORIES, FOOD_GROUPS } from '@/lib/placeMeta'
import type { ExploreInput } from '@/lib/exploreMutations'
import type { PlaceGroup, ExplorePlace, ExploreRoute, PlaceBranch } from '@/lib/database.types'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'
const lbl = 'text-[11px] text-ink-3'

function emptyRoute(): ExploreRoute { return { line: '', color: '#185FA5', station: '' } }
function emptyBranch(): PlaceBranch { return { label: '', map_url: '', line: '', color: '#185FA5', station: '' } }

export function ExploreEditor({ open, onClose, initial, existing, onSave }: {
  open: boolean
  onClose: () => void
  initial?: ExplorePlace | null
  existing?: ExplorePlace[]
  onSave: (input: ExploreInput) => Promise<void>
}) {
  const editing = !!initial
  const [group, setGroup] = useState<PlaceGroup>('place')
  const cats = group === 'food' ? FOOD_CATEGORIES : PLACE_CATEGORIES
  const [name, setName] = useState('')
  const [category, setCategory] = useState(cats[0])
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [routes, setRoutes] = useState<ExploreRoute[]>([emptyRoute()])
  const [branches, setBranches] = useState<PlaceBranch[]>([])
  const [mapUrl, setMapUrl] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)

  // previously-used city/country pairs — for the quick city chips + comboboxes.
  const sugg = useMemo(() => {
    const placeKeys = new Map<string, { city: string; country: string }>()
    for (const e of existing ?? []) {
      if (e.city || e.country) placeKeys.set(`${e.city ?? ''}|${e.country ?? ''}`, { city: e.city ?? '', country: e.country ?? '' })
    }
    return { cityChips: [...placeKeys.values()].filter((p) => p.city || p.country) }
  }, [existing])

  // built-in ("system") metro data — the default line/station/colour catalogue,
  // the same for every country/city. Users can still type any custom value.
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
    setName(initial?.name ?? '')
    setCategory(initial?.category ?? (g === 'food' ? FOOD_CATEGORIES : PLACE_CATEGORIES)[0])
    setCity(initial?.city ?? '')
    setCountry(initial?.country ?? '')
    const r = initial?.routes?.length
      ? initial.routes.map((x) => ({ line: x.line ?? '', color: x.color ?? '#185FA5', station: x.station ?? '' }))
      : [{ line: initial?.station_line ?? '', color: initial?.station_color ?? '#185FA5', station: initial?.station_name ?? '' }]
    setRoutes(r)
    setBranches(initial?.branches?.length
      ? initial.branches.map((b) => ({ label: b.label ?? '', map_url: b.map_url ?? '', line: b.line ?? '', color: b.color ?? '#185FA5', station: b.station ?? '' }))
      : [])
    setMapUrl(initial?.map_url ?? '')
    setPhotoUrl(initial?.photo_url ?? '')
    setNote(initial?.note ?? '')
  }, [open, initial])

  function changeGroup(g: PlaceGroup) {
    setGroup(g)
    setCategory((g === 'food' ? FOOD_CATEGORIES : PLACE_CATEGORIES)[0])
  }
  function patchRoute(i: number, p: Partial<ExploreRoute>) {
    setRoutes((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)))
  }
  function patchBranch(i: number, p: Partial<PlaceBranch>) {
    setBranches((bs) => bs.map((b, idx) => (idx === i ? { ...b, ...p } : b)))
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const { url } = await uploadPublicImage(file)
    if (url) setPhotoUrl(url)
    setUploading(false)
    if (photoInput.current) photoInput.current.value = ''
  }

  async function save() {
    setBusy(true)
    const clean = routes.filter((r) => r.line || r.station)
    const first = clean[0]
    const cleanBranches = branches.filter((b) => b.label || b.map_url || b.line || b.station)
    await onSave({
      group_type: group, name, category, city: city || null, country: country || null,
      station_line: first?.line || null, station_color: first?.color || null, station_name: first?.station || null,
      routes: clean.length ? clean : null,
      branches: cleanBranches.length ? cleanBranches : null,
      map_url: mapUrl || null, photo_url: photoUrl || null, note: note || null,
    })
    setBusy(false)
    onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title={editing ? 'แก้ไขสถานที่' : 'เพิ่มลง Explore'}>
      <div className="space-y-3">
        <div className="inline-flex gap-0.5 p-0.5 rounded-md bg-surface-2">
          {([['place', 'สถานที่'], ['food', 'ร้านอาหาร/คาเฟ่']] as const).map(([g, label]) => (
            <button key={g} onClick={() => changeGroup(g)}
              className={['px-3 h-8 rounded-[6px] text-[12px] font-medium', group === g ? 'bg-surface text-ink shadow-sm' : 'text-ink-3'].join(' ')}>{label}</button>
          ))}
        </div>
        <div><div className={lbl}>ชื่อ *</div><input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Farmily" /></div>
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
          </select>
        </div>
        {sugg.cityChips.length > 0 && (
          <div>
            <div className={lbl}>เลือกเมืองที่เคยใช้ — แตะเพื่อเติม</div>
            <div ref={hscroll} className="flex gap-1.5 mt-1 overflow-x-auto no-scrollbar">
              {sugg.cityChips.map((p, i) => {
                const sel = p.city === city && p.country === country
                return (
                  <button key={i} onClick={() => { setCity(p.city); setCountry(p.country) }}
                    className={['shrink-0 h-7 px-2.5 rounded-full text-[11px] font-medium whitespace-nowrap', sel ? 'bg-brand text-white' : 'bg-surface-2 text-ink-2'].join(' ')}>
                    {[p.city, p.country].filter(Boolean).join(', ')}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div><div className={lbl}>เมือง *</div>
            <Combobox className={field} value={city} onChange={setCity} placeholder="Osaka"
              options={[...new Set(sugg.cityChips.map((p) => p.city).filter(Boolean))].map((c) => ({ value: c }))} />
          </div>
          <div><div className={lbl}>ประเทศ *</div>
            <Combobox className={field} value={country} onChange={setCountry} placeholder="Japan"
              options={[...new Set(sugg.cityChips.map((p) => p.country).filter(Boolean))].map((c) => ({ value: c }))} />
          </div>
        </div>

        {/* multiple ways to get there */}
        <div>
          <div className="flex items-center justify-between">
            <div className={lbl}>การเดินทาง (เพิ่มได้หลายเส้นทาง)</div>
          </div>
          <div className="space-y-2 mt-1">
            {routes.map((r, i) => {
              const known = findLine(metroSug, r.line ?? '')
              const stationOptions = known ? known.stations.map((s) => ({ value: s.name, label: s.num })) : allStationOptions
              return (
                <div key={i} className="card p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-ink-2">เส้นทางที่ {i + 1}</span>
                    {routes.length > 1 && (
                      <button onClick={() => setRoutes((rs) => rs.filter((_, idx) => idx !== i))} className="text-ink-3 hover:text-[#D85A30]"><IconTrash size={14} /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Combobox className={field} value={r.line ?? ''} placeholder="สาย เช่น Midosuji"
                      options={lineOptions}
                      onChange={(v) => patchRoute(i, { line: v, ...(lineColorAll[v] ? { color: lineColorAll[v] } : {}) })} />
                    <Combobox className={field} value={r.station ?? ''} placeholder="สถานี เช่น Namba"
                      options={stationOptions}
                      onChange={(v) => patchRoute(i, { station: v })} />
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
                const known = findLine(metroSug, b.line ?? '')
                const stationOptions = known ? known.stations.map((s) => ({ value: s.name, label: s.num })) : allStationOptions
                return (
                  <div key={i} className="card p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <input className={field} value={b.label ?? ''} onChange={(e) => patchBranch(i, { label: e.target.value })} placeholder="ชื่อสาขา เช่น สาขาสยาม" />
                      <button onClick={() => setBranches((bs) => bs.filter((_, idx) => idx !== i))} className="text-ink-3 hover:text-[#D85A30] shrink-0"><IconTrash size={15} /></button>
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
              <button onClick={() => setBranches((bs) => [...bs, emptyBranch()])} className="btn-link flex items-center gap-1.5 text-[12px]">
                <IconPlus size={14} /> เพิ่มสาขา
              </button>
            </div>
          </div>
        )}

        <div>
          <div className={lbl}>รูปภาพ</div>
          <div className="flex items-center gap-3 mt-1">
            <div className="w-20 h-16 rounded-md overflow-hidden shrink-0 bg-surface-2 grid place-items-center">
              {photoUrl ? <img src={photoUrl} alt="" className="w-full h-full object-cover" /> : <IconPhoto size={20} className="text-ink-3" />}
            </div>
            <div>
              <button onClick={() => photoInput.current?.click()} disabled={uploading} className="btn-icon !w-auto px-3 gap-1.5 text-[12px] disabled:opacity-50">
                {uploading ? <IconLoader2 size={14} className="animate-spin" /> : <IconPhoto size={14} />} {photoUrl ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
              </button>
              {photoUrl && <button onClick={() => setPhotoUrl('')} className="btn-link text-[12px] ml-2">เอาออก</button>}
              <input ref={photoInput} type="file" accept="image/*" hidden onChange={onPick} />
            </div>
          </div>
          <input className={`${field} mt-2`} value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="หรือวาง URL รูปภาพ" />
        </div>
        <div><div className={lbl}>ลิงก์แผนที่</div><input className={field} value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="https://maps..." /></div>
        <div><div className={lbl}>โน้ต</div>
          <textarea className="hairline rounded-md text-[13px] p-3 bg-surface w-full outline-none focus:border-brand resize-none" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="แนะนำสั้นๆ" />
        </div>
        {(!name.trim() || !city.trim() || !country.trim()) && (
          <p className="text-[11px] text-[#D85A30]">กรอก ชื่อ · เมือง · ประเทศ ให้ครบก่อนบันทึก (เพื่อให้ค้นหา/กรองเจอ)</p>
        )}
        <button onClick={save} disabled={busy || !name.trim() || !city.trim() || !country.trim()} className="btn-primary w-full h-10 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'เพิ่มลง Explore'}</button>
      </div>
    </Drawer>
  )
}
