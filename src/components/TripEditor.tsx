import { useEffect, useState } from 'react'
import { IconTrash, IconMoodSmile, IconPlus } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { CURRENCIES } from '@/lib/fx'
import { confirmDialog } from '@/lib/confirm'
import type { Trip } from '@/lib/database.types'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'
const lbl = 'text-[11px] text-ink-3'

const FLAGS = ['🇨🇳', '🇯🇵', '🇰🇷', '🇹🇼', '🇹🇭', '🇸🇬', '🇻🇳', '🇭🇰', '🇲🇾', '🇮🇩', '🇵🇭', '🇮🇳',
  '🇺🇸', '🇬🇧', '🇫🇷', '🇮🇹', '🇪🇸', '🇩🇪', '🇨🇭', '🇳🇱', '🇦🇺', '🇳🇿', '🇦🇪', '🌍']

// Trip timezone — used to interpret itinerary stop times for push reminders.
const TIMEZONES = [
  { tz: 'Asia/Bangkok', label: 'ไทย / เวียดนาม (GMT+7)' },
  { tz: 'Asia/Tokyo', label: 'ญี่ปุ่น (GMT+9)' },
  { tz: 'Asia/Seoul', label: 'เกาหลีใต้ (GMT+9)' },
  { tz: 'Asia/Shanghai', label: 'จีน (GMT+8)' },
  { tz: 'Asia/Hong_Kong', label: 'ฮ่องกง (GMT+8)' },
  { tz: 'Asia/Taipei', label: 'ไต้หวัน (GMT+8)' },
  { tz: 'Asia/Singapore', label: 'สิงคโปร์ / มาเลเซีย (GMT+8)' },
  { tz: 'Asia/Jakarta', label: 'อินโดนีเซีย-จาการ์ตา (GMT+7)' },
  { tz: 'Asia/Manila', label: 'ฟิลิปปินส์ (GMT+8)' },
  { tz: 'Asia/Kolkata', label: 'อินเดีย (GMT+5:30)' },
  { tz: 'Asia/Dubai', label: 'ดูไบ / UAE (GMT+4)' },
  { tz: 'Europe/London', label: 'อังกฤษ (GMT+0/+1)' },
  { tz: 'Europe/Paris', label: 'ยุโรปกลาง (GMT+1/+2)' },
  { tz: 'America/New_York', label: 'สหรัฐ-ตะวันออก (GMT-5/-4)' },
  { tz: 'America/Los_Angeles', label: 'สหรัฐ-ตะวันตก (GMT-8/-7)' },
  { tz: 'Australia/Sydney', label: 'ออสเตรเลีย-ซิดนีย์ (GMT+10/+11)' },
]

export function TripEditor({
  open, onClose, initial, onSave, onDelete,
}: {
  open: boolean
  onClose: () => void
  initial: Trip | null
  onSave: (fields: { name: string; country: string; flag: string; cities: string[]; currency: string; timezone: string; start_date: string | null; end_date: string | null }) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [flag, setFlag] = useState('🌍')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [multi, setMulti] = useState(false)
  const [cities, setCities] = useState<string[]>([''])
  const [currency, setCurrency] = useState('CNY')
  const [timezone, setTimezone] = useState('Asia/Bangkok')
  const [busy, setBusy] = useState(false)
  const [pickFlag, setPickFlag] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setCountry(initial?.country ?? '')
    setFlag(initial?.flag || '🌍')
    setStart(initial?.start_date ?? '')
    setEnd(initial?.end_date ?? '')
    setCurrency(initial?.currency ?? 'CNY')
    // require an explicit choice (empty until picked) so the destination tz is
    // never silently wrong — that would break push reminder times
    setTimezone(initial?.timezone ?? '')
    const c = initial?.cities ?? []
    setMulti(c.length > 1)
    setCities(c.length ? c : [''])
  }, [open, initial])

  function setCity(i: number, v: string) { setCities((cs) => cs.map((c, idx) => (idx === i ? v : c))) }

  async function save() {
    if (!name.trim() || !timezone) return
    setBusy(true)
    const cleanCities = (multi ? cities : cities.slice(0, 1)).map((c) => c.trim()).filter(Boolean)
    const endSafe = end && start && end < start ? start : end
    await onSave({ name: name.trim(), country: country.trim(), flag, cities: cleanCities, currency, timezone, start_date: start || null, end_date: endSafe || null })
    setBusy(false)
    onClose()
  }
  async function del() {
    if (!onDelete || !(await confirmDialog({ title: 'ลบทริป', message: 'ลบทริปนี้และข้อมูลทั้งหมดในทริป? กู้คืนไม่ได้', danger: true, confirmLabel: 'ลบ' }))) return
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
          <div><div className={lbl}>วันเริ่ม</div><input type="date" className={field} value={start} onChange={(e) => { setStart(e.target.value); if (end && e.target.value && end < e.target.value) setEnd(e.target.value) }} /></div>
          <div><div className={lbl}>วันสิ้นสุด</div><input type="date" className={field} value={end} min={start || undefined} onChange={(e) => { const v = e.target.value; setEnd(v && start && v < start ? start : v) }} /></div>
        </div>

        <div>
          <div className={lbl}>สกุลเงินหลักของทริป</div>
          <select className={field} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.code} · {c.name}</option>)}
          </select>
          <p className="text-[11px] text-ink-3 mt-1">อัตราแลกเปลี่ยน/งบในเว็บจะอ้างอิงสกุลนี้</p>
        </div>

        <div>
          <div className={lbl}>โซนเวลาของทริป (ปลายทาง) <span className="text-[#D85A30]">*</span></div>
          <select className={[field, !timezone ? 'text-ink-3' : ''].join(' ')} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            <option value="" disabled>— เลือกโซนเวลาปลายทาง —</option>
            {!!timezone && !TIMEZONES.some((t) => t.tz === timezone) && <option value={timezone}>{timezone}</option>}
            {TIMEZONES.map((t) => <option key={t.tz} value={t.tz}>{t.label}</option>)}
          </select>
          <p className="text-[11px] text-ink-3 mt-1">จำเป็นต้องเลือก — ใช้คิดเวลาแจ้งเตือนตามแผน ตั้งเป็นเวลาประเทศปลายทางที่ไป</p>
        </div>

        {/* Cities */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className={lbl}>เมืองที่ไป</span>
            <div className="inline-flex gap-0.5 p-0.5 rounded-md bg-surface-2">
              {([[false, 'เมืองเดียว'], [true, 'หลายเมือง']] as const).map(([v, label]) => (
                <button key={label} onClick={() => { setMulti(v); if (v && cities.length < 2) setCities([cities[0] ?? '', '']) }}
                  className={['px-2.5 h-7 rounded-[6px] text-[11px] font-medium', multi === v ? 'bg-surface text-ink shadow-sm' : 'text-ink-3'].join(' ')}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {!multi ? (
            <input className={field} value={cities[0] ?? ''} onChange={(e) => setCity(0, e.target.value)} placeholder="เช่น Beijing" />
          ) : (
            <div className="space-y-2">
              {cities.map((c, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input className={field} value={c} onChange={(e) => setCity(i, e.target.value)} placeholder={`เมืองที่ ${i + 1}`} />
                  {cities.length > 1 && <button onClick={() => setCities((cs) => cs.filter((_, idx) => idx !== i))} className="text-ink-3 hover:text-[#D85A30] shrink-0"><IconTrash size={15} /></button>}
                </div>
              ))}
              <button onClick={() => setCities((cs) => [...cs, ''])} className="btn-link flex items-center gap-1 text-[12px]"><IconPlus size={13} /> เพิ่มเมือง</button>
            </div>
          )}
        </div>

        <button onClick={save} disabled={busy || !name || !timezone} className="btn-primary w-full h-10 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        {initial && onDelete && (
          <button onClick={del} disabled={busy} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] text-[#D85A30]"><IconTrash size={15} /> ลบทริป</button>
        )}
      </div>
    </Drawer>
  )
}
