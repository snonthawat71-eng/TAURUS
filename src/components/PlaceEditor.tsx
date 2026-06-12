import { useEffect, useRef, useState } from 'react'
import { IconTrash, IconPhoto, IconLoader2, IconCheck } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { ColorPicker } from './ColorPicker'
import { SignedImage } from './SignedImage'
import { uploadImage } from '@/lib/files'
import { useTrip } from '@/contexts/TripContext'
import { catMeta, CATEGORY, PLACE_CATEGORIES, FOOD_CATEGORIES } from '@/lib/placeMeta'
import type { Place, PlaceGroup } from '@/lib/database.types'
import type { PlaceInput } from '@/lib/placeMutations'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'
const lbl = 'text-[11px] text-ink-3'

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
  const { trip } = useTrip()
  const tripCities = trip?.cities ?? []
  const cats = group === 'food' ? FOOD_CATEGORIES : PLACE_CATEGORIES
  const [city, setCity] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState(cats[0])
  const [line, setLine] = useState('')
  const [color, setColor] = useState('#185FA5')
  const [station, setStation] = useState('')
  const [mapUrl, setMapUrl] = useState('')
  const [note, setNote] = useState('')
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setCategory(initial?.category && cats.includes(initial.category) ? initial.category : cats[0])
    setLine(initial?.station_line ?? '')
    setColor(initial?.station_color ?? '#185FA5')
    setStation(initial?.station_name ?? '')
    setMapUrl(initial?.map_url ?? '')
    setNote(initial?.note ?? '')
    setPhotoPath(initial?.photo_path ?? null)
    setCity(initial?.city ?? (tripCities.length === 1 ? tripCities[0] : ''))
  }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const { path } = await uploadImage(tripId, 'place-photo', file)
    if (path) setPhotoPath(path)
    setUploading(false)
    if (photoInput.current) photoInput.current.value = ''
  }

  async function save() {
    setBusy(true)
    await onSave({
      group_type: group, name, category, station_line: line, station_color: color,
      station_name: station, map_url: mapUrl, note, photo_path: photoPath, city: city || null,
    })
    setBusy(false)
    onClose()
  }
  const meta = catMeta(category)
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
            <SignedImage path={photoPath} className="w-full h-full object-cover"
              fallback={<meta.icon size={22} style={{ color: meta.fg, opacity: 0.85 }} />} />
          </div>
          <div>
            <button onClick={() => photoInput.current?.click()} disabled={uploading} className="btn-icon !w-auto px-3 gap-1.5 text-[12px] disabled:opacity-50">
              {uploading ? <IconLoader2 size={14} className="animate-spin" /> : <IconPhoto size={14} />}
              {photoPath ? 'เปลี่ยนรูป' : 'เพิ่มรูปสถานที่'}
            </button>
            {photoPath && <button onClick={() => setPhotoPath(null)} className="btn-link text-[12px] ml-2">เอาออก</button>}
            <input ref={photoInput} type="file" accept="image/*" hidden onChange={onPickPhoto} />
          </div>
        </div>
        <div><div className={lbl}>ชื่อ</div><input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Forbidden City" /></div>
        <div>
          <div className={lbl}>หมวด</div>
          <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
            {cats.map((c) => <option key={c} value={c}>{CATEGORY[c].label}</option>)}
          </select>
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
        <div className="grid grid-cols-2 gap-2">
          <div><div className={lbl}>สาย / การเดินทาง</div><input className={field} value={line} onChange={(e) => setLine(e.target.value)} placeholder="Line 1 / Bus" /></div>
          <div><div className={lbl}>สถานี</div><input className={field} value={station} onChange={(e) => setStation(e.target.value)} placeholder="Wangfujing" /></div>
        </div>
        <div>
          <div className={lbl}>สีสาย</div>
          <ColorPicker value={color} onChange={setColor} />
        </div>
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
