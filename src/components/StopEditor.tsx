import { useEffect, useMemo, useState } from 'react'
import { IconCheck } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { SignedImage } from './SignedImage'
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
  const [pickedId, setPickedId] = useState<string | null>(null)

  // places the group has already added to the plan (from Places/Food/All)
  const inPlan = useMemo(() => places.filter((p) => p.in_plan && p.name), [places])

  useEffect(() => {
    if (open) {
      setTime(initial?.time ?? '')
      setPlace(initial?.place_name ?? '')
      setNote(initial?.note ?? '')
      setMapUrl(initial?.map_url ?? '')
      setLinkMode(initial?.link_mode ?? 'map')
      setPickedId(null)
    }
  }, [open, initial])

  function pickPlanned(id: string) {
    const p = inPlan.find((x) => x.id === id)
    if (!p) return
    if (pickedId === id) { setPickedId(null); return } // tap again to deselect
    setPickedId(id)
    setPlace(p.name ?? '')
    setMapUrl(p.map_url ?? '')
    setNote(p.note ?? '')
    setLinkMode('detail')
  }

  async function save() {
    setBusy(true)
    await onSave({ time: time || null, place_name: place.trim() || null, note: note || null, map_url: mapUrl || null, link_mode: linkMode })
    setBusy(false)
    onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title={initial?.id ? 'แก้ไขจุดแวะ' : 'เพิ่มจุดแวะ'}>
      <div className="space-y-3">
        {inPlan.length > 0 && (
          <div>
            <label className="text-[11px] text-ink-3">ดึงจากสถานที่ในแพลน — แตะเพื่อเติมข้อมูล</label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar mt-1.5 -mx-1 px-1 pb-1">
              {inPlan.map((p) => {
                const meta = catMeta(p.category)
                const Icon = meta.icon
                const sel = pickedId === p.id
                return (
                  <button key={p.id} onClick={() => pickPlanned(p.id)}
                    className="relative shrink-0 w-[104px] rounded-[10px] overflow-hidden text-left bg-surface transition"
                    style={{ border: `1.5px solid ${sel ? 'var(--color-brand)' : 'var(--color-line)'}` }}>
                    <div className="h-[68px] relative">
                      <SignedImage url={p.photo_url} path={p.photo_path} focus={p.photo_focus} alt={p.name ?? ''} className="w-full h-full object-cover"
                        fallback={<div className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><Icon size={22} style={{ color: meta.fg }} /></div>} />
                      {sel && <div className="absolute inset-0 grid place-items-center" style={{ background: 'rgba(2,112,251,0.35)' }}><span className="size-6 rounded-full bg-brand grid place-items-center"><IconCheck size={15} className="text-white" /></span></div>}
                    </div>
                    <div className="p-1.5">
                      <div className="text-[11px] font-medium leading-tight line-clamp-2">{p.name}</div>
                      <div className="flex items-center gap-1 text-[10px] mt-0.5" style={{ color: meta.fg }}>
                        <Icon size={11} /> <span className="truncate">{meta.label}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div>
          <label className="text-[11px] text-ink-3">เวลา</label>
          <input type="time" className={[field, 'appearance-none'].join(' ')} value={time} onChange={(e) => setTime(e.target.value)} />
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
        <button onClick={save} disabled={busy || !place.trim()} className="btn-primary w-full h-10 disabled:opacity-50">
          {busy ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </Drawer>
  )
}
