import { useEffect, useMemo, useRef, useState } from 'react'
import { IconQrcode, IconTrash, IconPlus, IconUpload, IconLoader2, IconTrain, IconStar, IconStarFilled, IconCheck, IconCircle, IconPencil, IconChevronLeft, IconBuildingCarousel, IconDeviceMobile } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { SignedImage } from './SignedImage'
import { Lightbox } from './Lightbox'
import { uploadImage } from '@/lib/files'
import { addTrainTicket, updateTrainTicket, deleteTrainTicket } from '@/lib/tripMutations'
import { confirmDialog } from '@/lib/confirm'
import type { TrainTicket } from '@/lib/database.types'

const qrRef = (path: string) => (/^https?:\/\//.test(path) ? { url: path } : { path })
const field = 'hairline rounded-md text-[13px] h-9 px-2.5 bg-surface w-full outline-none focus:border-brand'

const KINDS = [
  { key: 'train', label: 'ตั๋วรถไฟ', icon: IconTrain, labelPh: 'ชื่อรายการ (เช่น Airport Express)' },
  { key: 'park', label: 'สวนสนุก', icon: IconBuildingCarousel, labelPh: 'ชื่อสวนสนุก (เช่น Disneyland)', notePh: 'รายละเอียด (วันที่ / รอบ / โซน)' },
  { key: 'esim', label: 'eSIM', icon: IconDeviceMobile, labelPh: 'ผู้ให้บริการ / แพ็กเกจ', notePh: 'รายละเอียด (ดาต้า / วันหมดอายุ)' },
  { key: 'other', label: 'อื่นๆ', icon: IconQrcode, labelPh: 'ชื่อรายการ', notePh: 'รายละเอียด' },
] as const
const kindMeta = (k: string | null) => KINDS.find((x) => x.key === k) ?? KINDS[0]

/**
 * Quick-QR hub for one traveler. Swipe left/right to flip between their QRs
 * (the main QR shows first). Each card: a main-QR toggle on top, the QR centered,
 * a grey details box, and a "used" button below. The pencil opens a separate edit page.
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
  // local copy so toggles feel instant (optimistic); kept in a STABLE order so the
  // strip never reshuffles mid-use
  const [localTickets, setLocalTickets] = useState(tickets)
  useEffect(() => { setLocalTickets(tickets) }, [tickets])
  const rows = useMemo(() => [...localTickets].sort((a, b) => a.position - b.position), [localTickets])
  const [selId, setSelId] = useState<string | null>(null)
  const curId = (selId && rows.some((r) => r.id === selId)) ? selId : (rows[0]?.id ?? null)
  const sel = rows.find((t) => t.id === curId) ?? null
  const [editMode, setEditMode] = useState(false)
  const [lbPath, setLbPath] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  // on open → jump to the main QR (order stays put, so nothing swaps mid-use)
  useEffect(() => {
    if (!open || rows.length === 0) return
    const i = Math.max(0, rows.findIndex((r) => r.is_main))
    requestAnimationFrame(() => {
      const el = scroller.current
      if (!el) return
      el.scrollLeft = i * el.clientWidth
      setSelId(rows[i]?.id ?? null)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function close() { setEditMode(false); onClose() }

  function onScroll() {
    const el = scroller.current
    if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    const id = rows[i]?.id
    if (id && id !== curId) setSelId(id)
  }

  async function add() {
    if (!traveler || adding) return
    setAdding(true)
    const id = await addTrainTicket(tripId, { traveler_id: traveler.id, position: rows.length, is_main: rows.length === 0, kind: 'train' })
    await onChanged()
    setAdding(false)
    setSelId(id)
    setEditMode(true)
  }
  function toggleMain(t: TrainTicket) {
    const on = !t.is_main
    // optimistic: only one main at a time
    setLocalTickets((prev) => prev.map((x) => ({ ...x, is_main: on ? x.id === t.id : (x.id === t.id ? false : !!x.is_main) })))
    const writes = on ? rows.map((r) => updateTrainTicket(r.id, { is_main: r.id === t.id })) : [updateTrainTicket(t.id, { is_main: false })]
    Promise.all(writes).then(() => onChanged())
  }
  function toggleUsed(t: TrainTicket) {
    setLocalTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, used: !x.used } : x)))
    updateTrainTicket(t.id, { used: !t.used }).then(() => onChanged())
  }

  return (
    <Drawer open={open} onClose={close} title={editMode && sel ? 'แก้ไข QR' : `Quick QR · ${name}`}>
      {editMode && sel ? (
        <QrEditPage key={sel.id} ticket={sel} tripId={tripId}
          onBack={() => setEditMode(false)} onChanged={onChanged}
          onDeleted={() => { setSelId(null); setEditMode(false) }} />
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-end gap-1 mb-3">
          {canEdit && (
            <button onClick={add} disabled={adding} className="btn-icon" aria-label="เพิ่ม QR" title="เพิ่ม QR">
              {adding ? <IconLoader2 size={16} className="animate-spin" /> : <IconPlus size={16} />}
            </button>
          )}
          <div className="w-full card p-8 text-center text-[13px] text-ink-3">ยังไม่มี QR{canEdit ? ' — กด “+” เพื่อเพิ่ม' : ''}</div>
        </div>
      ) : (
        <div>
          {/* header: current label + add / edit */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-[13px] font-medium text-ink-2 truncate flex items-center gap-1.5 min-w-0">
              {(() => { const M = kindMeta(sel?.kind ?? null).icon; return <M size={14} className="shrink-0" /> })()}
              <span className="truncate">{sel?.label || kindMeta(sel?.kind ?? null).label}</span>
            </div>
            {canEdit && (
              <div className="flex gap-1 shrink-0">
                <button onClick={add} disabled={adding} className="btn-icon" aria-label="เพิ่ม QR" title="เพิ่ม QR">
                  {adding ? <IconLoader2 size={16} className="animate-spin" /> : <IconPlus size={16} />}
                </button>
                {sel && <button onClick={() => setEditMode(true)} className="btn-icon" aria-label="แก้ไข" title="แก้ไข"><IconPencil size={16} /></button>}
              </div>
            )}
          </div>

          {/* swipeable cards */}
          <div ref={scroller} onScroll={onScroll} className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar">
            {rows.map((t) => (
              <div key={t.id} className="w-full shrink-0 snap-center px-0.5">
                <QrSlide ticket={t} canEdit={canEdit}
                  onToggleMain={() => toggleMain(t)} onToggleUsed={() => toggleUsed(t)}
                  onEnlarge={() => t.qr_path && setLbPath(t.qr_path)} />
              </div>
            ))}
          </div>

          {/* dots */}
          {rows.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-4">
              {rows.map((t) => (
                <span key={t.id} className="size-1.5 rounded-full transition-colors"
                  style={{ background: t.id === curId ? 'var(--color-brand)' : 'var(--color-line-2)' }} />
              ))}
            </div>
          )}
        </div>
      )}

      {lbPath && <Lightbox photos={[qrRef(lbPath)]} alt="QR" onClose={() => setLbPath(null)} />}
    </Drawer>
  )
}

/** One swipeable QR card. */
function QrSlide({ ticket, canEdit, onToggleMain, onToggleUsed, onEnlarge }: {
  ticket: TrainTicket
  canEdit: boolean
  onToggleMain: () => void
  onToggleUsed: () => void
  onEnlarge: () => void
}) {
  const meta = kindMeta(ticket.kind)
  const isTrain = (ticket.kind ?? 'train') === 'train'
  return (
    <div className={ticket.used ? 'opacity-60' : undefined}>
      {/* main toggle — top centre, above the QR */}
      {canEdit && (
        <div className="flex justify-center mb-3">
          <button onClick={onToggleMain}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[12px] font-medium"
            style={ticket.is_main
              ? { background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }
              : { border: '0.5px solid var(--color-line)', color: 'var(--color-ink-2)' }}>
            {ticket.is_main ? <IconStarFilled size={13} /> : <IconStar size={13} />} {ticket.is_main ? 'QR หลัก' : 'ตั้งเป็น QR หลัก'}
          </button>
        </div>
      )}

      {/* QR — centred, tap to enlarge */}
      <div className="grid place-items-center">
        {ticket.qr_path ? (
          <button onClick={onEnlarge} className="size-56 max-w-full rounded-xl overflow-hidden bg-white hairline grid place-items-center" aria-label="ขยาย QR">
            <SignedImage url={qrRef(ticket.qr_path).url} path={qrRef(ticket.qr_path).path} alt="QR" className="w-full h-full object-contain" width={700}
              fallback={<IconQrcode size={48} className="text-ink-3" />} />
          </button>
        ) : (
          <div className="size-56 max-w-full rounded-xl bg-surface-2 grid place-items-center text-ink-3"><IconQrcode size={48} /></div>
        )}
      </div>

      {/* details box — light brand blue */}
      <div className="bg-brand-soft rounded-lg p-3.5 mt-4 text-[13px]">
        {isTrain ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <span className="flex-1 truncate">{ticket.from_station || '—'}</span>
              <IconTrain size={16} className="text-brand shrink-0" />
              <span className="flex-1 truncate text-right">{ticket.to_station || '—'}</span>
            </div>
            <div className="flex items-center justify-between text-ink-2">
              <span><span className="text-ink-3">Car</span> {ticket.car || '-'}</span>
              <span><span className="text-ink-3">Gate</span> {ticket.gate || '-'}</span>
              <span><span className="text-ink-3">Seat</span> {ticket.seat_no || '-'}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="font-semibold flex items-center gap-1.5"><meta.icon size={14} className="text-ink-3" /> {ticket.label || meta.label}</div>
            <div className="text-ink-2 mt-1 whitespace-pre-wrap">{ticket.note || <span className="text-ink-3">ไม่มีรายละเอียด</span>}</div>
          </>
        )}
      </div>

      {/* used — below */}
      {canEdit && (
        <button onClick={onToggleUsed}
          className="w-full h-10 rounded-md mt-4 text-[13px] font-medium flex items-center justify-center gap-1.5"
          style={ticket.used
            ? { background: 'var(--color-surface-2)', color: 'var(--color-ink-2)' }
            : { border: '0.5px solid var(--color-line)', color: 'var(--color-ink-2)' }}>
          {ticket.used ? <><IconCheck size={15} /> ใช้แล้ว · กดเพื่อยกเลิก</> : <><IconCircle size={15} /> ทำเครื่องหมายว่าใช้แล้ว</>}
        </button>
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
