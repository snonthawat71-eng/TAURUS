import { useLayoutEffect, useState } from 'react'
import { IconTrash, IconTrain } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { ClearableField } from './ClearableField'
import type { Train, FlightDirection } from '@/lib/database.types'
import type { TrainInput } from '@/lib/tripMutations'
import { confirmDialog } from '@/lib/confirm'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full min-w-0 outline-none focus:border-brand'
const lbl = 'text-[11px] text-ink-3'

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
        <div className="inline-flex gap-0.5 p-0.5 rounded-md bg-surface-2">
          {(['outbound', 'return'] as FlightDirection[]).map((d) => (
            <button key={d} onClick={() => onSwitchDirection ? onSwitchDirection(d, v) : set({ direction: d })}
              className={['px-3 h-7 rounded-[6px] text-[12px] font-medium', v.direction === d ? 'bg-surface text-ink shadow-sm' : 'text-ink-3'].join(' ')}>
              {d === 'outbound' ? 'ขาไป' : 'ขากลับ'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><div className={lbl}>สายการเดินรถ</div><input className={field} value={v.operator ?? ''} onChange={(e) => set({ operator: e.target.value })} placeholder="JR / CR" /></div>
          <div><div className={lbl}>ขบวน</div><input className={field} value={v.train_no ?? ''} onChange={(e) => set({ train_no: e.target.value })} placeholder="G1234" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <div className={lbl}>วันเดินทาง</div>
            <ClearableField type="date" ariaLabel="ล้างวันที่" value={v.travel_date ?? ''}
              onChange={(val) => set({ travel_date: val })} onClear={() => set({ travel_date: '' })} />
          </div>
          <div className="min-w-0"><div className={lbl}>รหัสจอง</div><input className={field} value={v.booking_ref ?? ''} onChange={(e) => set({ booking_ref: e.target.value })} placeholder="XKQP34" /></div>
        </div>
        {/* ── ต้นทาง (สถานี) ── */}
        <div className="rounded-lg p-3 space-y-2" style={{ border: '0.5px solid var(--color-line)' }}>
          <div className="text-[12px] font-medium text-ink-2 flex items-center gap-1.5"><IconTrain size={14} className="text-brand" /> ต้นทาง</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 sm:col-span-1"><div className={lbl}>ชื่อสถานี</div><input className={field} value={v.dep_name ?? ''} onChange={(e) => set({ dep_name: e.target.value })} placeholder="West Kowloon" /></div>
            <div className="min-w-0"><div className={lbl}>เวลาออก</div><ClearableField type="time" ariaLabel="ล้างเวลา" value={v.dep_time ?? ''} onChange={(val) => set({ dep_time: val })} onClear={() => set({ dep_time: '' })} /></div>
          </div>
        </div>

        {/* ── ปลายทาง (สถานี) ── */}
        <div className="rounded-lg p-3 space-y-2" style={{ border: '0.5px solid var(--color-line)' }}>
          <div className="text-[12px] font-medium text-ink-2 flex items-center gap-1.5"><IconTrain size={14} className="text-brand" /> ปลายทาง</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 sm:col-span-1"><div className={lbl}>ชื่อสถานี</div><input className={field} value={v.arr_name ?? ''} onChange={(e) => set({ arr_name: e.target.value })} placeholder="Guangzhou South" /></div>
            <div className="min-w-0"><div className={lbl}>เวลาถึง</div><ClearableField type="time" ariaLabel="ล้างเวลา" value={v.arr_time ?? ''} onChange={(val) => set({ arr_time: val })} onClear={() => set({ arr_time: '' })} /></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div><div className={lbl}>ชั้นโดยสาร</div><input className={field} value={v.seat_class ?? ''} onChange={(e) => set({ seat_class: e.target.value })} placeholder="First / Second" /></div>
          <div><div className={lbl}>ประตู</div><input className={field} value={v.gate ?? ''} onChange={(e) => set({ gate: e.target.value })} placeholder="B2" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><div className={lbl}>ตู้ที่</div><input className={field} value={v.car ?? ''} onChange={(e) => set({ car: e.target.value })} placeholder="5" /></div>
          <div><div className={lbl}>ที่นั่ง</div><input className={field} value={v.seat_no ?? ''} onChange={(e) => set({ seat_no: e.target.value })} placeholder="11C, 11D" /></div>
        </div>
        <button onClick={save} disabled={busy} className="btn-primary w-full h-10 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        {initial && onDelete && (
          <button onClick={del} disabled={busy} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] text-[#D85A30]"><IconTrash size={15} /> ลบรถไฟ</button>
        )}
      </div>
    </Drawer>
  )
}
