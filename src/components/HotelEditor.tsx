import { useEffect, useRef, useState } from 'react'
import { IconTrash, IconPlus, IconPhoto, IconLoader2 } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { HotelPhoto } from './HotelPhoto'
import { uploadImage } from '@/lib/files'
import { confirmDialog } from '@/lib/confirm'
import type { Hotel, HotelRoom } from '@/lib/database.types'
import type { HotelInput } from '@/lib/tripMutations'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'
const lbl = 'text-[11px] text-ink-3'

// timestamptz <-> datetime-local helpers
function toLocal(ts: string | null | undefined) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function HotelEditor({
  open, onClose, initial, tripId, onSave, onDelete,
}: {
  open: boolean
  onClose: () => void
  initial: Hotel | null
  tripId: string
  onSave: (fields: HotelInput) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [nights, setNights] = useState('')
  const [bookingId, setBookingId] = useState('')
  const [mapUrl, setMapUrl] = useState('')
  const [checkin, setCheckin] = useState('')
  const [checkout, setCheckout] = useState('')
  const [rooms, setRooms] = useState<HotelRoom[]>([])
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setCity(initial?.city ?? '')
    setNights(initial?.nights != null ? String(initial.nights) : '')
    setBookingId(initial?.booking_id ?? '')
    setMapUrl(initial?.map_url ?? '')
    setCheckin(toLocal(initial?.checkin))
    setCheckout(toLocal(initial?.checkout))
    setRooms(initial?.rooms?.length ? initial.rooms.map((r) => ({ ...r })) : [{ name: 'Room 1', members: [] }])
    setPhotoPath(initial?.photo_path ?? null)
  }, [open, initial])

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const { path } = await uploadImage(tripId, 'hotel-photo', file)
    if (path) setPhotoPath(path)
    setUploading(false)
    if (photoInput.current) photoInput.current.value = ''
  }

  async function save() {
    setBusy(true)
    await onSave({
      name, city, nights: nights ? Number(nights) : null, booking_id: bookingId, map_url: mapUrl,
      checkin: checkin ? new Date(checkin).toISOString() : null,
      checkout: checkout ? new Date(checkout).toISOString() : null,
      rooms: rooms.filter((r) => r.name),
      photo_path: photoPath,
    })
    setBusy(false)
    onClose()
  }
  async function del() {
    if (!onDelete || !(await confirmDialog({ message: 'ลบที่พักนี้?', danger: true, confirmLabel: 'ลบ' }))) return
    setBusy(true); await onDelete(); setBusy(false); onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title={initial ? 'แก้ไขที่พัก' : 'เพิ่มที่พัก'}>
      <div className="space-y-3">
        {/* Photo */}
        <div className="flex items-center gap-3">
          <HotelPhoto photoPath={photoPath} name={name} size={64} radius={12} />
          <div>
            <button onClick={() => photoInput.current?.click()} disabled={uploading} className="btn-icon !w-auto px-3 gap-1.5 text-[12px] disabled:opacity-50">
              {uploading ? <IconLoader2 size={14} className="animate-spin" /> : <IconPhoto size={14} />}
              {photoPath ? 'เปลี่ยนรูป' : 'เพิ่มรูปโรงแรม'}
            </button>
            <input ref={photoInput} type="file" accept="image/*" hidden onChange={onPickPhoto} />
            <div className="text-[10px] text-ink-3 mt-1">รูปจะแสดงในหน้าภาพรวม</div>
          </div>
        </div>
        <div><div className={lbl}>ชื่อที่พัก</div><input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Beijing Wangfujing Grand Hotel" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><div className={lbl}>เมือง</div><input className={field} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Beijing" /></div>
          <div><div className={lbl}>จำนวนคืน</div><input type="number" className={field} value={nights} onChange={(e) => setNights(e.target.value)} placeholder="4" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><div className={lbl}>Check-in</div><input type="datetime-local" className={field} value={checkin} onChange={(e) => setCheckin(e.target.value)} /></div>
          <div><div className={lbl}>Check-out</div><input type="datetime-local" className={field} value={checkout} onChange={(e) => setCheckout(e.target.value)} /></div>
        </div>
        <div><div className={lbl}>Booking ID</div><input className={field} value={bookingId} onChange={(e) => setBookingId(e.target.value)} placeholder="BK-4892301" /></div>
        <div><div className={lbl}>ลิงก์แผนที่</div><input className={field} value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="https://maps.apple.com/?q=..." /></div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className={lbl}>ห้องพัก</span>
            <button onClick={() => setRooms((r) => [...r, { name: `Room ${r.length + 1}`, members: [] }])} className="btn-link flex items-center gap-1 text-[12px]"><IconPlus size={13} /> เพิ่มห้อง</button>
          </div>
          <div className="space-y-2">
            {rooms.map((r, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input className={`${field} !w-24`} value={r.name} onChange={(e) => setRooms((rs) => rs.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} placeholder="Room 1" />
                <input className={field} value={r.members.join(', ')} onChange={(e) => setRooms((rs) => rs.map((x, idx) => idx === i ? { ...x, members: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } : x))} placeholder="Elf, Nak" />
                <button onClick={() => setRooms((rs) => rs.filter((_, idx) => idx !== i))} className="text-ink-3 hover:text-[#D85A30] shrink-0"><IconTrash size={15} /></button>
              </div>
            ))}
          </div>
        </div>

        <button onClick={save} disabled={busy || !name} className="btn-primary w-full h-10 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        {initial && onDelete && (
          <button onClick={del} disabled={busy} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] text-[#D85A30]"><IconTrash size={15} /> ลบที่พัก</button>
        )}
      </div>
    </Drawer>
  )
}
