import { useEffect, useMemo, useRef, useState } from 'react'
import {
  IconTrash, IconPlus, IconLoader2, IconCheck, IconX, IconUpload, IconPhoto,
  IconWorld, IconLink, IconCalendarEvent, IconBed, IconTicket,
} from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { SectionCard } from './SectionCard'
import { ClearableField } from './ClearableField'
import { HotelPhoto } from './HotelPhoto'
import { uploadImage } from '@/lib/files'
import { confirmDialog } from '@/lib/confirm'
import { toast } from '@/lib/toast'
import { useTrip } from '@/contexts/TripContext'
import { cityImage } from '@/lib/cityImages'
import { optimizeImageUrl } from '@/lib/cloudinary'
import { nameFromMapUrl, resolveMapName, isMapLink } from '@/lib/geo'
import type { Hotel, HotelRoom } from '@/lib/database.types'
import type { HotelInput } from '@/lib/tripMutations'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'
const lbl = 'text-[11px] text-ink-3'

type CardKey = 'where' | 'info' | 'stay' | 'photo' | 'rooms'

// timestamptz <-> datetime-local helpers
function toLocal(ts: string | null | undefined) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const thShort = (local: string) =>
  local ? new Date(local).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : ''

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
  const { trip, hotels } = useTrip()
  const editing = !!initial
  // cities to offer = trip's cities ∪ cities already used on other hotels
  const tripCities = useMemo(() => {
    const set = new Set<string>()
    ;(trip?.cities ?? []).forEach((c) => set.add(c))
    hotels.forEach((h) => { if (h.city) set.add(h.city) })
    return Array.from(set)
  }, [trip, hotels])

  const [openCard, setOpenCard] = useState<CardKey | null>('where')
  const [name, setName] = useState('')
  const [autoFilled, setAutoFilled] = useState(false) // name came from the map link
  const [city, setCity] = useState('')
  const [nights, setNights] = useState('')
  const [nightsAuto, setNightsAuto] = useState(true) // auto-calc from dates until hand-edited
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
    setAutoFilled(false)
    setCity(initial?.city ?? (tripCities.length === 1 ? tripCities[0] : ''))
    setNights(initial?.nights != null ? String(initial.nights) : '')
    setNightsAuto(initial?.nights == null)
    setBookingId(initial?.booking_id ?? '')
    setMapUrl(initial?.map_url ?? '')
    setCheckin(toLocal(initial?.checkin))
    setCheckout(toLocal(initial?.checkout))
    setRooms(initial?.rooms?.length ? initial.rooms.map((r) => ({ ...r })) : [])
    setPhotoPath(initial?.photo_path ?? null)
    setLinkState('idle')
    setOpenCard(initial ? null : 'where')
  }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps

  // paste a map link → auto-fill the name (still editable), same as the place
  // editors. A hand-typed name is never overwritten.
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

  // จำนวนคืน: คำนวณจากช่วง Check-in → Check-out ให้เอง จนกว่าจะพิมพ์ทับ
  useEffect(() => {
    if (!open || !nightsAuto) return
    if (!checkin || !checkout) return
    const ci = new Date(checkin), co = new Date(checkout)
    if (isNaN(ci.getTime()) || isNaN(co.getTime()) || co <= ci) return
    const n = Math.max(1, Math.round((co.setHours(0, 0, 0, 0) - ci.setHours(0, 0, 0, 0)) / 86400000))
    setNights(String(n))
  }, [open, checkin, checkout, nightsAuto])

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
    const nm = name.trim()
    if (!nm) { toast.error('กรุณาใส่ชื่อที่พัก'); return }
    const ci = checkin ? new Date(checkin) : null
    const co = checkout ? new Date(checkout) : null
    if (ci && co && co <= ci) { toast.error('เวลา Check-out ต้องอยู่หลัง Check-in'); return }
    const n = nights.trim() ? Number(nights) : null
    if (n != null && (!Number.isFinite(n) || n < 0)) { toast.error('จำนวนคืนต้องเป็นตัวเลขไม่ติดลบ'); return }
    setBusy(true)
    await onSave({
      name: nm, city: city.trim(), nights: n, booking_id: bookingId, map_url: mapUrl,
      checkin: ci ? ci.toISOString() : null,
      checkout: co ? co.toISOString() : null,
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

  // ---- section states + summaries ----
  const staySum = [
    checkin && checkout ? `${thShort(checkin)} → ${thShort(checkout)}` : (checkin ? `เข้า ${thShort(checkin)}` : ''),
    nights.trim() ? `${nights} คืน` : '',
    bookingId.trim() ? `จอง ${bookingId.trim()}` : '',
  ].filter(Boolean).join(' · ')
  const roomFilled = rooms.filter((r) => r.name.trim())
  const roomsSum = roomFilled.length
    ? `${roomFilled.length} ห้อง · ${roomFilled.map((r) => r.name).join(', ')}`
    : ''
  const toggle = (k: CardKey) => setOpenCard((c) => (c === k ? null : k))
  const missing = !name.trim() ? 'ชื่อที่พัก' : null

  return (
    <Drawer open={open} onClose={onClose} title={initial ? 'แก้ไขที่พัก' : 'เพิ่มที่พัก'}>
      <div className="space-y-2">

        {/* เมือง — ชิปเมืองของทริป (มีรูป) + พิมพ์เองได้ */}
        <SectionCard open={openCard === 'where'} done={!!city.trim()} onToggle={() => toggle('where')}
          icon={<IconWorld size={15} />} title="พักเมืองไหน?" sub="แตะเมืองของทริปเพื่อเลือก" summary={city}>
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

        {/* ลิงก์ (auto-fill ชื่อ) + ชื่อที่พัก */}
        <SectionCard open={openCard === 'info'} done={!!name.trim()} onToggle={() => toggle('info')}
          icon={<IconLink size={15} />} title="ลิงก์ & ชื่อที่พัก" sub="วางลิงก์แล้วเราเติมชื่อให้ — แก้ไขได้" summary={name}>
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
              <div className={lbl}>ชื่อที่พัก *</div>
              <input className={field} value={name} onChange={(e) => { setName(e.target.value); setAutoFilled(false) }} placeholder="เช่น Beijing Wangfujing Grand Hotel" />
            </div>
          </div>
        </SectionCard>

        {/* เช็คอิน–เช็คเอาต์ + จำนวนคืน + Booking ID */}
        <SectionCard open={openCard === 'stay'} done={!!(checkin || checkout || nights.trim() || bookingId.trim())} onToggle={() => toggle('stay')}
          icon={<IconCalendarEvent size={15} />} title="เช็คอิน & การจอง" sub="ใส่วันเข้า-ออก เราคิดจำนวนคืนให้" summary={staySum}>
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0"><div className={lbl}>Check-in</div>
                <ClearableField type="datetime-local" ariaLabel="ล้าง Check-in" value={checkin}
                  onChange={setCheckin} onClear={() => setCheckin('')} />
              </div>
              <div className="min-w-0"><div className={lbl}>Check-out</div>
                <ClearableField type="datetime-local" ariaLabel="ล้าง Check-out" value={checkout}
                  onChange={setCheckout} onClear={() => setCheckout('')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className={lbl}>จำนวนคืน</div>
                <input type="number" className={field} value={nights}
                  onChange={(e) => { setNights(e.target.value); setNightsAuto(false) }} placeholder="4" />
                {nightsAuto && nights && <div className="flex items-center gap-1 mt-1 text-[10.5px] font-medium" style={{ color: '#16A34A' }}><IconCheck size={12} /> คิดจากวันเข้า-ออกให้แล้ว</div>}
              </div>
              <div>
                <div className={lbl}>Booking ID</div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"><IconTicket size={15} /></span>
                  <input className={`${field} !pl-9`} value={bookingId} onChange={(e) => setBookingId(e.target.value)} placeholder="BK-4892301" />
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* รูปโรงแรม — dropzone เดียวกับฟอร์มสถานที่ */}
        <SectionCard open={openCard === 'photo'} done={!!photoPath} onToggle={() => toggle('photo')}
          icon={<IconPhoto size={15} />} title="รูปโรงแรม" sub="แสดงในหน้าภาพรวมที่พัก" summary={photoPath ? '1 รูป' : ''}>
          <div className="space-y-2">
            {photoPath ? (
              <div className="flex items-center gap-3">
                <HotelPhoto photoPath={photoPath} name={name} size={64} radius={12} />
                <div className="flex items-center gap-2">
                  <button onClick={() => photoInput.current?.click()} disabled={uploading} className="btn-icon !w-auto px-3 gap-1.5 text-[12px] disabled:opacity-50">
                    {uploading ? <IconLoader2 size={14} className="animate-spin" /> : <IconPhoto size={14} />} เปลี่ยนรูป
                  </button>
                  <button onClick={() => setPhotoPath(null)} className="inline-flex items-center gap-1 text-[12px] text-[#D85A30]"><IconX size={13} /> ลบรูป</button>
                </div>
              </div>
            ) : (
              <label htmlFor="hotel-photo-input" aria-disabled={uploading}
                className="block rounded-[12px] text-center py-5 px-3 cursor-pointer aria-disabled:opacity-50 aria-disabled:pointer-events-none [-webkit-tap-highlight-color:transparent]"
                style={{ border: '1.5px dashed var(--color-line-2)', background: 'var(--color-canvas)' }}>
                <span className="mx-auto mb-2 size-11 rounded-full bg-surface-2 grid place-items-center text-ink-2">
                  {uploading ? <IconLoader2 size={19} className="animate-spin" /> : <IconUpload size={19} />}
                </span>
                <span className="block text-[13px] font-semibold text-ink">ลากรูปมาวาง หรือแตะเพื่อเลือก</span>
                <span className="block text-[11px] text-ink-3 mt-0.5">PNG · JPG</span>
                <span className="inline-block mt-2 text-[12px] font-semibold underline" style={{ color: 'var(--color-brand-mid)' }}>เลือกรูปจากเครื่อง</span>
              </label>
            )}
            <input id="hotel-photo-input" ref={photoInput} type="file" accept="image/*" hidden onChange={onPickPhoto} />
          </div>
        </SectionCard>

        {/* ห้องพัก + ผู้เข้าพัก */}
        <SectionCard open={openCard === 'rooms'} done={roomFilled.length > 0} onToggle={() => toggle('rooms')}
          icon={<IconBed size={15} />} title="ห้องพัก" sub="ใครนอนห้องไหน" summary={roomsSum}>
          <div className="space-y-2">
            {rooms.map((r, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input className={`${field} !w-24`} value={r.name} onChange={(e) => setRooms((rs) => rs.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} placeholder="Room 1" />
                <input className={field} value={r.members.join(', ')} onChange={(e) => setRooms((rs) => rs.map((x, idx) => idx === i ? { ...x, members: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } : x))} placeholder="ผู้เข้าพัก เช่น Elf, Nak" />
                <button onClick={() => setRooms((rs) => rs.filter((_, idx) => idx !== i))} className="text-ink-3 hover:text-[#D85A30] shrink-0"><IconTrash size={15} /></button>
              </div>
            ))}
            <button onClick={() => setRooms((r) => [...r, { name: `Room ${r.length + 1}`, members: [] }])}
              className="w-full h-10 rounded-[10px] text-[13px] font-semibold inline-flex items-center justify-center gap-1.5"
              style={{ border: '1.5px dashed var(--color-brand-border)', color: 'var(--color-brand-mid)', background: 'var(--color-brand-soft)' }}>
              <IconPlus size={15} /> เพิ่มห้องที่ {rooms.length + 1}
            </button>
          </div>
        </SectionCard>

        {missing && <p className="text-center text-[11px] text-ink-3">ยังขาด: {missing}</p>}
        <button onClick={save} disabled={busy || !name.trim()} className="btn-primary w-full h-10 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        {initial && onDelete && (
          <button onClick={del} disabled={busy} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] text-[#D85A30]"><IconTrash size={15} /> ลบที่พัก</button>
        )}
      </div>
    </Drawer>
  )
}
