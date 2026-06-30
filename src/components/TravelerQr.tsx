import { useMemo, useRef, useState } from 'react'
import { IconQrcode, IconTrash, IconPlus, IconUpload, IconLoader2, IconTrain, IconStar, IconStarFilled, IconCheck, IconCircle, IconPencil, IconZoomScan, IconChevronLeft, IconBuildingCarousel, IconDeviceMobile } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { SignedImage } from './SignedImage'
import { Lightbox } from './Lightbox'
import { uploadImage } from '@/lib/files'
import { addTrainTicket, updateTrainTicket, deleteTrainTicket } from '@/lib/tripMutations'
import { confirmDialog } from '@/lib/confirm'
import type { TrainTicket } from '@/lib/database.types'

const qrRef = (path: string) => (/^https?:\/\//.test(path) ? { url: path } : { path })
const field = 'hairline rounded-md text-[13px] h-9 px-2.5 bg-surface w-full outline-none focus:border-brand'

// QR types — fields + display adapt to the chosen kind
const KINDS = [
  { key: 'train', label: 'ตั๋วรถไฟ', icon: IconTrain, labelPh: 'ชื่อรายการ (เช่น Airport Express)' },
  { key: 'park', label: 'สวนสนุก', icon: IconBuildingCarousel, labelPh: 'ชื่อสวนสนุก (เช่น Disneyland)', notePh: 'รายละเอียด (วันที่ / รอบ / โซน)' },
  { key: 'esim', label: 'eSIM', icon: IconDeviceMobile, labelPh: 'ผู้ให้บริการ / แพ็กเกจ', notePh: 'รายละเอียด (ดาต้า / วันหมดอายุ)' },
  { key: 'other', label: 'อื่นๆ', icon: IconQrcode, labelPh: 'ชื่อรายการ', notePh: 'รายละเอียด' },
] as const
const kindMeta = (k: string | null) => KINDS.find((x) => x.key === k) ?? KINDS[0]

/**
 * Quick-QR hub for one traveler (the card already separates QRs per person).
 * Dropdown picks the QR; the pencil/+ open a separate edit page where the QR type
 * (train / park / eSIM / …) drives which detail fields show.
 */
export function TravelerQr({ open, onClose, name, tickets, tripId, traveler, canEdit, onChanged }: {
  open: boolean
  onClose: () => void
  name: string
  tickets: TrainTicket[]
  tripId: string
  traveler: { id: string } | null
  canEdit: boolean
  onChanged: () => void | Promise<void>
}) {
  const rows = useMemo(() => [...tickets].sort((a, b) => a.position - b.position), [tickets])
  const mainId = rows.find((r) => r.is_main)?.id ?? rows[0]?.id ?? null
  const [selId, setSelId] = useState<string | null>(null)
  const curId = (selId && rows.some((r) => r.id === selId)) ? selId : mainId
  const sel = rows.find((t) => t.id === curId) ?? null
  const [editMode, setEditMode] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)

  function close() { setEditMode(false); onClose() }

  async function add() {
    if (!traveler || adding) return
    setAdding(true)
    const id = await addTrainTicket(tripId, { traveler_id: traveler.id, position: rows.length, is_main: rows.length === 0, kind: 'train' })
    await onChanged()
    setAdding(false)
    setSelId(id)
    setEditMode(true)
  }
  async function toggleMain(t: TrainTicket) {
    setBusy(true)
    if (t.is_main) await updateTrainTicket(t.id, { is_main: false })
    else await Promise.all(rows.map((r) => updateTrainTicket(r.id, { is_main: r.id === t.id })))
    await onChanged()
    setBusy(false)
  }
  async function toggleUsed(t: TrainTicket) {
    setBusy(true)
    await updateTrainTicket(t.id, { used: !t.used })
    await onChanged()
    setBusy(false)
  }

  return (
    <Drawer open={open} onClose={close} title={editMode && sel ? 'แก้ไข QR' : `Quick QR · ${name}`}>
      {editMode && sel ? (
        <QrEditPage key={sel.id} ticket={sel} tripId={tripId}
          onBack={() => setEditMode(false)} onChanged={onChanged}
          onDeleted={() => { setSelId(null); setEditMode(false) }} />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <select className={`${field} flex-1`} value={curId ?? ''} onChange={(e) => setSelId(e.target.value)} disabled={rows.length === 0}>
              {rows.length === 0 && <option value="">— ยังไม่มี QR —</option>}
              {rows.map((t) => (
                <option key={t.id} value={t.id}>{(t.is_main ? '★ ' : '') + (t.label || kindMeta(t.kind).label) + (t.used ? ' · ใช้แล้ว' : '')}</option>
              ))}
            </select>
            {canEdit && (
              <>
                <button onClick={add} disabled={adding} className="btn-icon shrink-0" aria-label="เพิ่ม QR" title="เพิ่ม QR">
                  {adding ? <IconLoader2 size={16} className="animate-spin" /> : <IconPlus size={16} />}
                </button>
                {sel && <button onClick={() => setEditMode(true)} className="btn-icon shrink-0" aria-label="แก้ไข" title="แก้ไข"><IconPencil size={16} /></button>}
              </>
            )}
          </div>

          {sel ? (
            <>
              <QrView ticket={sel} onEnlarge={() => sel.qr_path && setLightbox(true)} />
              {canEdit && (
                <div className="flex items-center justify-between gap-3 pt-3" style={{ borderTop: '0.5px solid var(--color-line)' }}>
                  <button onClick={() => toggleMain(sel)} disabled={busy} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
                    {sel.is_main ? <IconStarFilled size={14} className="text-brand" /> : <IconStar size={14} />} {sel.is_main ? 'QR หลัก' : 'ตั้งเป็น QR หลัก'}
                  </button>
                  <button onClick={() => toggleUsed(sel)} disabled={busy} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
                    {sel.used ? <IconCheck size={14} className="text-brand" /> : <IconCircle size={14} />} {sel.used ? 'ใช้แล้ว' : 'ทำเครื่องหมายว่าใช้แล้ว'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="card p-8 text-center text-[13px] text-ink-3">ยังไม่มี QR{canEdit ? ' — กด “+” เพื่อเพิ่ม' : ''}</div>
          )}
        </div>
      )}

      {lightbox && sel?.qr_path && (
        <Lightbox photos={[qrRef(sel.qr_path)]} alt="QR" onClose={() => setLightbox(false)} />
      )}
    </Drawer>
  )
}

/** Boarding-pass display — detail layout depends on the QR type. */
function QrView({ ticket, onEnlarge }: { ticket: TrainTicket; onEnlarge: () => void }) {
  const meta = kindMeta(ticket.kind)
  const isTrain = (ticket.kind ?? 'train') === 'train'
  return (
    <div className={ticket.used ? 'opacity-60' : undefined}>
      <div className="flex items-start justify-center gap-3">
        {ticket.qr_path ? (
          <button onClick={onEnlarge} className="size-56 max-w-full rounded-xl overflow-hidden bg-white hairline grid place-items-center" aria-label="ขยาย QR">
            <SignedImage url={qrRef(ticket.qr_path).url} path={qrRef(ticket.qr_path).path} alt="QR" className="w-full h-full object-contain" width={700}
              fallback={<IconQrcode size={48} className="text-ink-3" />} />
          </button>
        ) : (
          <div className="size-56 max-w-full rounded-xl bg-surface-2 grid place-items-center text-ink-3"><IconQrcode size={48} /></div>
        )}
        {ticket.qr_path && (
          <button onClick={onEnlarge} className="text-ink-3 hover:text-ink-2 pt-1" aria-label="ขยายเต็มจอ" title="ขยายเต็มจอ"><IconZoomScan size={20} /></button>
        )}
      </div>

      {/* type chip */}
      <div className="flex items-center justify-center gap-1.5 mt-4 text-[12px] font-medium text-ink-3">
        <meta.icon size={14} /> {meta.label}
      </div>

      {isTrain ? (
        <>
          {(ticket.car || ticket.gate || ticket.seat_no) && (
            <div className="flex items-center justify-between gap-3 text-[14px] mt-3">
              <div className="flex items-center gap-4">
                {ticket.car && <span><span className="font-semibold">Car</span> <span className="text-ink-3 font-medium ml-1">{ticket.car}</span></span>}
                {ticket.gate && <span><span className="font-semibold">Gate</span> <span className="text-ink-3 font-medium ml-1">{ticket.gate}</span></span>}
              </div>
              {ticket.seat_no && <span><span className="font-semibold">Seat</span> <span className="text-ink-3 font-medium ml-1">{ticket.seat_no}</span></span>}
            </div>
          )}
          {(ticket.from_station || ticket.to_station) && (
            <div className="bg-surface-2 rounded-lg px-4 py-3 mt-3 flex items-center gap-2 text-[14px] font-semibold">
              <span className="flex-1 truncate">{ticket.from_station || '—'}</span>
              <IconTrain size={17} className="text-brand shrink-0" />
              <span className="flex-1 truncate text-right">{ticket.to_station || '—'}</span>
            </div>
          )}
        </>
      ) : (
        <div className="text-center mt-3">
          {ticket.label && <div className="text-[15px] font-semibold">{ticket.label}</div>}
          {ticket.note && <div className="text-[13px] text-ink-2 mt-1 whitespace-pre-wrap">{ticket.note}</div>}
        </div>
      )}
    </div>
  )
}

/** Separate edit page — type selector drives which fields show. */
function QrEditPage({ ticket, tripId, onBack, onChanged, onDeleted }: {
  ticket: TrainTicket
  tripId: string
  onBack: () => void
  onChanged: () => void | Promise<void>
  onDeleted: () => void
}) {
  const [kind, setKind] = useState(ticket.kind ?? 'train')
  const [label, setLabel] = useState(ticket.label ?? '')
  const [note, setNote] = useState(ticket.note ?? '')
  const [from, setFrom] = useState(ticket.from_station ?? '')
  const [to, setTo] = useState(ticket.to_station ?? '')
  const [seat, setSeat] = useState(ticket.seat_no ?? '')
  const [car, setCar] = useState(ticket.car ?? '')
  const [gate, setGate] = useState(ticket.gate ?? '')
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const meta = kindMeta(kind)

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
    if (!(await confirmDialog({ message: `ลบ "${ticket.label || 'QR'}"?`, danger: true, confirmLabel: 'ลบ' }))) return
    await deleteTrainTicket(ticket.id)
    onDeleted()
    await onChanged()
  }

  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink mb-4">
        <IconChevronLeft size={16} /> กลับ
      </button>

      <div className="flex items-center gap-3">
        <div className="size-20 rounded-md overflow-hidden bg-white hairline grid place-items-center shrink-0">
          {ticket.qr_path
            ? <SignedImage url={qrRef(ticket.qr_path).url} path={qrRef(ticket.qr_path).path} alt="QR" className="w-full h-full object-contain" width={200} fallback={<IconQrcode size={24} className="text-ink-3" />} />
            : <IconQrcode size={24} className="text-ink-3" />}
        </div>
        <button onClick={() => fileInput.current?.click()} disabled={uploading} className="btn-icon !w-auto px-3 gap-1.5 text-[12px] disabled:opacity-50">
          {uploading ? <IconLoader2 size={14} className="animate-spin" /> : <IconUpload size={14} />} {ticket.qr_path ? 'เปลี่ยน QR' : 'อัปโหลด QR'}
        </button>
      </div>

      <div className="space-y-2.5 mt-5">
        {/* QR type */}
        <select className={field} value={kind} onChange={(e) => { setKind(e.target.value); persist({ kind: e.target.value }) }}>
          {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </select>

        <input className={field} value={label} placeholder={meta.labelPh} onChange={(e) => setLabel(e.target.value)} onBlur={() => persist({ label: label.trim() || null })} />

        {kind === 'train' ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <input className={field} value={from} placeholder="สถานีต้นทาง" onChange={(e) => setFrom(e.target.value)} onBlur={() => persist({ from_station: from.trim() || null })} />
              <input className={field} value={to} placeholder="สถานีปลายทาง" onChange={(e) => setTo(e.target.value)} onBlur={() => persist({ to_station: to.trim() || null })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input className={field} value={car} placeholder="Car" onChange={(e) => setCar(e.target.value)} onBlur={() => persist({ car: car.trim() || null })} />
              <input className={field} value={gate} placeholder="Gate" onChange={(e) => setGate(e.target.value)} onBlur={() => persist({ gate: gate.trim() || null })} />
              <input className={field} value={seat} placeholder="Seat" onChange={(e) => setSeat(e.target.value)} onBlur={() => persist({ seat_no: seat.trim() || null })} />
            </div>
          </>
        ) : (
          <textarea className="hairline rounded-md text-[13px] px-2.5 py-2 bg-surface w-full outline-none focus:border-brand resize-none" rows={3}
            value={note} placeholder={'notePh' in meta ? meta.notePh : 'รายละเอียด'}
            onChange={(e) => setNote(e.target.value)} onBlur={() => persist({ note: note.trim() || null })} />
        )}
      </div>

      <div className="flex items-center justify-between gap-3 mt-5 pt-4" style={{ borderTop: '0.5px solid var(--color-line)' }}>
        <button onClick={remove} className="text-[12px] inline-flex items-center gap-1 text-[#D85A30]"><IconTrash size={14} /> ลบรายการนี้</button>
        <button onClick={onBack} className="btn-primary h-9 px-5 text-[13px]">เสร็จ</button>
      </div>

      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPickQr} />
    </div>
  )
}
