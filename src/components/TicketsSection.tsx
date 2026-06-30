import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconQrcode, IconTrash, IconPlus, IconUpload, IconLoader2, IconX, IconArrowUpRight, IconTrain, IconPencil } from '@tabler/icons-react'
import { SignedImage } from './SignedImage'
import { Lightbox, type PhotoRef } from './Lightbox'
import { uploadImage } from '@/lib/files'
import { addTrainTicket, updateTrainTicket, deleteTrainTicket } from '@/lib/tripMutations'
import { confirmDialog } from '@/lib/confirm'
import type { TrainTicket, Traveler } from '@/lib/database.types'

const qrRef = (path: string): PhotoRef => (/^https?:\/\//.test(path) ? { url: path } : { path })
const field = 'hairline rounded-md text-[13px] h-9 px-2.5 bg-surface w-full outline-none focus:border-brand'

/**
 * Boarding-pass style tickets — a 2-up grid of small cards (no section heading).
 * Tap a card to open the big detail with its QR; tap the QR to blow it up
 * full-screen for the gate scanner.
 */
export function TicketsSection({ tickets, travelers, tripId, canEdit, onChanged }: {
  tickets: TrainTicket[]
  travelers: Traveler[]
  tripId: string
  canEdit: boolean
  onChanged: () => void | Promise<void>
}) {
  const rows = useMemo(() => [...tickets].sort((a, b) => a.position - b.position), [tickets])
  const gallery = useMemo(() => rows.filter((t) => t.qr_path).map((t) => qrRef(t.qr_path!)), [rows])
  const [openId, setOpenId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)

  const nameOf = (t: TrainTicket) =>
    travelers.find((tv) => tv.id === t.traveler_id)?.nickname || t.passenger_name || 'ผู้โดยสาร'

  const open = rows.find((t) => t.id === openId) ?? null

  async function add() {
    if (adding) return
    setAdding(true)
    const id = await addTrainTicket(tripId, { traveler_id: travelers[0]?.id ?? null, position: rows.length })
    await onChanged()
    setAdding(false)
    setOpenId(id) // jump straight into the new card to fill it in
  }
  function enlarge(t: TrainTicket) {
    const i = gallery.findIndex((g) => g.url === t.qr_path || g.path === t.qr_path)
    if (i >= 0) setLightbox(i)
  }

  if (rows.length === 0 && !canEdit) return null

  return (
    <div className="mt-5">
      <div className="grid grid-cols-2 gap-2.5">
        {rows.map((t) => (
          <TicketCard key={t.id} ticket={t} name={nameOf(t)} onOpen={() => setOpenId(t.id)} />
        ))}
        {canEdit && (
          <button onClick={add} disabled={adding}
            className="card border-dashed min-h-[112px] flex flex-col items-center justify-center gap-1.5 text-ink-3 hover:bg-surface-2/40 disabled:opacity-50">
            {adding ? <IconLoader2 size={20} className="animate-spin" /> : <IconPlus size={20} />}
            <span className="text-[12px] font-medium">เพิ่มตั๋ว</span>
          </button>
        )}
      </div>

      {open && (
        <TicketDetail ticket={open} name={nameOf(open)} travelers={travelers} tripId={tripId} canEdit={canEdit}
          onClose={() => setOpenId(null)} onEnlarge={() => enlarge(open)} onChanged={onChanged} />
      )}

      {lightbox !== null && (
        <Lightbox photos={gallery} index={lightbox} alt="QR ตั๋ว" onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}

/** Compact boarding-pass card (image 1). */
function TicketCard({ ticket, name, onOpen }: { ticket: TrainTicket; name: string; onOpen: () => void }) {
  const route = ticket.from_station && ticket.to_station ? `${ticket.from_station} → ${ticket.to_station}` : ''
  const seat = [ticket.car && `ตู้ ${ticket.car}`, ticket.seat_no && `ที่นั่ง ${ticket.seat_no}`].filter(Boolean).join(' · ')
  return (
    <button onClick={onOpen} className="card p-3.5 text-left flex flex-col min-h-[112px] hover:bg-surface-2/30 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-ink-3 truncate">{ticket.label || 'ตั๋ว'}</span>
        <IconQrcode size={15} className={ticket.qr_path ? 'text-brand shrink-0' : 'text-ink-3/40 shrink-0'} />
      </div>
      <div className="text-[15px] font-semibold leading-snug mt-1.5 truncate">{name}</div>
      <div className="text-[11px] text-ink-3 mt-auto pt-2 truncate">{route || seat || 'แตะดูตั๋ว'}</div>
    </button>
  )
}

/** Expanded detail with the big QR (image 2). */
function TicketDetail({
  ticket, name, travelers, tripId, canEdit, onClose, onEnlarge, onChanged,
}: {
  ticket: TrainTicket
  name: string
  travelers: Traveler[]
  tripId: string
  canEdit: boolean
  onClose: () => void
  onEnlarge: () => void
  onChanged: () => void | Promise<void>
}) {
  const [travelerId, setTravelerId] = useState(ticket.traveler_id ?? '')
  const [label, setLabel] = useState(ticket.label ?? '')
  const [from, setFrom] = useState(ticket.from_station ?? '')
  const [to, setTo] = useState(ticket.to_station ?? '')
  const [seat, setSeat] = useState(ticket.seat_no ?? '')
  const [car, setCar] = useState(ticket.car ?? '')
  // a freshly-added (blank) ticket opens straight into the edit form
  const [editing, setEditing] = useState(() => !ticket.qr_path && !ticket.from_station && !ticket.seat_no && !ticket.car && !ticket.label)
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
    const { path } = await uploadImage(tripId, 'ticket-qr', file)
    if (path) await persist({ qr_path: path })
    setUploading(false)
    if (fileInput.current) fileInput.current.value = ''
  }
  async function remove() {
    if (!(await confirmDialog({ message: `ลบตั๋วของ ${name}?`, danger: true, confirmLabel: 'ลบ' }))) return
    await deleteTrainTicket(ticket.id)
    await onChanged()
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[105] grid place-items-center p-5 bg-black/45" onClick={onClose}>
      <div className="w-full max-w-[360px] card p-0 overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-0.5">
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)} aria-label="แก้ไข" className="btn-icon !size-8 !border-0 text-ink-3"><IconPencil size={16} /></button>
          )}
          <button onClick={onClose} aria-label="ปิด" className="btn-icon !size-8 !border-0 text-ink-3"><IconX size={18} /></button>
        </div>

        {editing ? (
          <div className="px-5 py-5 space-y-2.5">
            <div className="text-[14px] font-semibold pr-8">แก้ไขตั๋ว</div>
            {travelers.length > 0 && (
              <select className={field} value={travelerId}
                onChange={(e) => { setTravelerId(e.target.value); persist({ traveler_id: e.target.value || null }) }}>
                <option value="">— ระบุผู้โดยสาร —</option>
                {travelers.map((tv) => <option key={tv.id} value={tv.id}>{tv.nickname ?? 'ผู้เดินทาง'}</option>)}
              </select>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input className={field} value={from} placeholder="สถานีต้นทาง" onChange={(e) => setFrom(e.target.value)} onBlur={() => persist({ from_station: from.trim() || null })} />
              <input className={field} value={to} placeholder="สถานีปลายทาง" onChange={(e) => setTo(e.target.value)} onBlur={() => persist({ to_station: to.trim() || null })} />
            </div>
            <input className={field} value={label} placeholder="ป้ายกำกับ (เช่น ขาไป)" onChange={(e) => setLabel(e.target.value)} onBlur={() => persist({ label: label.trim() || null })} />
            <div className="grid grid-cols-2 gap-2">
              <input className={field} value={car} placeholder="ตู้ที่ (Car)" onChange={(e) => setCar(e.target.value)} onBlur={() => persist({ car: car.trim() || null })} />
              <input className={field} value={seat} placeholder="ที่นั่ง (Seat)" onChange={(e) => setSeat(e.target.value)} onBlur={() => persist({ seat_no: seat.trim() || null })} />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button onClick={() => fileInput.current?.click()} disabled={uploading} className="btn-icon !w-auto px-3 gap-1.5 text-[12px] disabled:opacity-50">
                {uploading ? <IconLoader2 size={14} className="animate-spin" /> : <IconUpload size={14} />} {ticket.qr_path ? 'เปลี่ยน QR' : 'อัป QR'}
              </button>
              <button onClick={remove} className="text-[12px] inline-flex items-center gap-1 text-[#D85A30]"><IconTrash size={14} /> ลบ</button>
              <button onClick={() => setEditing(false)} className="btn-primary h-9 px-4 ml-auto text-[13px]">เสร็จ</button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 pt-5">
              <div className="text-[13px] text-ink-3 font-medium pr-14 truncate">{name}</div>

              {/* top row — English, bold label + light value */}
              {(ticket.car || ticket.seat_no || ticket.label) && (
                <div className="flex items-center justify-between gap-3 text-[15px] mt-1.5">
                  <div className="flex items-center gap-4 min-w-0">
                    {ticket.car && <span className="whitespace-nowrap"><span className="font-semibold">Car</span> <span className="text-ink-3 font-medium ml-1">{ticket.car}</span></span>}
                    {ticket.label && <span className="text-ink-3 font-medium truncate">{ticket.label}</span>}
                  </div>
                  {ticket.seat_no && <span className="whitespace-nowrap shrink-0"><span className="font-semibold">Seat</span> <span className="text-ink-3 font-medium ml-1">{ticket.seat_no}</span></span>}
                </div>
              )}

              {/* QR */}
              <div className="mt-5 grid place-items-center">
                {ticket.qr_path ? (
                  <button onClick={onEnlarge} className="size-52 rounded-xl overflow-hidden bg-white hairline grid place-items-center" aria-label="ขยาย QR">
                    <SignedImage url={qrRef(ticket.qr_path).url} path={qrRef(ticket.qr_path).path} alt="QR" className="w-full h-full object-contain" width={600}
                      fallback={<IconQrcode size={48} className="text-ink-3" />} />
                  </button>
                ) : (
                  <div className="size-52 rounded-xl bg-surface-2 grid place-items-center text-ink-3"><IconQrcode size={48} /></div>
                )}
              </div>
              {ticket.qr_path
                ? <button onClick={onEnlarge} className="btn-link text-[12px] mt-2.5 mb-5 mx-auto flex items-center gap-1"><IconArrowUpRight size={13} /> ขยายเต็มจอเพื่อสแกน</button>
                : <div className="h-5" />}
            </div>

            {/* station strip — origin · train icon · destination, on light gray */}
            <div className="bg-surface-2 px-5 py-3.5 flex items-center gap-2 text-[14px] font-semibold">
              <span className="flex-1 truncate">{ticket.from_station || '—'}</span>
              <IconTrain size={17} className="text-brand shrink-0" />
              <span className="flex-1 truncate text-right">{ticket.to_station || '—'}</span>
            </div>
          </>
        )}

        <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPickQr} />
      </div>
    </div>,
    document.body,
  )
}
