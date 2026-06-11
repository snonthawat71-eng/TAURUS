import { useEffect, useState } from 'react'
import { IconTrash, IconMoodSmile } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import type { Trip } from '@/lib/database.types'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'
const lbl = 'text-[11px] text-ink-3'

const FLAGS = ['🇨🇳', '🇯🇵', '🇰🇷', '🇹🇼', '🇹🇭', '🇸🇬', '🇻🇳', '🇭🇰', '🇲🇾', '🇮🇩', '🇵🇭', '🇮🇳',
  '🇺🇸', '🇬🇧', '🇫🇷', '🇮🇹', '🇪🇸', '🇩🇪', '🇨🇭', '🇳🇱', '🇦🇺', '🇳🇿', '🇦🇪', '🌍']

export function TripEditor({
  open, onClose, initial, onSave, onDelete,
}: {
  open: boolean
  onClose: () => void
  initial: Trip | null
  onSave: (fields: { name: string; country: string; flag: string; start_date: string | null; end_date: string | null }) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [flag, setFlag] = useState('🌍')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [busy, setBusy] = useState(false)
  const [pickFlag, setPickFlag] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setCountry(initial?.country ?? '')
    setFlag(initial?.flag || '🌍')
    setStart(initial?.start_date ?? '')
    setEnd(initial?.end_date ?? '')
  }, [open, initial])

  async function save() {
    setBusy(true)
    await onSave({ name, country, flag, start_date: start || null, end_date: end || null })
    setBusy(false)
    onClose()
  }
  async function del() {
    if (!onDelete || !confirm('ลบทริปนี้และข้อมูลทั้งหมดในทริป?')) return
    setBusy(true); await onDelete(); setBusy(false); onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title={initial ? 'แก้ไขทริป' : 'สร้างทริปใหม่'}>
      <div className="space-y-3">
        <div>
          <div className={lbl}>ชื่อทริป</div>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Beijing · Tianjin" />
        </div>

        <div className="relative">
          <div className={lbl}>ประเทศ</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPickFlag((v) => !v)} title="เลือกธง"
              className="w-10 h-10 grid place-items-center hairline rounded-md shrink-0 text-[20px]">
              {flag && flag !== '🌍' ? flag : <IconMoodSmile size={18} className="text-ink-3" />}
            </button>
            <input className={field} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="พิมพ์ชื่อประเทศ เช่น China" />
          </div>
          {pickFlag && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPickFlag(false)} />
              <div className="absolute left-0 top-full mt-1 card p-2 shadow-lg z-50 w-[260px]">
                <div className="grid grid-cols-6 gap-1">
                  {FLAGS.map((f) => (
                    <button key={f} onClick={() => { setFlag(f); setPickFlag(false) }}
                      className="size-9 grid place-items-center rounded-md text-[18px] hover:bg-surface-2"
                      style={{ background: flag === f ? 'var(--color-brand-soft)' : 'transparent' }}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div><div className={lbl}>วันเริ่ม</div><input type="date" className={field} value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><div className={lbl}>วันสิ้นสุด</div><input type="date" className={field} value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>

        <button onClick={save} disabled={busy || !name} className="btn-primary w-full h-10 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        {initial && onDelete && (
          <button onClick={del} disabled={busy} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] text-[#D85A30]"><IconTrash size={15} /> ลบทริป</button>
        )}
      </div>
    </Drawer>
  )
}
