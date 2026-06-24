import { useEffect, useState } from 'react'
import { IconTrash, IconPlaneDeparture, IconPlaneArrival, IconX } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import type { Flight, FlightDirection } from '@/lib/database.types'
import type { FlightInput } from '@/lib/tripMutations'
import { confirmDialog } from '@/lib/confirm'
import { toast } from '@/lib/toast'
import { TIMEZONES } from '@/lib/timezones'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full min-w-0 outline-none focus:border-brand'
const lbl = 'text-[11px] text-ink-3'
// Box wrapper for native date/time inputs: the ✕ is a real flex sibling (not an
// overlay) so iOS Safari's native control can never paint over it, and overflow
// is clipped so a long localized value (e.g. "27 Oct BE 2569") can't push past the box.
const fieldBox = 'hairline rounded-md h-10 bg-surface w-full min-w-0 flex items-center overflow-hidden focus-within:border-brand'

/** Native date/time field with a working ✕ clear button on iOS. */
function ClearableField({ type, value, onChange, onClear, ariaLabel }: {
  type: 'date' | 'time'
  value: string
  onChange: (val: string) => void
  onClear: () => void
  ariaLabel: string
}) {
  return (
    <div className={fieldBox}>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 h-full bg-transparent outline-none px-3 text-[13px] appearance-none" />
      {value && (
        <button type="button" onClick={onClear} aria-label={ariaLabel}
          className="shrink-0 size-8 grid place-items-center text-ink-3 hover:text-ink-2"><IconX size={14} /></button>
      )}
    </div>
  )
}

export function FlightEditor({
  open, onClose, initial, defaultDirection = 'outbound', prefillFrom, onSave, onDelete,
}: {
  open: boolean
  onClose: () => void
  initial: Flight | null
  defaultDirection?: FlightDirection
  /** when adding a RETURN flight, seed the form from the outbound (route swapped) */
  prefillFrom?: Flight | null
  onSave: (fields: FlightInput) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [v, setV] = useState<FlightInput>({})
  const [busy, setBusy] = useState(false)
  const set = (p: FlightInput) => setV((s) => ({ ...s, ...p }))

  useEffect(() => {
    if (!open) return
    if (initial) { setV({ ...initial }); return }
    const blank: FlightInput = { direction: defaultDirection, airline: '', flight_no: '', dep_code: '', dep_name: '', dep_time: '', arr_code: '', arr_name: '', arr_time: '', flight_date: '', booking_ref: '', seat_class: 'Economy', seats: undefined }
    // adding the return leg: prefill from the outbound with the route reversed
    if (defaultDirection === 'return' && prefillFrom) {
      setV({
        ...blank,
        airline: prefillFrom.airline ?? '', seat_class: prefillFrom.seat_class ?? 'Economy',
        seats: prefillFrom.seats ?? undefined, booking_ref: prefillFrom.booking_ref ?? '',
        dep_code: prefillFrom.arr_code ?? '', dep_name: prefillFrom.arr_name ?? '', dep_tz: prefillFrom.arr_tz ?? null,
        arr_code: prefillFrom.dep_code ?? '', arr_name: prefillFrom.dep_name ?? '', arr_tz: prefillFrom.dep_tz ?? null,
      })
      return
    }
    setV(blank)
    // Re-seed the form ONLY when the drawer opens or the edited flight changes.
    // Do NOT depend on `initial`/`prefillFrom` objects: the parent rebuilds
    // `prefillFrom` (flights.find(...)) on every render, so a realtime reload
    // mid-edit would re-run this and wipe whatever the user just typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id])

  async function save() {
    if (v.seats != null && (!Number.isFinite(v.seats) || v.seats < 0)) { toast.error('จำนวนที่นั่งต้องเป็นตัวเลขไม่ติดลบ'); return }
    setBusy(true)
    await onSave(v)
    setBusy(false)
    onClose()
  }
  async function del() {
    if (!onDelete || !(await confirmDialog({ message: 'ลบไฟลต์นี้?', danger: true, confirmLabel: 'ลบ' }))) return
    setBusy(true); await onDelete(); setBusy(false); onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title={initial ? 'แก้ไขไฟลต์' : 'เพิ่มไฟลต์'}>
      <div className="space-y-3">
        <div className="inline-flex gap-0.5 p-0.5 rounded-md bg-surface-2">
          {(['outbound', 'return'] as FlightDirection[]).map((d) => (
            <button key={d} onClick={() => set({ direction: d })}
              className={['px-3 h-7 rounded-[6px] text-[12px] font-medium', v.direction === d ? 'bg-surface text-ink shadow-sm' : 'text-ink-3'].join(' ')}>
              {d === 'outbound' ? 'ขาไป' : 'ขากลับ'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><div className={lbl}>สายการบิน</div><input className={field} value={v.airline ?? ''} onChange={(e) => set({ airline: e.target.value })} placeholder="Thai Airways" /></div>
          <div><div className={lbl}>เที่ยวบิน</div><input className={field} value={v.flight_no ?? ''} onChange={(e) => set({ flight_no: e.target.value })} placeholder="TG614" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <div className={lbl}>วันที่บิน</div>
            <ClearableField type="date" ariaLabel="ล้างวันที่" value={v.flight_date ?? ''}
              onChange={(val) => set({ flight_date: val })} onClear={() => set({ flight_date: '' })} />
          </div>
          <div className="min-w-0"><div className={lbl}>รหัสจอง</div><input className={field} value={v.booking_ref ?? ''} onChange={(e) => set({ booking_ref: e.target.value })} placeholder="XKQP34" /></div>
        </div>
        {/* ── ต้นทาง (Departure) — รหัส/ชื่อสนามบิน + เวลา/โซนเวลา อยู่กลุ่มเดียวกัน ── */}
        <div className="rounded-lg p-3 space-y-2" style={{ border: '0.5px solid var(--color-line)' }}>
          <div className="text-[12px] font-medium text-ink-2 flex items-center gap-1.5"><IconPlaneDeparture size={14} className="text-brand" /> ต้นทาง</div>
          <div className="grid grid-cols-3 gap-2">
            <div><div className={lbl}>รหัสสนามบิน</div><input className={field} value={v.dep_code ?? ''} onChange={(e) => set({ dep_code: e.target.value })} placeholder="BKK" /></div>
            <div className="col-span-2"><div className={lbl}>ชื่อสนามบิน</div><input className={field} value={v.dep_name ?? ''} onChange={(e) => set({ dep_name: e.target.value })} placeholder="Suvarnabhumi" /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="min-w-0">
              <div className={lbl}>เวลาออก</div>
              <ClearableField type="time" ariaLabel="ล้างเวลา" value={v.dep_time ?? ''}
                onChange={(val) => set({ dep_time: val })} onClear={() => set({ dep_time: '' })} />
            </div>
            <div className="col-span-2 min-w-0">
              <div className={lbl}>โซนเวลา</div>
              <select className={[field, !v.dep_tz ? 'text-ink-3' : ''].join(' ')} value={v.dep_tz ?? ''} onChange={(e) => set({ dep_tz: e.target.value || null })}>
                <option value="">— ไม่ระบุ —</option>
                {!!v.dep_tz && !TIMEZONES.some((t) => t.tz === v.dep_tz) && <option value={v.dep_tz}>{v.dep_tz}</option>}
                {TIMEZONES.map((t) => <option key={t.tz} value={t.tz}>{t.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── ปลายทาง (Arrival) — รูปแบบเดียวกับต้นทาง ── */}
        <div className="rounded-lg p-3 space-y-2" style={{ border: '0.5px solid var(--color-line)' }}>
          <div className="text-[12px] font-medium text-ink-2 flex items-center gap-1.5"><IconPlaneArrival size={14} className="text-brand" /> ปลายทาง</div>
          <div className="grid grid-cols-3 gap-2">
            <div><div className={lbl}>รหัสสนามบิน</div><input className={field} value={v.arr_code ?? ''} onChange={(e) => set({ arr_code: e.target.value })} placeholder="PEK" /></div>
            <div className="col-span-2"><div className={lbl}>ชื่อสนามบิน</div><input className={field} value={v.arr_name ?? ''} onChange={(e) => set({ arr_name: e.target.value })} placeholder="Capital Intl" /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="min-w-0">
              <div className={lbl}>เวลาถึง</div>
              <ClearableField type="time" ariaLabel="ล้างเวลา" value={v.arr_time ?? ''}
                onChange={(val) => set({ arr_time: val })} onClear={() => set({ arr_time: '' })} />
            </div>
            <div className="col-span-2 min-w-0">
              <div className={lbl}>โซนเวลา</div>
              <select className={[field, !v.arr_tz ? 'text-ink-3' : ''].join(' ')} value={v.arr_tz ?? ''} onChange={(e) => set({ arr_tz: e.target.value || null })}>
                <option value="">— ไม่ระบุ —</option>
                {!!v.arr_tz && !TIMEZONES.some((t) => t.tz === v.arr_tz) && <option value={v.arr_tz}>{v.arr_tz}</option>}
                {TIMEZONES.map((t) => <option key={t.tz} value={t.tz}>{t.label}</option>)}
              </select>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-ink-3">ใส่โซนเวลาสนามบินทั้งสองฝั่ง เพื่อให้คำนวณระยะเวลาบินข้ามโซนเวลาได้ถูกต้อง</p>
        <div className="grid grid-cols-2 gap-2">
          <div><div className={lbl}>ชั้นโดยสาร</div><input className={field} value={v.seat_class ?? ''} onChange={(e) => set({ seat_class: e.target.value })} placeholder="Economy" /></div>
          <div><div className={lbl}>จำนวนที่นั่ง</div><input type="number" className={field} value={v.seats ?? ''} onChange={(e) => set({ seats: e.target.value ? Number(e.target.value) : null })} placeholder="4" /></div>
        </div>
        <button onClick={save} disabled={busy} className="btn-primary w-full h-10 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        {initial && onDelete && (
          <button onClick={del} disabled={busy} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] text-[#D85A30]"><IconTrash size={15} /> ลบไฟลต์</button>
        )}
      </div>
    </Drawer>
  )
}
