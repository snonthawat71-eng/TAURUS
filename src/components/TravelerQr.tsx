import { useMemo, useRef, useState } from 'react'
import { IconQrcode, IconTrash, IconPlus, IconUpload, IconLoader2, IconArrowUpRight, IconTrain } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { SignedImage } from './SignedImage'
import { Lightbox } from './Lightbox'
import { uploadImage } from '@/lib/files'
import { addTrainTicket, updateTrainTicket, deleteTrainTicket } from '@/lib/tripMutations'
import { confirmDialog } from '@/lib/confirm'
import type { TrainTicket, Traveler } from '@/lib/database.types'

const qrRef = (path: string) => (/^https?:\/\//.test(path) ? { url: path } : { path })
const field = 'hairline rounded-md text-[13px] h-9 px-2.5 bg-surface w-full outline-none focus:border-brand'

/**
 * Quick-QR menu for one traveler — opened from the QR icon on their card.
 * Shows the selected QR big (tap to blow up full-screen for scanning), a
 * thumbnail strip to switch between this person's QRs, and inline fields + add.
 */
export function TravelerQr({ open, onClose, traveler, name, tickets, travelers, tripId, canEdit, onChanged }: {
  open: boolean
  onClose: () => void
  traveler: Traveler | null
  name: string
  tickets: TrainTicket[]
  travelers: Traveler[]
  tripId: string
  canEdit: boolean
  onChanged: () => void | Promise<void>
}) {
  const rows = useMemo(() => [...tickets].sort((a, b) => a.position - b.position), [tickets])
  const [selId, setSelId] = useState<string | null>(null)
  const sel = rows.find((t) => t.id === selId) ?? rows[0] ?? null
  const [lightbox, setLightbox] = useState(false)
  const [adding, setAdding] = useState(false)

  async function add() {
    if (!traveler || adding) return
    setAdding(true)
    const id = await addTrainTicket(tripId, { traveler_id: traveler.id, position: rows.length })
    await onChanged()
    setAdding(false)
    setSelId(id)
  }

  return (
    <Drawer open={open} onClose={onClose} title={`ตั๋ว / QR · ${name}`}>
      {/* switcher strip — thumbnails of this person's QRs + add */}
      {(rows.length > 1 || canEdit) && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3 pb-0.5">
          {rows.map((t) => {
            const active = t.id === sel?.id
            return (
              <button key={t.id} onClick={() => setSelId(t.id)}
                className={`shrink-0 w-16 rounded-lg p-1.5 flex flex-col items-center gap-1 hairline ${active ? 'bg-brand-soft' : 'bg-surface'}`}
                style={active ? { borderColor: 'var(--color-brand-border)' } : undefined}>
                <div className="size-9 rounded bg-white grid place-items-center overflow-hidden">
                  {t.qr_path
                    ? <SignedImage url={qrRef(t.qr_path).url} path={qrRef(t.qr_path).path} alt="QR" className="w-full h-full object-contain" width={120} fallback={<IconQrcode size={16} className="text-ink-3" />} />
                    : <IconQrcode size={16} className="text-ink-3" />}
                </div>
                <span className="text-[9px] text-ink-2 truncate w-full text-center leading-tight">{t.label || 'ตั๋ว'}</span>
              </button>
            )
          })}
          {canEdit && (
            <button onClick={add} disabled={adding}
              className="shrink-0 w-16 rounded-lg border-dashed flex flex-col items-center justify-center gap-1 text-ink-3 hover:bg-surface-2/40 disabled:opacity-50 self-stretch min-h-[68px]">
              {adding ? <IconLoader2 size={18} className="animate-spin" /> : <IconPlus size={18} />}
              <span className="text-[9px] font-medium">เพิ่ม QR</span>
            </button>
          )}
        </div>
      )}

      {sel ? (
        <TicketPanel key={sel.id} ticket={sel} travelers={travelers} tripId={tripId} canEdit={canEdit}
          onEnlarge={() => sel.qr_path && setLightbox(true)} onChanged={onChanged} onDeleted={() => setSelId(null)} />
      ) : (
        <div className="card p-8 text-center text-[13px] text-ink-3">ยังไม่มี QR{canEdit ? ' — กด “เพิ่ม QR” ด้านบน' : ''}</div>
      )}

      {lightbox && sel?.qr_path && (
        <Lightbox photos={[qrRef(sel.qr_path)]} alt="QR ตั๋ว" onClose={() => setLightbox(false)} />
      )}
    </Drawer>
  )
}

/** The selected QR shown big for scanning + its details (editable). */
function TicketPanel({ ticket, travelers, tripId, canEdit, onEnlarge, onChanged, onDeleted }: {
  ticket: TrainTicket
  travelers: Traveler[]
  tripId: string
  canEdit: boolean
  onEnlarge: () => void
  onChanged: () => void | Promise<void>
  onDeleted: () => void
}) {
  const [travelerId, setTravelerId] = useState(ticket.traveler_id ?? '')
  const [label, setLabel] = useState(ticket.label ?? '')
  const [from, setFrom] = useState(ticket.from_station ?? '')
  const [to, setTo] = useState(ticket.to_station ?? '')
  const [seat, setSeat] = useState(ticket.seat_no ?? '')
  const [car, setCar] = useState(ticket.car ?? '')
  const [gate, setGate] = useState(ticket.gate ?? '')
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
    if (!(await confirmDialog({ message: `ลบ "${ticket.label || 'ตั๋ว'}"?`, danger: true, confirmLabel: 'ลบ' }))) return
    await deleteTrainTicket(ticket.id)
    onDeleted()
    await onChanged()
  }

  return (
    <div>
      {/* big QR — tap to blow up full-screen for the scanner */}
      <div className="grid place-items-center">
        {ticket.qr_path ? (
          <button onClick={onEnlarge} className="size-60 max-w-full rounded-xl overflow-hidden bg-white hairline grid place-items-center" aria-label="ขยาย QR">
            <SignedImage url={qrRef(ticket.qr_path).url} path={qrRef(ticket.qr_path).path} alt="QR" className="w-full h-full object-contain" width={700}
              fallback={<IconQrcode size={48} className="text-ink-3" />} />
          </button>
        ) : canEdit ? (
          <button onClick={() => fileInput.current?.click()} disabled={uploading}
            className="size-60 max-w-full rounded-xl bg-surface-2 hairline grid place-items-center text-ink-3 disabled:opacity-50">
            {uploading ? <IconLoader2 size={28} className="animate-spin" /> : <span className="flex flex-col items-center gap-1.5"><IconUpload size={26} /><span className="text-[12px]">อัปโหลด QR</span></span>}
          </button>
        ) : (
          <div className="size-60 max-w-full rounded-xl bg-surface-2 grid place-items-center text-ink-3"><IconQrcode size={48} /></div>
        )}
      </div>
      <div className="flex items-center justify-center gap-4 mt-2.5">
        {ticket.qr_path && <button onClick={onEnlarge} className="btn-link text-[12px] flex items-center gap-1"><IconArrowUpRight size={13} /> ขยายเต็มจอ</button>}
        {canEdit && ticket.qr_path && <button onClick={() => fileInput.current?.click()} disabled={uploading} className="btn-link text-[12px] disabled:opacity-50">{uploading ? 'กำลังอัป…' : 'เปลี่ยน QR'}</button>}
      </div>

      {canEdit ? (
        <div className="mt-4 pt-4 space-y-2.5" style={{ borderTop: '0.5px solid var(--color-line)' }}>
          {travelers.length > 0 && (
            <select className={field} value={travelerId}
              onChange={(e) => { setTravelerId(e.target.value); persist({ traveler_id: e.target.value || null }) }}>
              <option value="">— ระบุผู้โดยสาร —</option>
              {travelers.map((tv) => <option key={tv.id} value={tv.id}>{tv.nickname ?? 'ผู้เดินทาง'}</option>)}
            </select>
          )}
          <input className={field} value={label} placeholder="ชื่อรายการ (เช่น Airport Express)" onChange={(e) => setLabel(e.target.value)} onBlur={() => persist({ label: label.trim() || null })} />
          <div className="grid grid-cols-2 gap-2">
            <input className={field} value={from} placeholder="สถานีต้นทาง" onChange={(e) => setFrom(e.target.value)} onBlur={() => persist({ from_station: from.trim() || null })} />
            <input className={field} value={to} placeholder="สถานีปลายทาง" onChange={(e) => setTo(e.target.value)} onBlur={() => persist({ to_station: to.trim() || null })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input className={field} value={car} placeholder="Car" onChange={(e) => setCar(e.target.value)} onBlur={() => persist({ car: car.trim() || null })} />
            <input className={field} value={gate} placeholder="Gate" onChange={(e) => setGate(e.target.value)} onBlur={() => persist({ gate: gate.trim() || null })} />
            <input className={field} value={seat} placeholder="Seat" onChange={(e) => setSeat(e.target.value)} onBlur={() => persist({ seat_no: seat.trim() || null })} />
          </div>
          <button onClick={remove} className="text-[12px] inline-flex items-center gap-1 text-[#D85A30] pt-1"><IconTrash size={14} /> ลบรายการนี้</button>
        </div>
      ) : (
        <>
          {(ticket.car || ticket.gate || ticket.seat_no) && (
            <div className="mt-4 flex items-center justify-between gap-3 text-[14px]">
              <div className="flex items-center gap-4">
                {ticket.car && <span><span className="font-semibold">Car</span> <span className="text-ink-3 font-medium ml-1">{ticket.car}</span></span>}
                {ticket.gate && <span><span className="font-semibold">Gate</span> <span className="text-ink-3 font-medium ml-1">{ticket.gate}</span></span>}
              </div>
              {ticket.seat_no && <span><span className="font-semibold">Seat</span> <span className="text-ink-3 font-medium ml-1">{ticket.seat_no}</span></span>}
            </div>
          )}
          {(ticket.from_station || ticket.to_station) && (
            <div className="bg-surface-2 rounded-lg px-4 py-3 mt-4 flex items-center gap-2 text-[14px] font-semibold">
              <span className="flex-1 truncate">{ticket.from_station || '—'}</span>
              <IconTrain size={17} className="text-brand shrink-0" />
              <span className="flex-1 truncate text-right">{ticket.to_station || '—'}</span>
            </div>
          )}
        </>
      )}

      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPickQr} />
    </div>
  )
}
