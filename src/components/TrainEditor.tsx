import { useLayoutEffect, useState } from 'react'
import {
  IconTrash, IconTrain, IconHash, IconCalendarEvent, IconTicket, IconArmchair,
  IconSofa, IconDoor, IconBoxMultiple, IconX,
} from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { ClearableField } from './ClearableField'
import type { Train, FlightDirection } from '@/lib/database.types'
import type { TrainInput } from '@/lib/tripMutations'
import { confirmDialog } from '@/lib/confirm'

const lbl = 'text-[11px] text-ink-3'
// ticket style (same as FlightEditor): leading-icon fields, placeholder = label
const iconField = 'hairline rounded-[9px] text-[13px] h-10 pl-9 pr-3 bg-surface w-full min-w-0 outline-none focus:border-brand'
const stationField = 'hairline rounded-[11px] bg-surface w-full h-[52px] text-center text-[15px] font-bold outline-none focus:border-brand placeholder:text-ink-3/50 placeholder:font-medium'

function Lead({ children }: { children: React.ReactNode }) {
  return <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none">{children}</span>
}

export function TrainEditor({
  open, onClose, initial, defaultDirection = 'outbound', prefillFrom, onSave, onDelete, onSwitchDirection,
}: {
  open: boolean
  onClose: () => void
  initial: Train | null
  defaultDirection?: FlightDirection
  /** when adding a RETURN train, seed the form from the outbound (route swapped) */
  prefillFrom?: Train | null
  onSave: (fields: TrainInput) => Promise<void | boolean>
  onDelete?: () => Promise<void>
  /** Switch legs — receives the CURRENT form values so the parent can save this
   *  leg's edits before loading the other (otherwise switching discards them). */
  onSwitchDirection?: (dir: FlightDirection, current: TrainInput) => void
}) {
  const [v, setV] = useState<TrainInput>({})
  const [busy, setBusy] = useState(false)
  const set = (p: TrainInput) => setV((s) => ({ ...s, ...p }))

  useLayoutEffect(() => {
    if (!open) return
    if (initial) { setV({ ...initial }); return }
    const blank: TrainInput = { direction: defaultDirection, operator: '', train_no: '', dep_name: '', dep_time: '', arr_name: '', arr_time: '', travel_date: '', booking_ref: '', seat_class: '', gate: '', car: '', seat_no: '' }
    if (defaultDirection === 'return' && prefillFrom) {
      setV({
        ...blank,
        operator: prefillFrom.operator ?? '', seat_class: prefillFrom.seat_class ?? '',
        booking_ref: prefillFrom.booking_ref ?? '',
        dep_name: prefillFrom.arr_name ?? '', arr_name: prefillFrom.dep_name ?? '',
      })
      return
    }
    setV(blank)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id, defaultDirection])

  async function save() {
    setBusy(true)
    const keepOpen = await onSave(v)
    setBusy(false)
    if (!keepOpen) onClose()
  }
  async function del() {
    if (!onDelete || !(await confirmDialog({ message: 'ลบรถไฟนี้?', danger: true, confirmLabel: 'ลบ' }))) return
    setBusy(true); await onDelete(); setBusy(false); onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title={initial ? 'แก้ไขรถไฟ' : 'เพิ่มรถไฟ'}>
      <div className="space-y-3">
        {/* ขาไป/ขากลับ — pill toggle, active leg in brand blue (same as flights) */}
        <div className="inline-flex p-0.5 rounded-full bg-surface-2">
          {(['outbound', 'return'] as FlightDirection[]).map((d) => (
            <button key={d} onClick={() => onSwitchDirection ? onSwitchDirection(d, v) : set({ direction: d })}
              className={['inline-flex items-center gap-1.5 px-4 h-8 rounded-full text-[12px] font-semibold transition-colors',
                v.direction === d ? 'text-white' : 'text-ink-3'].join(' ')}
              style={v.direction === d ? { background: 'var(--color-brand)' } : undefined}>
              {d === 'outbound' ? <IconTrain size={14} /> : <IconTrain size={14} className="-scale-x-100" />}
              {d === 'outbound' ? 'ขาไป' : 'ขากลับ'}
            </button>
          ))}
        </div>

        {/* ── train-ticket card: stations on top, date + times below the perforation ── */}
        <div className="rounded-[14px] bg-surface overflow-hidden"
          style={{ border: '0.5px solid var(--color-brand-border)', boxShadow: '0 4px 14px rgba(2,112,251,0.07)' }}>
          <div className="p-3 pb-3.5">
            <div className="flex items-center justify-between text-[10.5px] text-ink-3 mb-1.5 px-0.5">
              <span className="inline-flex items-center gap-1"><IconTrain size={12} className="text-brand" /> สถานีต้นทาง</span>
              <span className="inline-flex items-center gap-1">สถานีปลายทาง <IconTrain size={12} className="text-brand" /></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <input className={stationField} value={v.dep_name ?? ''} onChange={(e) => set({ dep_name: e.target.value })}
                  placeholder="ชื่อสถานี" aria-label="สถานีต้นทาง" />
              </div>
              <IconTrain size={18} className="text-brand shrink-0" />
              <div className="flex-1 min-w-0">
                <input className={stationField} value={v.arr_name ?? ''} onChange={(e) => set({ arr_name: e.target.value })}
                  placeholder="ชื่อสถานี" aria-label="สถานีปลายทาง" />
              </div>
            </div>
          </div>

          {/* perforation with punched notches, like a real ticket */}
          <div className="relative mx-3" style={{ borderTop: '1.5px dashed var(--color-line-2)' }}>
            <span className="absolute size-[18px] rounded-full bg-surface" style={{ left: -22, top: -9.5, border: '0.5px solid var(--color-brand-border)' }} />
            <span className="absolute size-[18px] rounded-full bg-surface" style={{ right: -22, top: -9.5, border: '0.5px solid var(--color-brand-border)' }} />
          </div>

          <div className="p-3 pt-3.5 grid grid-cols-2 gap-2">
            {/* วันเดินทาง — the headline field of the ticket */}
            <div className="col-span-2 flex items-center h-11 rounded-[10px] px-3 gap-2 overflow-hidden"
              style={{ background: 'var(--color-brand-soft)', border: '1px solid var(--color-brand-border)' }}>
              <IconCalendarEvent size={17} style={{ color: 'var(--color-brand-mid)' }} className="shrink-0" />
              <span className="text-[11px] font-medium shrink-0" style={{ color: 'var(--color-brand-mid)' }}>วันเดินทาง</span>
              <input type="date" value={v.travel_date ?? ''} onChange={(e) => set({ travel_date: e.target.value })}
                className="flex-1 min-w-0 h-full bg-transparent outline-none text-[13.5px] font-semibold appearance-none" aria-label="วันเดินทาง" />
              {!!v.travel_date && (
                <button type="button" onClick={() => set({ travel_date: '' })} aria-label="ล้างวันที่"
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
          </div>
        </div>

        {/* รายละเอียดขบวน — ช่องไอคอนนำหน้า placeholder เป็นป้ายในตัว */}
        <div className="grid grid-cols-2 gap-2">
          <div className="relative"><Lead><IconTrain size={15} /></Lead>
            <input className={iconField} value={v.operator ?? ''} onChange={(e) => set({ operator: e.target.value })} placeholder="สายการเดินรถ JR / CR" aria-label="สายการเดินรถ" /></div>
          <div className="relative"><Lead><IconHash size={15} /></Lead>
            <input className={iconField} value={v.train_no ?? ''} onChange={(e) => set({ train_no: e.target.value })} placeholder="ขบวน เช่น G1234" aria-label="ขบวน" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="relative"><Lead><IconArmchair size={15} /></Lead>
            <input className={iconField} value={v.seat_class ?? ''} onChange={(e) => set({ seat_class: e.target.value })} placeholder="ชั้น First / Second" aria-label="ชั้นโดยสาร" /></div>
          <div className="relative"><Lead><IconSofa size={15} /></Lead>
            <input className={iconField} value={v.seat_no ?? ''} onChange={(e) => set({ seat_no: e.target.value })} placeholder="ที่นั่ง เช่น 11C, 11D" aria-label="ที่นั่ง" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="relative"><Lead><IconBoxMultiple size={15} /></Lead>
            <input className={iconField} value={v.car ?? ''} onChange={(e) => set({ car: e.target.value })} placeholder="ตู้ที่ เช่น 5" aria-label="ตู้ที่" /></div>
          <div className="relative"><Lead><IconDoor size={15} /></Lead>
            <input className={iconField} value={v.gate ?? ''} onChange={(e) => set({ gate: e.target.value })} placeholder="ประตู เช่น B2" aria-label="ประตู" /></div>
        </div>
        <div className="relative"><Lead><IconTicket size={15} /></Lead>
          <input className={iconField} value={v.booking_ref ?? ''} onChange={(e) => set({ booking_ref: e.target.value })} placeholder="รหัสจอง เช่น XKQP34" aria-label="รหัสจอง" /></div>

        <button onClick={save} disabled={busy} className="btn-primary w-full h-10 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        {initial && onDelete && (
          <button onClick={del} disabled={busy} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] text-[#D85A30]"><IconTrash size={15} /> ลบรถไฟ</button>
        )}
      </div>
    </Drawer>
  )
}
