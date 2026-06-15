import { useEffect, useRef, useState } from 'react'
import { IconPhoto, IconLoader2, IconPlus, IconTrash } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { ColorPicker } from './ColorPicker'
import { uploadPublicImage } from '@/lib/files'
import { CATEGORY, PLACE_CATEGORIES, FOOD_CATEGORIES, FOOD_GROUPS } from '@/lib/placeMeta'
import type { ExploreInput } from '@/lib/exploreMutations'
import type { PlaceGroup, ExplorePlace, ExploreRoute } from '@/lib/database.types'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'
const lbl = 'text-[11px] text-ink-3'

function emptyRoute(): ExploreRoute { return { line: '', color: '#185FA5', station: '' } }

export function ExploreEditor({ open, onClose, initial, onSave }: {
  open: boolean
  onClose: () => void
  initial?: ExplorePlace | null
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
  const [mapUrl, setMapUrl] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)

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
    await onSave({
      group_type: group, name, category, city: city || null, country: country || null,
      station_line: first?.line || null, station_color: first?.color || null, station_name: first?.station || null,
      routes: clean.length ? clean : null,
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
        <div><div className={lbl}>ชื่อ</div><input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Farmily" /></div>
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
        <div className="grid grid-cols-2 gap-2">
          <div><div className={lbl}>เมือง</div><input className={field} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Osaka" /></div>
          <div><div className={lbl}>ประเทศ</div><input className={field} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Japan" /></div>
        </div>

        {/* multiple ways to get there */}
        <div>
          <div className="flex items-center justify-between">
            <div className={lbl}>การเดินทาง (เพิ่มได้หลายเส้นทาง)</div>
          </div>
          <div className="space-y-2 mt-1">
            {routes.map((r, i) => (
              <div key={i} className="card p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-ink-2">เส้นทางที่ {i + 1}</span>
                  {routes.length > 1 && (
                    <button onClick={() => setRoutes((rs) => rs.filter((_, idx) => idx !== i))} className="text-ink-3 hover:text-[#D85A30]"><IconTrash size={14} /></button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input className={field} value={r.line ?? ''} onChange={(e) => patchRoute(i, { line: e.target.value })} placeholder="สาย เช่น Midosuji" />
                  <input className={field} value={r.station ?? ''} onChange={(e) => patchRoute(i, { station: e.target.value })} placeholder="สถานี เช่น Namba" />
                </div>
                <ColorPicker value={r.color ?? '#185FA5'} onChange={(c) => patchRoute(i, { color: c })} />
              </div>
            ))}
            <button onClick={() => setRoutes((rs) => [...rs, emptyRoute()])} className="btn-link flex items-center gap-1.5 text-[12px]">
              <IconPlus size={14} /> เพิ่มเส้นทาง
            </button>
          </div>
        </div>

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
        <button onClick={save} disabled={busy || !name} className="btn-primary w-full h-10 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'เพิ่มลง Explore'}</button>
      </div>
    </Drawer>
  )
}
