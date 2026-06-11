import { useEffect, useState } from 'react'
import { Drawer } from './Drawer'
import type { StopInput } from '@/lib/mutations'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'

export function StopEditor({
  open, onClose, initial, onSave,
}: {
  open: boolean
  onClose: () => void
  initial: (StopInput & { id?: string }) | null
  onSave: (input: StopInput) => Promise<void>
}) {
  const [time, setTime] = useState('')
  const [place, setPlace] = useState('')
  const [note, setNote] = useState('')
  const [mapUrl, setMapUrl] = useState('')
  const [linkMode, setLinkMode] = useState('map')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setTime(initial?.time ?? '')
      setPlace(initial?.place_name ?? '')
      setNote(initial?.note ?? '')
      setMapUrl(initial?.map_url ?? '')
      setLinkMode(initial?.link_mode ?? 'map')
    }
  }, [open, initial])

  async function save() {
    setBusy(true)
    await onSave({ time: time || null, place_name: place || null, note: note || null, map_url: mapUrl || null, link_mode: linkMode })
    setBusy(false)
    onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title={initial?.id ? 'แก้ไขจุดแวะ' : 'เพิ่มจุดแวะ'}>
      <div className="space-y-3">
        <div>
          <label className="text-[11px] text-ink-3">เวลา</label>
          <input className={field} value={time} onChange={(e) => setTime(e.target.value)} placeholder="เช่น 09:00" />
        </div>
        <div>
          <label className="text-[11px] text-ink-3">ชื่อสถานที่ / กิจกรรม</label>
          <input className={field} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="เช่น Forbidden City" />
        </div>
        <div>
          <label className="text-[11px] text-ink-3">โน้ต</label>
          <textarea
            className="hairline rounded-md text-[13px] p-3 bg-surface w-full outline-none focus:border-brand resize-none"
            rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="รายละเอียดเพิ่มเติม"
          />
        </div>
        <div>
          <label className="text-[11px] text-ink-3">ลิงก์แผนที่ (ถ้ามี)</label>
          <input className={field} value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="https://maps.apple.com/?q=..." />
        </div>
        <div>
          <label className="text-[11px] text-ink-3">เมื่อแตะชื่อสถานที่</label>
          <div className="inline-flex gap-0.5 p-0.5 rounded-md bg-surface-2 mt-1">
            {([['map', 'เปิดแผนที่'], ['detail', 'ดูรายละเอียด']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setLinkMode(v)}
                className={['px-3 h-8 rounded-[6px] text-[12px] font-medium', linkMode === v ? 'bg-surface text-ink shadow-sm' : 'text-ink-3'].join(' ')}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-ink-3 mt-1">"ดูรายละเอียด" ใช้ได้เมื่อชื่อตรงกับสถานที่ในหน้า Places/Food</p>
        </div>
        <button onClick={save} disabled={busy || !place} className="btn-primary w-full h-10 disabled:opacity-50">
          {busy ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </Drawer>
  )
}
