import { useLayoutEffect, useState } from 'react'
import {
  IconTrash, IconPlaneDeparture, IconPlaneArrival, IconPlaneTilt, IconPlane,
  IconHash, IconCalendarEvent, IconTicket, IconArmchair, IconUsers, IconX,
} from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { ClearableField } from './ClearableField'
import type { Flight, FlightDirection } from '@/lib/database.types'
import type { FlightInput } from '@/lib/tripMutations'
import { confirmDialog } from '@/lib/confirm'
import { toast } from '@/lib/toast'
import { TIMEZONES } from '@/lib/timezones'
import { airportByCode } from '@/lib/airports'

const lbl = 'text-[11px] text-ink-3'
// boarding-pass style: leading-icon fields (placeholder acts as the label)
const iconField = 'hairline rounded-[9px] text-[13px] h-10 pl-9 pr-3 bg-surface w-full min-w-0 outline-none focus:border-brand'
const SEAT_CLASSES = ['Economy', 'Premium Economy', 'Business', 'First']

function Lead({ children }: { children: React.ReactNode }) {
  return <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none">{children}</span>
}

export function FlightEditor({
  open, onClose, initial, defaultDirection = 'outbound', prefillFrom, onSave, onDelete, onSwitchDirection,
}: {
  open: boolean
  onClose: () => void
  initial: Flight | null
  defaultDirection?: FlightDirection
  /** when adding a RETURN flight, seed the form from the outbound (route swapped) */
  prefillFrom?: Flight | null
  /** Return `true` to keep the drawer open (e.g. the parent swapped it to the
   *  return-leg form); otherwise it closes after saving. */
  onSave: (fields: FlightInput) => Promise<void | boolean>
  onDelete?: () => Promise<void>
  /** Tapping the ขาไป/ขากลับ toggle switches to editing that leg's real flight.
   *  Receives the CURRENT form values so the parent can save this leg's edits
   *  before loading the other (otherwise switching discards them). */
  onSwitchDirection?: (dir: FlightDirection, current: FlightInput) => void
}) {
  const [v, setV] = useState<FlightInput>({})
  const [busy, setBusy] = useState(false)
  const set = (p: FlightInput) => setV((s) => ({ ...s, ...p }))

  // Type an IATA code (bkk → BKK) and the airport name + timezone fill in
  // right away. Known code always refreshes both fields; unknown code just
  // uppercases and leaves whatever the user typed.
  const setDepCode = (raw: string) => {
    const code = raw.toUpperCase()
    const a = airportByCode(code)
    set(a ? { dep_code: code, dep_name: a.name, dep_tz: a.tz } : { dep_code: code })
  }
  const setArrCode = (raw: string) => {
    const code = raw.toUpperCase()
    const a = airportByCode(code)
    set(a ? { arr_code: code, arr_name: a.name, arr_tz: a.tz } : { arr_code: code })
  }

  // Re-seed the form synchronously (before paint, no flash) whenever the drawer
  // opens, the edited flight changes, or the target direction changes. This lets
  // the ขาไป/ขากลับ toggle swap legs in place — no drawer remount, no animation.
  useLayoutEffect(() => {
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
    // Depend on identity/strings only — NOT the `initial`/`prefillFrom` objects:
    // the parent rebuilds `prefillFrom` (flights.find(...)) on every render, so a
    // realtime reload mid-edit must not re-run this and wipe in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id, defaultDirection])

  async function save() {
    if (v.seats != null && (!Number.isFinite(v.seats) || v.seats < 0)) { toast.error('จำนวนที่นั่งต้องเป็นตัวเลขไม่ติดลบ'); return }
    setBusy(true)
    const keepOpen = await onSave(v)
    setBusy(false)
    if (!keepOpen) onClose()
  }
  async function del() {
    if (!onDelete || !(await confirmDialog({ message: 'ลบไฟลต์นี้?', danger: true, confirmLabel: 'ลบ' }))) return
    setBusy(true); await onDelete(); setBusy(false); onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title={initial ? 'แก้ไขไฟลต์' : 'เพิ่มไฟลต์'}>
      <div className="space-y-3">
        {/* ขาไป/ขากลับ — pill toggle, active leg in brand blue */}
        <div className="inline-flex p-0.5 rounded-full bg-surface-2">
          {(['outbound', 'return'] as FlightDirection[]).map((d) => (
            <button key={d} onClick={() => onSwitchDirection ? onSwitchDirection(d, v) : set({ direction: d })}
              className={['inline-flex items-center gap-1.5 px-4 h-8 rounded-full text-[12px] font-semibold transition-colors',
                v.direction === d ? 'text-white' : 'text-ink-3'].join(' ')}
              style={v.direction === d ? { background: 'var(--color-brand)' } : undefined}>
              {d === 'outbound' ? <IconPlaneDeparture size={14} /> : <IconPlaneArrival size={14} />}
              {d === 'outbound' ? 'ขาไป' : 'ขากลับ'}
            </button>
          ))}
        </div>

        {/* ── boarding-pass card: route on top, date + times below the perforation ── */}
        <div className="rounded-[14px] bg-surface overflow-hidden"
          style={{ border: '0.5px solid var(--color-brand-border)', boxShadow: '0 4px 14px rgba(2,112,251,0.07)' }}>
          <div className="p-3 pb-3.5">
            <div className="flex items-center justify-between text-[10.5px] text-ink-3 mb-1.5 px-0.5">
              <span className="inline-flex items-center gap-1"><IconPlaneDeparture size={12} className="text-brand" /> ต้นทาง</span>
              <span className="inline-flex items-center gap-1">ปลายทาง <IconPlaneArrival size={12} className="text-brand" /></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <input className="hairline rounded-[11px] bg-surface w-full h-[52px] text-center text-[22px] font-bold tracking-[0.08em] outline-none focus:border-brand uppercase placeholder:text-ink-3/50 placeholder:font-medium"
                  value={v.dep_code ?? ''} onChange={(e) => setDepCode(e.target.value)} placeholder="XXX"
                  autoCapitalize="characters" maxLength={4} aria-label="รหัสสนามบินต้นทาง" />
              </div>
              <IconPlaneTilt size={18} className="text-brand shrink-0" />
              <div className="flex-1 min-w-0">
                <input className="hairline rounded-[11px] bg-surface w-full h-[52px] text-center text-[22px] font-bold tracking-[0.08em] outline-none focus:border-brand uppercase placeholder:text-ink-3/50 placeholder:font-medium"
                  value={v.arr_code ?? ''} onChange={(e) => setArrCode(e.target.value)} placeholder="XXX"
                  autoCapitalize="characters" maxLength={4} aria-label="รหัสสนามบินปลายทาง" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <input className="flex-1 min-w-0 h-8 rounded-md bg-transparent text-center text-[11px] text-ink-2 outline-none placeholder:text-ink-3 focus:bg-surface-2"
                value={v.dep_name ?? ''} onChange={(e) => set({ dep_name: e.target.value })} placeholder="ชื่อสนามบิน" aria-label="ชื่อสนามบินต้นทาง" />
              <span className="w-[18px] shrink-0" />
              <input className="flex-1 min-w-0 h-8 rounded-md bg-transparent text-center text-[11px] text-ink-2 outline-none placeholder:text-ink-3 focus:bg-surface-2"
                value={v.arr_name ?? ''} onChange={(e) => set({ arr_name: e.target.value })} placeholder="ชื่อสนามบิน" aria-label="ชื่อสนามบินปลายทาง" />
            </div>
          </div>

          {/* perforation with punched notches, like a real ticket */}
          <div className="relative mx-3" style={{ borderTop: '1.5px dashed var(--color-line-2)' }}>
            <span className="absolute size-[18px] rounded-full bg-surface" style={{ left: -22, top: -9.5, border: '0.5px solid var(--color-brand-border)' }} />
            <span className="absolute size-[18px] rounded-full bg-surface" style={{ right: -22, top: -9.5, border: '0.5px solid var(--color-brand-border)' }} />
          </div>

          <div className="p-3 pt-3.5 grid grid-cols-2 gap-2">
            {/* วันที่บิน — the headline field of the ticket */}
            <div className="col-span-2 flex items-center h-11 rounded-[10px] px-3 gap-2 overflow-hidden"
              style={{ background: 'var(--color-brand-soft)', border: '1px solid var(--color-brand-border)' }}>
              <IconCalendarEvent size={17} style={{ color: 'var(--color-brand-mid)' }} className="shrink-0" />
              <span className="text-[11px] font-medium shrink-0" style={{ color: 'var(--color-brand-mid)' }}>วันที่บิน</span>
              <input type="date" value={v.flight_date ?? ''} onChange={(e) => set({ flight_date: e.target.value })}
                className="flex-1 min-w-0 h-full bg-transparent outline-none text-[13.5px] font-semibold appearance-none" aria-label="วันที่บิน" />
              {!!v.flight_date && (
                <button type="button" onClick={() => set({ flight_date: '' })} aria-label="ล้างวันที่"
                  className="shrink-0 size-7 grid place-items-center text-ink-3 hover:text-ink-2"><IconX size={14} /></button>
              )}
            </div>
            <div className="min-w-0">
              <div className={lbl}>เวลาออก</div>
              <ClearableField type="time" ariaLabel="ล้างเวลา" value={v.dep_time ?? ''}
                onChange={(val) => set({ dep_time: val })} onClear={() => set({ dep_time: '' })} />
            </div>
            <div className="min-w-0">
              <div className={lbl}>เวลาถึง</div>
              <ClearableField type="time" ariaLabel="ล้างเวลา" value={v.arr_time ?? ''}
                onChange={(val) => set({ arr_time: val })} onClear={() => set({ arr_time: '' })} />
            </div>
            <select className={['hairline rounded-md text-[11.5px] h-9 px-2 bg-surface w-full min-w-0 outline-none focus:border-brand', !v.dep_tz ? 'text-ink-3' : 'text-ink-2'].join(' ')}
              value={v.dep_tz ?? ''} onChange={(e) => set({ dep_tz: e.target.value || null })} aria-label="โซนเวลาต้นทาง">
              <option value="">โซนเวลาต้นทาง — ไม่ระบุ</option>
              {!!v.dep_tz && !TIMEZONES.some((t) => t.tz === v.dep_tz) && <option value={v.dep_tz}>{v.dep_tz}</option>}
              {TIMEZONES.map((t) => <option key={t.tz} value={t.tz}>{t.label}</option>)}
            </select>
            <select className={['hairline rounded-md text-[11.5px] h-9 px-2 bg-surface w-full min-w-0 outline-none focus:border-brand', !v.arr_tz ? 'text-ink-3' : 'text-ink-2'].join(' ')}
              value={v.arr_tz ?? ''} onChange={(e) => set({ arr_tz: e.target.value || null })} aria-label="โซนเวลาปลายทาง">
              <option value="">โซนเวลาปลายทาง — ไม่ระบุ</option>
              {!!v.arr_tz && !TIMEZONES.some((t) => t.tz === v.arr_tz) && <option value={v.arr_tz}>{v.arr_tz}</option>}
              {TIMEZONES.map((t) => <option key={t.tz} value={t.tz}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <p className="text-[10.5px] text-ink-3">พิมพ์รหัสสนามบิน (เช่น BKK) แล้วชื่อ+โซนเวลาเติมให้เอง · ใส่โซนเวลาทั้งสองฝั่งเพื่อคำนวณเวลาบินข้ามโซนได้ถูกต้อง</p>

        {/* รายละเอียดไฟลต์ — ช่องไอคอนนำหน้า placeholder เป็นป้ายในตัว */}
        <div className="grid grid-cols-2 gap-2">
          <div className="relative"><Lead><IconPlane size={15} /></Lead>
            <input className={iconField} value={v.airline ?? ''} onChange={(e) => set({ airline: e.target.value })} placeholder="สายการบิน" aria-label="สายการบิน" /></div>
          <div className="relative"><Lead><IconHash size={15} /></Lead>
            <input className={iconField} value={v.flight_no ?? ''} onChange={(e) => set({ flight_no: e.target.value })} placeholder="เที่ยวบิน เช่น TG614" aria-label="เที่ยวบิน" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="relative"><Lead><IconArmchair size={15} /></Lead>
            <select className={[iconField, 'appearance-none'].join(' ')} value={v.seat_class ?? 'Economy'} onChange={(e) => set({ seat_class: e.target.value })} aria-label="ชั้นโดยสาร">
              {/* keep an unusual stored value selectable instead of silently swapping it */}
              {!!v.seat_class && !SEAT_CLASSES.includes(v.seat_class) && <option value={v.seat_class}>{v.seat_class}</option>}
              {SEAT_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div className="relative"><Lead><IconUsers size={15} /></Lead>
            <input type="number" className={iconField} value={v.seats ?? ''} onChange={(e) => set({ seats: e.target.value ? Number(e.target.value) : null })} placeholder="จำนวนที่นั่ง" aria-label="จำนวนที่นั่ง" /></div>
        </div>
        <div className="relative"><Lead><IconTicket size={15} /></Lead>
          <input className={iconField} value={v.booking_ref ?? ''} onChange={(e) => set({ booking_ref: e.target.value })} placeholder="รหัสจอง เช่น XKQP34" aria-label="รหัสจอง" /></div>

        <button onClick={save} disabled={busy} className="btn-primary w-full h-10 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        {initial && onDelete && (
          <button onClick={del} disabled={busy} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] text-[#D85A30]"><IconTrash size={15} /> ลบไฟลต์</button>
        )}
      </div>
    </Drawer>
  )
}
