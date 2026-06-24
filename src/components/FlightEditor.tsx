import { useEffect, useState } from 'react'
import { IconTrash } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import type { Flight, FlightDirection } from '@/lib/database.types'
import type { FlightInput } from '@/lib/tripMutations'
import { confirmDialog } from '@/lib/confirm'
import { toast } from '@/lib/toast'
import { TIMEZONES } from '@/lib/timezones'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'
const lbl = 'text-[11px] text-ink-3'

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
  }, [open, initial, defaultDirection, prefillFrom])

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
        <div className="grid grid-cols-3 gap-2">
          <div><div className={lbl}>รหัสต้นทาง</div><input className={field} value={v.dep_code ?? ''} onChange={(e) => set({ dep_code: e.target.value })} placeholder="BKK" /></div>
          <div className="col-span-2"><div className={lbl}>ชื่อต้นทาง</div><input className={field} value={v.dep_name ?? ''} onChange={(e) => set({ dep_name: e.target.value })} placeholder="Suvarnabhumi" /></div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><div className={lbl}>เวลาออก</div><input className={field} value={v.dep_time ?? ''} onChange={(e) => set({ dep_time: e.target.value })} placeholder="09:45" /></div>
          <div><div className={lbl}>รหัสปลายทาง</div><input className={field} value={v.arr_code ?? ''} onChange={(e) => set({ arr_code: e.target.value })} placeholder="PEK" /></div>
          <div><div className={lbl}>เวลาถึง</div><input className={field} value={v.arr_time ?? ''} onChange={(e) => set({ arr_time: e.target.value })} placeholder="15:35" /></div>
        </div>
        <div><div className={lbl}>ชื่อปลายทาง</div><input className={field} value={v.arr_name ?? ''} onChange={(e) => set({ arr_name: e.target.value })} placeholder="Capital Intl" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className={lbl}>โซนเวลาต้นทาง</div>
            <select className={[field, !v.dep_tz ? 'text-ink-3' : ''].join(' ')} value={v.dep_tz ?? ''} onChange={(e) => set({ dep_tz: e.target.value || null })}>
              <option value="">— ไม่ระบุ —</option>
              {!!v.dep_tz && !TIMEZONES.some((t) => t.tz === v.dep_tz) && <option value={v.dep_tz}>{v.dep_tz}</option>}
              {TIMEZONES.map((t) => <option key={t.tz} value={t.tz}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <div className={lbl}>โซนเวลาปลายทาง</div>
            <select className={[field, !v.arr_tz ? 'text-ink-3' : ''].join(' ')} value={v.arr_tz ?? ''} onChange={(e) => set({ arr_tz: e.target.value || null })}>
              <option value="">— ไม่ระบุ —</option>
              {!!v.arr_tz && !TIMEZONES.some((t) => t.tz === v.arr_tz) && <option value={v.arr_tz}>{v.arr_tz}</option>}
              {TIMEZONES.map((t) => <option key={t.tz} value={t.tz}>{t.label}</option>)}
            </select>
          </div>
          <p className="col-span-2 text-[11px] text-ink-3 -mt-0.5">ใส่โซนเวลาสนามบินทั้งสองฝั่ง เพื่อให้คำนวณระยะเวลาบินข้ามโซนเวลาได้ถูกต้อง</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><div className={lbl}>วันที่บิน</div><input type="date" className={field} value={v.flight_date ?? ''} onChange={(e) => set({ flight_date: e.target.value })} /></div>
          <div><div className={lbl}>รหัสจอง</div><input className={field} value={v.booking_ref ?? ''} onChange={(e) => set({ booking_ref: e.target.value })} placeholder="XKQP34" /></div>
        </div>
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
