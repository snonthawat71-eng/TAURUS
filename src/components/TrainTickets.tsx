import { useMemo, useRef, useState } from 'react'
import { IconQrcode, IconTrash, IconPlus, IconUpload, IconLoader2, IconTrain } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { SignedImage } from './SignedImage'
import { Lightbox, type PhotoRef } from './Lightbox'
import { uploadImage } from '@/lib/files'
import { addTrainTicket, updateTrainTicket, deleteTrainTicket } from '@/lib/tripMutations'
import { confirmDialog } from '@/lib/confirm'
import { formatFlightDate } from '@/lib/format'
import type { Train, TrainTicket, Traveler } from '@/lib/database.types'

const qrRef = (path: string): PhotoRef => (/^https?:\/\//.test(path) ? { url: path } : { path })
const field = 'hairline rounded-md text-[13px] h-9 px-2.5 bg-surface w-full outline-none focus:border-brand'

/**
 * Per-passenger train tickets: a clean list of riders, each with seat/car and a
 * QR thumbnail. Tap a QR to blow it up full-screen for the gate scanner (swipe
 * between people in that enlarged view). Owners/editors can add riders + upload QRs.
 */
export function TrainTickets({
  open, onClose, train, tickets, travelers, tripId, canEdit, onChanged,
}: {
  open: boolean
  onClose: () => void
  train: Train | null
  tickets: TrainTicket[]
  travelers: Traveler[]
  tripId: string
  canEdit: boolean
  onChanged: () => void | Promise<void>
}) {
  const rows = useMemo(() => [...tickets].sort((a, b) => a.position - b.position), [tickets])
  // gallery of every QR present, so the enlarged view can swipe person→person
  const gallery = useMemo(() => rows.filter((t) => t.qr_path).map((t) => qrRef(t.qr_path!)), [rows])
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)

  const nameOf = (t: TrainTicket) =>
    travelers.find((tv) => tv.id === t.traveler_id)?.nickname || t.passenger_name || 'ผู้โดยสาร'

  async function addRider() {
    if (!train || adding) return
    setAdding(true)
    await addTrainTicket(tripId, train.id, { traveler_id: travelers[0]?.id ?? null, position: rows.length })
    await onChanged()
    setAdding(false)
  }

  return (
    <Drawer open={open} onClose={onClose} title="ตั๋วรถไฟ · QR">
      {train && (
        <div className="card p-3 flex items-center gap-2.5 mb-3">
          <span className="size-9 rounded-md bg-surface-2 grid place-items-center text-brand shrink-0"><IconTrain size={18} /></span>
          <div className="min-w-0">
            <div className="text-[13px] font-medium truncate">{train.dep_name} → {train.arr_name}</div>
            <div className="text-[11px] text-ink-3 truncate">
              {[train.train_no && `${train.train_no}`, train.operator, formatFlightDate(train.travel_date)].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {rows.length === 0 && (
          <div className="card p-6 flex flex-col items-center gap-2 text-center">
            <IconQrcode size={26} className="text-ink-3" />
            <p className="text-[13px] text-ink-2">ยังไม่มีตั๋วรายคน</p>
          </div>
        )}
        {rows.map((t) => (
          <TicketRow key={t.id} ticket={t} name={nameOf(t)} travelers={travelers} tripId={tripId} canEdit={canEdit}
            onEnlarge={() => { const i = gallery.findIndex((g) => g.url === t.qr_path || g.path === t.qr_path); if (i >= 0) setLightbox(i) }}
            onChanged={onChanged} />
        ))}
      </div>

      {canEdit && train && (
        <button onClick={addRider} disabled={adding} className="btn-link flex items-center gap-1.5 mt-3 disabled:opacity-50">
          {adding ? <IconLoader2 size={15} className="animate-spin" /> : <IconPlus size={15} />} เพิ่มผู้โดยสาร
        </button>
      )}

      {lightbox !== null && (
        <Lightbox photos={gallery} index={lightbox} alt="QR ตั๋วรถไฟ" onClose={() => setLightbox(null)} />
      )}
    </Drawer>
  )
}

function TicketRow({
  ticket, name, travelers, tripId, canEdit, onEnlarge, onChanged,
}: {
  ticket: TrainTicket
  name: string
  travelers: Traveler[]
  tripId: string
  canEdit: boolean
  onEnlarge: () => void
  onChanged: () => void | Promise<void>
}) {
  const [travelerId, setTravelerId] = useState(ticket.traveler_id ?? '')
  const [seat, setSeat] = useState(ticket.seat_no ?? '')
  const [car, setCar] = useState(ticket.car ?? '')
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  async function persist(patch: Parameters<typeof updateTrainTicket>[1]) {
    await updateTrainTicket(ticket.id, patch)
    await onChanged()
  }
  async function onPickQr(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const { path } = await uploadImage(tripId, 'train-qr', file)
    if (path) await persist({ qr_path: path })
    setUploading(false)
    if (fileInput.current) fileInput.current.value = ''
  }
  async function remove() {
    if (!(await confirmDialog({ message: `ลบตั๋วของ ${name}?`, danger: true, confirmLabel: 'ลบ' }))) return
    await deleteTrainTicket(ticket.id)
    await onChanged()
  }

  return (
    <div className="card p-3 flex gap-3">
      {/* QR thumbnail — tap to enlarge for scanning */}
      <div className="shrink-0">
        {ticket.qr_path ? (
          <button onClick={onEnlarge} className="size-20 rounded-md overflow-hidden bg-white hairline grid place-items-center" aria-label="ขยาย QR">
            <SignedImage url={qrRef(ticket.qr_path).url} path={qrRef(ticket.qr_path).path} alt="QR" className="w-full h-full object-contain" width={300}
              fallback={<IconQrcode size={26} className="text-ink-3" />} />
          </button>
        ) : canEdit ? (
          <button onClick={() => fileInput.current?.click()} disabled={uploading}
            className="size-20 rounded-md bg-surface-2 hairline grid place-items-center text-ink-3 disabled:opacity-50">
            {uploading ? <IconLoader2 size={22} className="animate-spin" /> : <span className="flex flex-col items-center gap-1"><IconUpload size={20} /><span className="text-[10px]">อัป QR</span></span>}
          </button>
        ) : (
          <div className="size-20 rounded-md bg-surface-2 grid place-items-center text-ink-3"><IconQrcode size={26} /></div>
        )}
      </div>

      {/* details */}
      <div className="flex-1 min-w-0">
        {canEdit ? (
          <div className="space-y-2">
            {travelers.length > 0 ? (
              <select className={field} value={travelerId}
                onChange={(e) => { setTravelerId(e.target.value); persist({ traveler_id: e.target.value || null }) }}>
                <option value="">— ระบุผู้โดยสาร —</option>
                {travelers.map((tv) => <option key={tv.id} value={tv.id}>{tv.nickname ?? 'ผู้เดินทาง'}</option>)}
              </select>
            ) : (
              <div className="text-[14px] font-medium">{name}</div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input className={field} value={car} placeholder="ตู้ที่" onChange={(e) => setCar(e.target.value)} onBlur={() => persist({ car: car.trim() || null })} />
              <input className={field} value={seat} placeholder="ที่นั่ง" onChange={(e) => setSeat(e.target.value)} onBlur={() => persist({ seat_no: seat.trim() || null })} />
            </div>
            <div className="flex items-center gap-3">
              {ticket.qr_path && (
                <button onClick={() => fileInput.current?.click()} disabled={uploading} className="btn-link text-[12px] disabled:opacity-50">
                  {uploading ? 'กำลังอัป…' : 'เปลี่ยน QR'}
                </button>
              )}
              <button onClick={remove} className="text-[12px] inline-flex items-center gap-1 text-[#D85A30] ml-auto"><IconTrash size={14} /> ลบ</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-[14px] font-medium">{name}</div>
            <div className="text-[12px] text-ink-3 mt-1">
              {[car && `ตู้ ${car}`, seat && `ที่นั่ง ${seat}`].filter(Boolean).join(' · ') || 'ไม่ระบุที่นั่ง'}
            </div>
            {ticket.qr_path && <button onClick={onEnlarge} className="btn-link text-[12px] mt-1.5 inline-flex items-center gap-1"><IconQrcode size={13} /> แตะดู QR เต็มจอ</button>}
          </div>
        )}
      </div>

      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPickQr} />
    </div>
  )
}
