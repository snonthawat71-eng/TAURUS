import { useEffect, useState } from 'react'
import { Drawer } from './Drawer'
import { ClearableField } from './ClearableField'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'

export function DayEditor({
  open, onClose, initial, onSave,
}: {
  open: boolean
  onClose: () => void
  initial: { label: string | null; day_date: string | null } | null
  onSave: (fields: { label: string; day_date: string | null }) => Promise<void>
}) {
  const [label, setLabel] = useState('')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setLabel(initial?.label ?? '')
      setDate(initial?.day_date ?? '')
    }
  }, [open, initial])

  async function save() {
    setBusy(true)
    await onSave({ label, day_date: date || null })
    setBusy(false)
    onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title="แก้ไขวัน">
      <div className="space-y-3">
        <div>
          <label className="text-[11px] text-ink-3">วันที่</label>
          <ClearableField type="date" ariaLabel="ล้างวันที่" value={date ?? ''}
            onChange={setDate} onClear={() => setDate('')} />
        </div>
        <div>
          <label className="text-[11px] text-ink-3">หัวข้อวัน</label>
          <input className={field} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="เช่น พระราชวัง · ใจกลางเมือง" />
        </div>
        <button onClick={save} disabled={busy} className="btn-primary w-full h-10 disabled:opacity-50">
          {busy ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </Drawer>
  )
}
