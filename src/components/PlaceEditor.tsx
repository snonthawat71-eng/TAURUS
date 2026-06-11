import { useEffect, useState } from 'react'
import { IconTrash } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { CATEGORY, PLACE_CATEGORIES, FOOD_CATEGORIES } from '@/lib/placeMeta'
import type { Place, PlaceGroup } from '@/lib/database.types'
import type { PlaceInput } from '@/lib/placeMutations'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'
const lbl = 'text-[11px] text-ink-3'

const LINE_COLORS = [
  { name: 'น้ำเงิน', color: '#185FA5' },
  { name: 'ฟ้า', color: '#378ADD' },
  { name: 'ส้ม', color: '#EF9F27' },
  { name: 'ม่วง', color: '#7F77DD' },
  { name: 'เทา', color: '#888780' },
]

export function PlaceEditor({
  open, onClose, group, initial, onSave, onDelete,
}: {
  open: boolean
  onClose: () => void
  group: PlaceGroup
  initial: Place | null
  onSave: (fields: PlaceInput) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const cats = group === 'food' ? FOOD_CATEGORIES : PLACE_CATEGORIES
  const [name, setName] = useState('')
  const [category, setCategory] = useState(cats[0])
  const [line, setLine] = useState('')
  const [color, setColor] = useState(LINE_COLORS[0].color)
  const [station, setStation] = useState('')
  const [mapUrl, setMapUrl] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setCategory(initial?.category && cats.includes(initial.category) ? initial.category : cats[0])
    setLine(initial?.station_line ?? '')
    setColor(initial?.station_color ?? LINE_COLORS[0].color)
    setStation(initial?.station_name ?? '')
    setMapUrl(initial?.map_url ?? '')
    setNote(initial?.note ?? '')
  }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setBusy(true)
    await onSave({
      group_type: group, name, category, station_line: line, station_color: color,
      station_name: station, map_url: mapUrl, note,
    })
    setBusy(false)
    onClose()
  }
  async function del() {
    if (!onDelete || !confirm('ลบรายการนี้?')) return
    setBusy(true); await onDelete(); setBusy(false); onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title={initial ? 'แก้ไขรายการ' : (group === 'food' ? 'เพิ่มร้าน' : 'เพิ่มสถานที่')}>
      <div className="space-y-3">
        <div><div className={lbl}>ชื่อ</div><input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Forbidden City" /></div>
        <div>
          <div className={lbl}>หมวด</div>
          <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
            {cats.map((c) => <option key={c} value={c}>{CATEGORY[c].label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><div className={lbl}>สาย / การเดินทาง</div><input className={field} value={line} onChange={(e) => setLine(e.target.value)} placeholder="Line 1 / Bus" /></div>
          <div><div className={lbl}>สถานี</div><input className={field} value={station} onChange={(e) => setStation(e.target.value)} placeholder="Wangfujing" /></div>
        </div>
        <div>
          <div className={lbl}>สีสาย</div>
          <div className="flex gap-1.5 mt-1">
            {LINE_COLORS.map((c) => (
              <button key={c.color} onClick={() => setColor(c.color)} title={c.name}
                className="size-6 rounded-full" style={{ background: c.color, outline: color === c.color ? '2px solid var(--color-ink)' : 'none', outlineOffset: 2 }} />
            ))}
          </div>
        </div>
        <div><div className={lbl}>โน้ต</div>
          <textarea className="hairline rounded-md text-[13px] p-3 bg-surface w-full outline-none focus:border-brand resize-none" rows={2}
            value={note} onChange={(e) => setNote(e.target.value)} placeholder="รายละเอียด เช่น ควรจองล่วงหน้า" />
        </div>
        <div><div className={lbl}>ลิงก์แผนที่</div><input className={field} value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="https://maps.apple.com/?q=..." /></div>
        <button onClick={save} disabled={busy || !name} className="btn-primary w-full h-10 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        {initial && onDelete && (
          <button onClick={del} disabled={busy} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] text-[#D85A30]"><IconTrash size={15} /> ลบรายการ</button>
        )}
      </div>
    </Drawer>
  )
}
