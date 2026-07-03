import { useEffect, useMemo, useRef, useState } from 'react'
import { IconQrcode, IconTrash, IconPlus, IconUpload, IconLoader2, IconTrain, IconStar, IconStarFilled, IconCheck, IconCircle, IconPencil, IconChevronLeft, IconBuildingCarousel, IconDeviceMobile, IconTicket, IconCopy, IconExternalLink } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { SignedImage } from './SignedImage'
import { Lightbox } from './Lightbox'
import { uploadImage } from '@/lib/files'
import { addTrainTicket, updateTrainTicket, deleteTrainTicket } from '@/lib/tripMutations'
import { confirmDialog } from '@/lib/confirm'
import { toast } from '@/lib/toast'
import type { TrainTicket } from '@/lib/database.types'

const qrRef = (path: string) => (/^https?:\/\//.test(path) ? { url: path } : { path })
const field = 'hairline rounded-md text-[13px] h-9 px-2.5 bg-surface w-full outline-none focus:border-brand'

const KINDS = [
  { key: 'admission', label: 'Admission Ticket', icon: IconTicket, labelPh: 'ชื่อรายการ', notePh: 'รายละเอียด (วันที่ / รอบ / โซน)' },
  { key: 'airport_express', label: 'Airport Express Ticket', icon: IconTrain, labelPh: 'ชื่อรายการ (เช่น Airport Express)', boarding: true },
  { key: 'train', label: 'Train Ticket', icon: IconTrain, labelPh: 'ชื่อรายการ (เช่น Shinkansen)', boarding: true },
  { key: 'theme_park', label: 'Theme Park', icon: IconBuildingCarousel, labelPh: 'ชื่อสวนสนุก (เช่น Disneyland)', notePh: 'รายละเอียด (วันที่ / รอบ / โซน)' },
  { key: 'esim', label: 'eSIM', icon: IconDeviceMobile, labelPh: 'ผู้ให้บริการ / แพ็กเกจ', notePh: 'รายละเอียด (ดาต้า / วันหมดอายุ)' },
  { key: 'other', label: 'อื่นๆ', icon: IconQrcode, labelPh: 'ชื่อรายการ', notePh: 'รายละเอียด' },
] as const
const kindMeta = (k: string | null) => KINDS.find((x) => x.key === k) ?? KINDS[KINDS.length - 1]
// which kinds use the boarding-pass detail (stations + Car/Gate/Seat)
const isBoarding = (k: string | null) => { const m = kindMeta(k); return 'boarding' in m && !!m.boarding }

async function copyIccid(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // http/older-webview fallback
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  toast.success('คัดลอก ICCID แล้ว')
}

// ensure a tappable URL even when typed without the protocol
const asUrl = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v}`)

/**
 * Quick-QR hub for one traveler. Everything updates the shared trip state
 * OPTIMISTICALLY (no full reload), so taps are instant and never bounce; each
 * swipe card is fully self-contained (its own label + QR + details) so nothing
 * desyncs. Swipe left/right to flip; the main QR is shown first on open.
 */
export function TravelerQr({ open, onClose, name, tickets, tripId, traveler, canEdit, patchTickets }: {
  open: boolean
  onClose: () => void
  name: string
  tickets: TrainTicket[]
  tripId: string
  traveler: { id: string } | null
  canEdit: boolean
  patchTickets: (fn: (all: TrainTicket[]) => TrainTicket[]) => void
}) {
  // used QRs sink to the back; otherwise by position
  const rows = useMemo(() => [...tickets].sort((a, b) => (a.used ? 1 : 0) - (b.used ? 1 : 0) || a.position - b.position), [tickets])
  const [selId, setSelId] = useState<string | null>(null)
  const curId = (selId && rows.some((r) => r.id === selId)) ? selId : (rows[0]?.id ?? null)
  const sel = rows.find((t) => t.id === curId) ?? null
  const [editMode, setEditMode] = useState(false)
  const [lbPath, setLbPath] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  // on open → jump to the main QR (retry until the drawer has laid out)
  useEffect(() => {
    if (!open || rows.length === 0) return
    const i = Math.max(0, rows.findIndex((r) => r.is_main))
    let tries = 0, raf = 0
    const tick = () => {
      const el = scroller.current
      if (!el) return
      if (el.clientWidth === 0 && tries < 30) { tries++; raf = requestAnimationFrame(tick); return }
      el.scrollLeft = i * el.clientWidth
      setSelId(rows[i]?.id ?? null)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // after a reorder (e.g. a QR sinks to the back when marked used), keep the
  // header label in sync with whichever card is now centred
  useEffect(() => {
    const el = scroller.current
    if (!el || rows.length === 0) return
    const i = Math.min(rows.length - 1, Math.round(el.scrollLeft / el.clientWidth))
    const id = rows[i]?.id
    if (id && id !== curId) setSelId(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  // a QR that was added but never filled/uploaded is "unsaved" — discard it so it
  // doesn't persist or show up next time (pressing "+" then leaving = no-op).
  // ONLY tickets created by THIS drawer session are eligible: a blank from
  // another device/member may be mid-edit and must never be deleted from here.
  const createdHere = useRef<Set<string>>(new Set())
  useEffect(() => { if (open) createdHere.current = new Set() }, [open])
  const isBlank = (t: TrainTicket) => !t.qr_path && !t.label && !t.note && !t.from_station && !t.to_station && !t.seat_no && !t.car && !t.gate && !t.iccid && !t.link
  function discardBlanks() {
    if (!canEdit) return
    const blanks = tickets.filter((t) => isBlank(t) && createdHere.current.has(t.id))
    if (blanks.length === 0) return
    const ids = new Set(blanks.map((b) => b.id))
    patchTickets((all) => all.filter((x) => !ids.has(x.id)))
    blanks.forEach((b) => deleteTrainTicket(b.id))
  }
  function backFromEdit() {
    if (sel && isBlank(sel) && createdHere.current.has(sel.id)) { removeTicket(sel.id); setSelId(null) }
    setEditMode(false)
  }
  function close() { discardBlanks(); setEditMode(false); onClose() }
  function onScroll() {
    const el = scroller.current
    if (!el) return
    const id = rows[Math.round(el.scrollLeft / el.clientWidth)]?.id
    if (id && id !== curId) setSelId(id)
  }

  // ---- optimistic mutations (patch context + background DB write) ----
  function persist(id: string, fields: Parameters<typeof updateTrainTicket>[1]) {
    patchTickets((all) => all.map((x) => (x.id === id ? ({ ...x, ...fields } as TrainTicket) : x)))
    updateTrainTicket(id, fields)
  }
  function add() {
    if (!traveler) return
    const id = crypto.randomUUID()
    const t: TrainTicket = {
      id, trip_id: tripId, train_id: null, traveler_id: traveler.id, passenger_name: null,
      kind: 'train', note: null, label: null, from_station: null, to_station: null,
      seat_no: null, car: null, gate: null, iccid: null, link: null, qr_path: null,
      is_main: rows.length === 0, used: false, position: rows.length, created_at: new Date().toISOString(),
    }
    createdHere.current.add(id)
    patchTickets((all) => [...all, t])
    setSelId(id)
    setEditMode(true)
    addTrainTicket(tripId, { traveler_id: traveler.id, position: rows.length, is_main: rows.length === 0, kind: 'train' }, id)
  }
  function removeTicket(id: string) {
    patchTickets((all) => all.filter((x) => x.id !== id))
    deleteTrainTicket(id)
  }
  function toggleMain(t: TrainTicket) {
    const on = !t.is_main
    const myIds = new Set(rows.map((r) => r.id))
    patchTickets((all) => all.map((x) => (myIds.has(x.id) ? { ...x, is_main: on ? x.id === t.id : (x.id === t.id ? false : x.is_main) } : x)))
    if (on) rows.forEach((r) => updateTrainTicket(r.id, { is_main: r.id === t.id }))
    else updateTrainTicket(t.id, { is_main: false })
  }
  function toggleUsed(t: TrainTicket) {
    const used = !t.used
    // marking used also clears the main flag (and it sinks to the back via sort)
    patchTickets((all) => all.map((x) => (x.id === t.id ? { ...x, used, is_main: used ? false : x.is_main } : x)))
    updateTrainTicket(t.id, used ? { used: true, is_main: false } : { used: false })
  }

  return (
    <Drawer open={open} onClose={close} title={editMode && sel ? 'แก้ไข QR' : `Quick QR · ${name}`}>
      {editMode && sel ? (
        <QrEditPage key={sel.id} ticket={sel} tripId={tripId}
          onPersist={(f) => persist(sel.id, f)}
          onRemove={() => { removeTicket(sel.id); setSelId(null); setEditMode(false) }}
          onBack={backFromEdit} />
      ) : rows.length === 0 ? (
        <div>
          {canEdit && (
            <div className="flex justify-end mb-3">
              <button onClick={add} className="btn-icon" aria-label="เพิ่ม QR" title="เพิ่ม QR"><IconPlus size={16} /></button>
            </div>
          )}
          <div className="card p-8 text-center text-[13px] text-ink-3">ยังไม่มี QR{canEdit ? ' — กด “+” เพื่อเพิ่ม' : ''}</div>
        </div>
      ) : (
        <div>
          {/* name — top-left; actions — top-right */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-[14px] font-semibold truncate flex items-center gap-1.5 min-w-0">
              {(() => { const M = kindMeta(sel?.kind ?? null).icon; return <M size={15} className="text-brand shrink-0" /> })()}
              <span className="truncate">{sel?.label || kindMeta(sel?.kind ?? null).label}</span>
            </div>
            {canEdit && (
              <div className="flex gap-1 shrink-0">
                <button onClick={add} className="btn-icon" aria-label="เพิ่ม QR" title="เพิ่ม QR"><IconPlus size={16} /></button>
                {sel && <button onClick={() => setEditMode(true)} className="btn-icon" aria-label="แก้ไข" title="แก้ไข"><IconPencil size={16} /></button>}
              </div>
            )}
          </div>

          {/* swipeable cards — each fully self-contained */}
          <div ref={scroller} onScroll={onScroll} className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar">
            {rows.map((t) => (
              <div key={t.id} className="w-full shrink-0 snap-center px-0.5">
                <QrSlide ticket={t} canEdit={canEdit}
                  onToggleMain={() => toggleMain(t)} onToggleUsed={() => toggleUsed(t)}
                  onEnlarge={() => t.qr_path && setLbPath(t.qr_path)} />
              </div>
            ))}
          </div>

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

/** One swipeable QR card — title + QR + details all belong to the same ticket. */
function QrSlide({ ticket, canEdit, onToggleMain, onToggleUsed, onEnlarge }: {
  ticket: TrainTicket
  canEdit: boolean
  onToggleMain: () => void
  onToggleUsed: () => void
  onEnlarge: () => void
}) {
  const isTrain = isBoarding(ticket.kind)
  return (
    <div className={ticket.used ? 'opacity-60' : undefined}>
      {/* main toggle — centred, above the QR */}
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

      {/* QR centred, tap to enlarge */}
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

      {/* details box — bright, near-white brand blue (5%) */}
      <div className="rounded-lg p-3.5 mt-4 text-[13px]" style={{ background: 'rgba(2,112,251,0.05)' }}>
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
          <div className="space-y-2">
            {(ticket.note || !(ticket.kind === 'esim' && (ticket.iccid || ticket.link))) && (
              <div className="text-ink-2 whitespace-pre-wrap">{ticket.note || <span className="text-ink-3">ไม่มีรายละเอียด</span>}</div>
            )}
            {ticket.kind === 'esim' && ticket.iccid && (
              <div className="flex items-center gap-2 rounded-md bg-white/70 hairline px-2.5 h-9">
                <span className="text-[11px] text-ink-3 shrink-0">ICCID</span>
                <span className="flex-1 truncate tabular-nums text-ink font-medium">{ticket.iccid}</span>
                <button onClick={() => copyIccid(ticket.iccid!)}
                  className="shrink-0 inline-flex items-center gap-1 text-[12px] font-medium text-brand"
                  aria-label="คัดลอก ICCID">
                  <IconCopy size={14} /> คัดลอก
                </button>
              </div>
            )}
            {ticket.kind === 'esim' && ticket.link && (
              <a href={asUrl(ticket.link)} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-md h-9 text-[13px] font-medium text-white"
                style={{ background: 'var(--color-brand)' }}>
                <IconExternalLink size={15} /> เปิดลิงก์ลงทะเบียน eSIM
              </a>
            )}
          </div>
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
function QrEditPage({ ticket, tripId, onPersist, onRemove, onBack }: {
  ticket: TrainTicket
  tripId: string
  onPersist: (fields: Parameters<typeof updateTrainTicket>[1]) => void
  onRemove: () => void
  onBack: () => void
}) {
  const [kind, setKind] = useState(ticket.kind ?? 'train')
  const [label, setLabel] = useState(ticket.label ?? '')
  const [note, setNote] = useState(ticket.note ?? '')
  const [from, setFrom] = useState(ticket.from_station ?? '')
  const [to, setTo] = useState(ticket.to_station ?? '')
  const [seat, setSeat] = useState(ticket.seat_no ?? '')
  const [car, setCar] = useState(ticket.car ?? '')
  const [gate, setGate] = useState(ticket.gate ?? '')
  const [iccid, setIccid] = useState(ticket.iccid ?? '')
  const [link, setLink] = useState(ticket.link ?? '')
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const meta = kindMeta(kind)

  async function onPickQr(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const { path } = await uploadImage(tripId, 'ticket-qr', file)
    if (path) onPersist({ qr_path: path })
    setUploading(false)
    if (fileInput.current) fileInput.current.value = ''
  }
  async function del() {
    if (!(await confirmDialog({ message: `ลบ "${ticket.label || 'QR'}"?`, danger: true, confirmLabel: 'ลบ' }))) return
    onRemove()
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
        <select className={field} value={kind} onChange={(e) => { setKind(e.target.value); onPersist({ kind: e.target.value }) }}>
          {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </select>

        {kind !== 'esim' && (
          <input className={field} value={label} placeholder={meta.labelPh} onChange={(e) => setLabel(e.target.value)} onBlur={() => onPersist({ label: label.trim() || null })} />
        )}

        {isBoarding(kind) ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <input className={field} value={from} placeholder="สถานีต้นทาง" onChange={(e) => setFrom(e.target.value)} onBlur={() => onPersist({ from_station: from.trim() || null })} />
              <input className={field} value={to} placeholder="สถานีปลายทาง" onChange={(e) => setTo(e.target.value)} onBlur={() => onPersist({ to_station: to.trim() || null })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input className={field} value={car} placeholder="Car" onChange={(e) => setCar(e.target.value)} onBlur={() => onPersist({ car: car.trim() || null })} />
              <input className={field} value={gate} placeholder="Gate" onChange={(e) => setGate(e.target.value)} onBlur={() => onPersist({ gate: gate.trim() || null })} />
              <input className={field} value={seat} placeholder="Seat" onChange={(e) => setSeat(e.target.value)} onBlur={() => onPersist({ seat_no: seat.trim() || null })} />
            </div>
          </>
        ) : (
          <>
            {kind === 'esim' && (
              <div className="relative">
                <input className={`${field} pr-11 tabular-nums`} value={iccid} placeholder="ICCID (เลขบนซอง/อีเมล eSIM)"
                  inputMode="numeric" autoComplete="off"
                  onChange={(e) => setIccid(e.target.value)} onBlur={() => onPersist({ iccid: iccid.trim() || null })} />
                <button type="button" onClick={() => iccid.trim() && copyIccid(iccid.trim())}
                  disabled={!iccid.trim()}
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-7 grid place-items-center rounded-md text-brand disabled:opacity-30"
                  aria-label="คัดลอก ICCID" title="คัดลอก ICCID">
                  <IconCopy size={15} />
                </button>
              </div>
            )}
            {kind === 'esim' && (
              <div className="relative">
                <input className={`${field} pr-11`} value={link} placeholder="ลิงก์ลงทะเบียน eSIM (https://...)"
                  type="url" inputMode="url" autoComplete="off"
                  onChange={(e) => setLink(e.target.value)} onBlur={() => onPersist({ link: link.trim() || null })} />
                <a href={link.trim() ? asUrl(link.trim()) : undefined} target="_blank" rel="noopener noreferrer"
                  aria-disabled={!link.trim()}
                  className={`absolute right-1 top-1/2 -translate-y-1/2 size-7 grid place-items-center rounded-md text-brand ${link.trim() ? '' : 'opacity-30 pointer-events-none'}`}
                  aria-label="เปิดลิงก์" title="เปิดลิงก์">
                  <IconExternalLink size={15} />
                </a>
              </div>
            )}
            <textarea className="hairline rounded-md text-[13px] px-2.5 py-2 bg-surface w-full outline-none focus:border-brand resize-none" rows={3}
              value={note} placeholder={'notePh' in meta ? meta.notePh : 'รายละเอียด'}
              onChange={(e) => setNote(e.target.value)} onBlur={() => onPersist({ note: note.trim() || null })} />
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 mt-5 pt-4" style={{ borderTop: '0.5px solid var(--color-line)' }}>
        <button onClick={del} className="text-[12px] inline-flex items-center gap-1 text-[#D85A30]"><IconTrash size={14} /> ลบรายการนี้</button>
        <button onClick={onBack} className="btn-primary h-9 px-5 text-[13px]">เสร็จ</button>
      </div>

      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPickQr} />
    </div>
  )
}
