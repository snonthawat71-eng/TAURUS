import { useEffect, useState } from 'react'
import { IconPlus, IconTrash, IconArrowDown, IconMap2 } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { ColorPicker } from './ColorPicker'
import { MetroMapPicker } from './MetroMapPicker'
import { useTrip } from '@/contexts/TripContext'
import { getNetworkForTrip } from '@/lib/metro'
import type { Transit, TransitLeg } from '@/lib/database.types'

const field = 'hairline rounded-md text-[13px] h-9 px-2.5 bg-surface w-full outline-none focus:border-brand'
const lbl = 'text-[10px] text-ink-3'

function emptyLeg(): TransitLeg {
  return { line: '', color: '#185FA5', from: '', to: '', direction: '', stops: undefined, minutes: undefined }
}

export function TransitEditor({
  open, onClose, initial, onSave,
}: {
  open: boolean
  onClose: () => void
  initial: Transit | null
  onSave: (transit: Transit | null) => Promise<void>
}) {
  const { trip } = useTrip()
  const net = getNetworkForTrip(trip)
  const [legs, setLegs] = useState<TransitLeg[]>([])
  const [exitLabel, setExitLabel] = useState('')
  const [exitNote, setExitNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setLegs(initial?.legs?.length ? initial.legs.map((l) => ({ ...l })) : [emptyLeg()])
      setExitLabel(initial?.exit?.label ?? '')
      setExitNote(initial?.exit?.note ?? '')
    }
  }, [open, initial])

  function patch(i: number, p: Partial<TransitLeg>) {
    setLegs((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...p } : l)))
  }
  function patchTransfer(i: number, p: { walkMeters?: number; minutes?: number } | null) {
    setLegs((ls) => ls.map((l, idx) => (idx === i ? { ...l, transferAfter: p ?? undefined } : l)))
  }

  async function save() {
    setBusy(true)
    const clean = legs.filter((l) => l.line || l.from || l.to)
    const transit: Transit | null = clean.length
      ? { legs: clean, ...(exitLabel ? { exit: { label: exitLabel, note: exitNote || undefined } } : {}) }
      : null
    await onSave(transit)
    setBusy(false)
    onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title="เส้นทางรถไฟฟ้า">
      <div className="space-y-3">
        {net && (
          <button onClick={() => setMapOpen(true)}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-md text-[13px] font-medium"
            style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }}>
            <IconMap2 size={17} /> เลือกจากแผนที่ {net.name} (คำนวณจุดเปลี่ยนสายให้)
          </button>
        )}
        {legs.map((leg, i) => (
          <div key={i} className="card p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-ink-2">ช่วงที่ {i + 1}</span>
              <button onClick={() => setLegs((ls) => ls.filter((_, idx) => idx !== i))}
                className="text-ink-3 hover:text-[#D85A30]"><IconTrash size={15} /></button>
            </div>

            {/* line + color */}
            <div>
              <div className={lbl}>ชื่อสาย</div>
              <input className={field} value={leg.line} onChange={(e) => patch(i, { line: e.target.value })} placeholder="เช่น Line 5 / Airport Express" />
              <ColorPicker value={leg.color} onChange={(c) => patch(i, { color: c })} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className={lbl}>สถานีขึ้น</div>
                <input className={field} value={leg.from} onChange={(e) => patch(i, { from: e.target.value })} />
              </div>
              <div>
                <div className={lbl}>สถานีลง</div>
                <input className={field} value={leg.to} onChange={(e) => patch(i, { to: e.target.value })} />
              </div>
            </div>

            <div>
              <div className={lbl}>ทิศทาง / ปลายทาง</div>
              <input className={field} value={leg.direction ?? ''} onChange={(e) => patch(i, { direction: e.target.value })} placeholder="เช่น ทาง Gucheng" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className={lbl}>จำนวนสถานี</div>
                <input type="number" className={field} value={leg.stops ?? ''} onChange={(e) => patch(i, { stops: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div>
                <div className={lbl}>เวลา (นาที)</div>
                <input type="number" className={field} value={leg.minutes ?? ''} onChange={(e) => patch(i, { minutes: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
            </div>

            {/* transfer to next */}
            {i < legs.length - 1 && (
              <label className="flex items-center gap-2 text-[12px] text-ink-2">
                <input type="checkbox" checked={!!leg.transferAfter}
                  onChange={(e) => patchTransfer(i, e.target.checked ? { minutes: 2 } : null)} />
                มีเดินเปลี่ยนสายก่อนช่วงถัดไป
              </label>
            )}
            {i < legs.length - 1 && leg.transferAfter && (
              <div className="grid grid-cols-2 gap-2 pl-6">
                <div>
                  <div className={lbl}>ระยะเดิน (เมตร)</div>
                  <input type="number" className={field} value={leg.transferAfter.walkMeters ?? ''} onChange={(e) => patchTransfer(i, { ...leg.transferAfter, walkMeters: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
                <div>
                  <div className={lbl}>เวลาเดิน (นาที)</div>
                  <input type="number" className={field} value={leg.transferAfter.minutes ?? ''} onChange={(e) => patchTransfer(i, { ...leg.transferAfter, minutes: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
              </div>
            )}
          </div>
        ))}

        <button onClick={() => setLegs((ls) => [...ls, emptyLeg()])} className="btn-link flex items-center gap-1.5">
          <IconPlus size={15} /> เพิ่มช่วงเดินทาง
        </button>

        <div className="card p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2"><IconArrowDown size={14} /> ทางออกปลายทาง</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className={lbl}>ป้ายทางออก</div>
              <input className={field} value={exitLabel} onChange={(e) => setExitLabel(e.target.value)} placeholder="เช่น Exit E3" />
            </div>
            <div>
              <div className={lbl}>โน้ต</div>
              <input className={field} value={exitNote} onChange={(e) => setExitNote(e.target.value)} placeholder="เช่น เดิน ~3 นาที" />
            </div>
          </div>
        </div>

        <button onClick={save} disabled={busy} className="btn-primary w-full h-10 disabled:opacity-50">
          {busy ? 'กำลังบันทึก...' : 'บันทึกเส้นทาง'}
        </button>
      </div>

      {net && mapOpen && (
        <MetroMapPicker
          net={net}
          onClose={() => setMapOpen(false)}
          onResult={(t) => { setLegs(t.legs.map((l) => ({ ...l }))); setMapOpen(false) }}
        />
      )}
    </Drawer>
  )
}
