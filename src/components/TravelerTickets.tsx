import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconQrcode, IconTrash, IconPlus, IconUpload, IconLoader2, IconX,
  IconArrowUpRight, IconTrain, IconChevronDown, IconCheck,
} from '@tabler/icons-react'
import { SignedImage } from './SignedImage'
import { Lightbox } from './Lightbox'
import { uploadImage } from '@/lib/files'
import { addTrainTicket, updateTrainTicket, deleteTrainTicket } from '@/lib/tripMutations'
import { confirmDialog } from '@/lib/confirm'
import type { TrainTicket, Traveler } from '@/lib/database.types'

const qrRef = (path: string) => (/^https?:\/\//.test(path) ? { url: path } : { path })
const field = 'hairline rounded-md text-[13px] h-9 px-2.5 bg-surface w-full outline-none focus:border-brand'

/** The label dropdown — switch between this person's QR items (or add one). */
function QrMenu({ tickets, selId, onSelect, canEdit, onAdd, className }: {
  tickets: TrainTicket[]
  selId: string
  onSelect: (id: string) => void
  canEdit: boolean
  onAdd: () => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const sel = tickets.find((t) => t.id === selId)

  function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos({ left: r.left, top: r.bottom + 4 })
    setOpen((v) => !v)
  }

  return (
    <>
      <span ref={ref} onClick={toggle} role="button" tabIndex={0}
        className={`inline-flex items-center gap-1 cursor-pointer select-none max-w-full ${className ?? ''}`}>
        <span className="truncate">{sel?.label || 'ตั๋ว'}</span>
        <IconChevronDown size={13} className={`shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </span>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[115]" onClick={(e) => { e.stopPropagation(); setOpen(false) }} />
          <div className="fixed z-[116] card p-1 shadow-lg w-52 max-h-[60vh] overflow-y-auto"
            style={{ left: pos.left, top: pos.top }} onClick={(e) => e.stopPropagation()}>
            {tickets.map((t) => (
              <button key={t.id} onClick={(e) => { e.stopPropagation(); setOpen(false); onSelect(t.id) }}
                className="w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-[13px] text-ink-2 hover:bg-surface-2 text-left">
                <IconQrcode size={14} className="shrink-0 text-brand" />
                <span className="truncate flex-1">{t.label || 'ตั๋ว'}</span>
                {t.id === selId && <IconCheck size={14} className="text-brand shrink-0" />}
              </button>
            ))}
            {canEdit && (
              <button onClick={(e) => { e.stopPropagation(); setOpen(false); onAdd() }}
                className="w-full flex items-center gap-2 px-2.5 h-9 mt-0.5 rounded-md text-[13px] text-brand-mid hover:bg-brand-soft text-left"
                style={{ borderTop: '0.5px solid var(--color-line)' }}>
                <IconPlus size={14} /> เพิ่ม QR
              </button>
            )}
          </div>
        </>,
        document.body,
      )}
    </>
  )
}

/**
 * One QR tile beside a traveler's name card. Shows a single QR with a label
 * dropdown to switch between this person's QR items (works on the tile AND inside
 * the detail). Adding a QR lives inside that dropdown, so it never reshapes the
 * traveler card on the left.
 */
export function TravelerTickets({ traveler, name, tickets, travelers, tripId, canEdit, onChanged }: {
  traveler: Traveler
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
  const [detailOpen, setDetailOpen] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [adding, setAdding] = useState(false)

  async function add() {
    if (adding) return
    setAdding(true)
    const id = await addTrainTicket(tripId, { traveler_id: traveler.id, position: rows.length })
    await onChanged()
    setAdding(false)
    setSelId(id)
    setDetailOpen(true) // open so the new QR's details can be filled in
  }

  if (!sel && !canEdit) return null

  // zero state — a fixed-width add tile (never squeezes the name card)
  if (!sel) {
    return (
      <button onClick={add} disabled={adding}
        className="card border-dashed w-[132px] shrink-0 flex flex-col items-center justify-center gap-1.5 text-ink-3 hover:bg-surface-2/40 disabled:opacity-50">
        <div className="size-8 rounded-full bg-brand-soft grid place-items-center text-brand">
          {adding ? <IconLoader2 size={16} className="animate-spin" /> : <IconPlus size={18} />}
        </div>
        <span className="text-[9px] font-semibold tracking-wide">ADD TICKET</span>
      </button>
    )
  }

  return (
    <>
      <div className="card w-[132px] shrink-0 p-2.5 flex flex-col items-center gap-2">
        <QrMenu tickets={rows} selId={sel.id} onSelect={setSelId} canEdit={canEdit} onAdd={add}
          className="text-[11px] font-medium text-ink-2 w-full justify-center" />
        <button onClick={() => setDetailOpen(true)} aria-label="ดูตั๋ว"
          className="size-16 rounded-md overflow-hidden bg-white hairline grid place-items-center">
          {sel.qr_path
            ? <SignedImage url={qrRef(sel.qr_path).url} path={qrRef(sel.qr_path).path} alt="QR" className="w-full h-full object-contain" width={200} fallback={<IconQrcode size={24} className="text-ink-3" />} />
            : <IconQrcode size={24} className="text-ink-3" />}
        </button>
      </div>

      {detailOpen && sel && (
        <TicketDetail key={sel.id} ticket={sel} tickets={rows} name={name} travelers={travelers} tripId={tripId} canEdit={canEdit}
          onSelect={setSelId} onAdd={add}
          onClose={() => setDetailOpen(false)} onEnlarge={() => sel.qr_path && setLightbox(true)} onChanged={onChanged} />
      )}
      {lightbox && sel?.qr_path && (
        <Lightbox photos={[qrRef(sel.qr_path)]} alt="QR ตั๋ว" onClose={() => setLightbox(false)} />
      )}
    </>
  )
}

/** Detail card: switch QR (dropdown), fill details, enlarge for scanning. */
function TicketDetail({
  ticket, tickets, name, travelers, tripId, canEdit, onSelect, onAdd, onClose, onEnlarge, onChanged,
}: {
  ticket: TrainTicket
  tickets: TrainTicket[]
  name: string
  travelers: Traveler[]
  tripId: string
  canEdit: boolean
  onSelect: (id: string) => void
  onAdd: () => void
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
    if (!(await confirmDialog({ message: `ลบ "${ticket.label || 'ตั๋ว'}" ของ ${name}?`, danger: true, confirmLabel: 'ลบ' }))) return
    await deleteTrainTicket(ticket.id)
    await onChanged()
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[105] grid place-items-center p-5 bg-black/45" onClick={onClose}>
      <div className="w-full max-w-[360px] card p-0 overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="ปิด" className="absolute top-2.5 right-2.5 z-10 btn-icon !size-8 !border-0 text-ink-3"><IconX size={18} /></button>

        {/* header: passenger + QR-label dropdown */}
        <div className="px-5 pt-5 pr-14">
          <div className="text-[11px] text-ink-3 font-medium truncate">{name}</div>
          <QrMenu tickets={tickets} selId={ticket.id} onSelect={onSelect} canEdit={canEdit} onAdd={onAdd}
            className="text-[17px] font-semibold mt-0.5" />
        </div>

        {/* QR */}
        <div className="px-5 mt-4 grid place-items-center">
          {ticket.qr_path ? (
            <button onClick={onEnlarge} className="size-48 rounded-xl overflow-hidden bg-white hairline grid place-items-center" aria-label="ขยาย QR">
              <SignedImage url={qrRef(ticket.qr_path).url} path={qrRef(ticket.qr_path).path} alt="QR" className="w-full h-full object-contain" width={600}
                fallback={<IconQrcode size={44} className="text-ink-3" />} />
            </button>
          ) : canEdit ? (
            <button onClick={() => fileInput.current?.click()} disabled={uploading}
              className="size-48 rounded-xl bg-surface-2 hairline grid place-items-center text-ink-3 disabled:opacity-50">
              {uploading ? <IconLoader2 size={26} className="animate-spin" /> : <span className="flex flex-col items-center gap-1.5"><IconUpload size={24} /><span className="text-[12px]">อัปโหลด QR</span></span>}
            </button>
          ) : (
            <div className="size-48 rounded-xl bg-surface-2 grid place-items-center text-ink-3"><IconQrcode size={44} /></div>
          )}
        </div>
        <div className="px-5 mt-2.5 flex items-center justify-center gap-4">
          {ticket.qr_path && <button onClick={onEnlarge} className="btn-link text-[12px] flex items-center gap-1"><IconArrowUpRight size={13} /> ขยายเต็มจอ</button>}
          {canEdit && ticket.qr_path && <button onClick={() => fileInput.current?.click()} disabled={uploading} className="btn-link text-[12px] disabled:opacity-50">{uploading ? 'กำลังอัป…' : 'เปลี่ยน QR'}</button>}
        </div>

        {canEdit ? (
          /* fill-in details */
          <div className="px-5 py-4 mt-3 space-y-2.5" style={{ borderTop: '0.5px solid var(--color-line)' }}>
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
              <div className="px-5 mt-4 flex items-center justify-between gap-3 text-[14px]">
                <div className="flex items-center gap-4">
                  {ticket.car && <span><span className="font-semibold">Car</span> <span className="text-ink-3 font-medium ml-1">{ticket.car}</span></span>}
                  {ticket.gate && <span><span className="font-semibold">Gate</span> <span className="text-ink-3 font-medium ml-1">{ticket.gate}</span></span>}
                </div>
                {ticket.seat_no && <span><span className="font-semibold">Seat</span> <span className="text-ink-3 font-medium ml-1">{ticket.seat_no}</span></span>}
              </div>
            )}
            <div className="bg-surface-2 px-5 py-3.5 mt-4 flex items-center gap-2 text-[14px] font-semibold">
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
