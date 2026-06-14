import { useEffect, useMemo, useState } from 'react'
import { Drawer } from './Drawer'
import { useTrip } from '@/contexts/TripContext'
import { catMeta } from '@/lib/placeMeta'
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
  const { places } = useTrip()
  const [time, setTime] = useState('')
  const [place, setPlace] = useState('')
  const [note, setNote] = useState('')
  const [mapUrl, setMapUrl] = useState('')
  const [linkMode, setLinkMode] = useState('map')
  const [busy, setBusy] = useState(false)

  // places the group has already added to the plan (from Places/Food/All)
  const inPlan = useMemo(() => places.filter((p) => p.in_plan && p.name), [places])

  useEffect(() => {
    if (open) {
      setTime(initial?.time ?? '')
      setPlace(initial?.place_name ?? '')
      setNote(initial?.note ?? '')
      setMapUrl(initial?.map_url ?? '')
      setLinkMode(initial?.link_mode ?? 'map')
    }
  }, [open, initial])

  function pickPlanned(id: string) {
    const p = inPlan.find((x) => x.id === id)
    if (!p) return
    setPlace(p.name ?? '')
    setMapUrl(p.map_url ?? '')
    setNote(p.note ?? '')
    setLinkMode('detail')
  }

  async function save() {
    setBusy(true)
    await onSave({ time: time || null, place_name: place || null, note: note || null, map_url: mapUrl || null, link_mode: linkMode })
    setBusy(false)
    onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title={initial?.id ? 'แก้ไขจุดแวะ' : 'เพิ่มจุดแวะ'}>
      <div className="space-y-3">
        {inPlan.length > 0 && (
          <div>
            <label className="text-[11px] text-ink-3">ดึงจากสถานที่ในแพลน</label>
            <select className={field} value="" onChange={(e) => { pickPlanned(e.target.value); e.target.value = '' }}>
              <option value="">— เลือกสถานที่ที่กดเพิ่มในแพลนไว้ —</option>
              {inPlan.map((p) => (
                <option key={p.id} value={p.id}>{catMeta(p.category).label} · {p.name}</option>
              ))}
            </select>
          </div>
        )}
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
          <div className="grid grid-cols-3 gap-1.5 mt-1.5">
            {([['map', 'เปิดแผนที่'], ['detail', 'ดูรายละเอียด'], ['none', 'ไม่มี']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setLinkMode(v)}
                className="h-9 rounded-md text-[12px] font-medium transition-colors"
                style={linkMode === v
                  ? { background: 'var(--color-brand)', color: '#fff' }
                  : { background: 'var(--color-surface-2)', color: 'var(--color-ink-2)' }}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-ink-3 mt-1.5">"ดูรายละเอียด" ใช้ได้เมื่อชื่อตรงกับสถานที่ในหน้า Places/Food</p>
        </div>
        <button onClick={save} disabled={busy || !place} className="btn-primary w-full h-10 disabled:opacity-50">
          {busy ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </Drawer>
  )
}
