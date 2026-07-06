import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconChevronLeft, IconPlaneTilt, IconCalendar, IconUsers, IconCheck, IconPlus, IconX,
  IconMapPin, IconCoin, IconLink, IconPencil,
} from '@tabler/icons-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { supabase } from '@/lib/supabase'
import { createTrip, addTraveler, claimTraveler } from '@/lib/tripMutations'
import { addDay } from '@/lib/mutations'
import { CURRENCIES } from '@/lib/fx'
import { TIMEZONES } from '@/lib/timezones'
import { ORDER } from '@/lib/avatars'
import { Avatar } from '@/components/Avatar'
import { toast } from '@/lib/toast'
import type { Traveler } from '@/lib/database.types'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full min-w-0 outline-none focus:border-brand'
const lbl = 'text-[11px] text-ink-3 mb-1'

// Destination presets — pick a country and currency/timezone/flag autofill.
const DESTS = [
  { name: 'Hongkong', flag: '🇭🇰', currency: 'HKD', tz: 'Asia/Hong_Kong' },
  { name: 'China', flag: '🇨🇳', currency: 'CNY', tz: 'Asia/Shanghai' },
  { name: 'Japan', flag: '🇯🇵', currency: 'JPY', tz: 'Asia/Tokyo' },
  { name: 'Korea', flag: '🇰🇷', currency: 'KRW', tz: 'Asia/Seoul' },
  { name: 'Taiwan', flag: '🇹🇼', currency: 'TWD', tz: 'Asia/Taipei' },
  { name: 'Singapore', flag: '🇸🇬', currency: 'SGD', tz: 'Asia/Singapore' },
  { name: 'Macau', flag: '🇲🇴', currency: 'HKD', tz: 'Asia/Macau' },
  { name: 'Europe', flag: '🇪🇺', currency: 'EUR', tz: 'Europe/Paris' },
  { name: 'UK', flag: '🇬🇧', currency: 'GBP', tz: 'Europe/London' },
  { name: 'USA', flag: '🇺🇸', currency: 'USD', tz: 'America/New_York' },
]

interface Seg { city: string; flag: string; currency: string; tz: string; until: string | null }
const blankSeg = (): Seg => ({ city: '', flag: '🌍', currency: 'CNY', tz: '', until: null })

type Phase = 'name' | 'dates' | 'city' | 'people' | 'confirm' | 'share'

const thDate = (d: string) => {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CreateTrip() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { profile, switchTrip, reload } = useTrip()

  const [phase, setPhase] = useState<Phase>('name')
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [segs, setSegs] = useState<Seg[]>([blankSeg()])
  const [cityIdx, setCityIdx] = useState(0)
  const [multi, setMulti] = useState(false) // "เที่ยวหลายเมือง?" toggled on the current segment
  const [people, setPeople] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<{ tripId: string; travelers: Traveler[] } | null>(null)
  const [sent, setSent] = useState<Set<string>>(new Set())

  const myName = profile?.nickname?.trim() || 'ฉัน'
  const allPeople = useMemo(() => [myName, ...people], [myName, people])
  const seg = segs[cityIdx]
  const days = start && end && end >= start
    ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1
    : null
  const stepNo = phase === 'name' ? 1 : phase === 'dates' ? 2 : phase === 'city' ? Math.min(3 + cityIdx, 4) : phase === 'people' ? 5 : 6

  const patchSeg = (p: Partial<Seg>) => setSegs((ss) => ss.map((s, i) => (i === cityIdx ? { ...s, ...p } : s)))
  function pickDest(name: string) {
    const d = DESTS.find((x) => x.name === name)
    if (d) patchSeg({ city: d.name, flag: d.flag, currency: d.currency, tz: d.tz })
    else patchSeg({ city: '' })
  }

  function back() {
    if (phase === 'name') { navigate('/'); return }
    if (phase === 'dates') setPhase('name')
    else if (phase === 'city') {
      if (cityIdx > 0) setCityIdx(cityIdx - 1)
      else setPhase('dates')
    } else if (phase === 'people') { setCityIdx(segs.length - 1); setPhase('city') }
    else if (phase === 'confirm') setPhase('people')
  }

  // city step actions
  function addAnotherCity() {
    if (!seg.city.trim() || !seg.tz) { toast.error('เลือกประเทศ/เมืองและโซนเวลาก่อน'); return }
    if (!seg.until) { toast.error('ระบุว่าอยู่เมืองนี้ถึงวันไหน-กี่โมงก่อน'); return }
    setSegs((ss) => (cityIdx === ss.length - 1 ? [...ss, blankSeg()] : ss))
    setCityIdx(cityIdx + 1)
    setMulti(false)
  }
  function cityNext() {
    if (!seg.city.trim() || !seg.tz) { toast.error('เลือกประเทศ/เมืองและโซนเวลาก่อน'); return }
    if (multi && cityIdx === 0) { addAnotherCity(); return } // "ถัดไป · กรอกเมืองที่ 2"
    patchSeg({ until: null }) // last segment runs to the end of the trip
    setPhase('people')
  }

  async function createAll() {
    if (!user || busy) return
    setBusy(true)
    try {
      const first = segs[0]
      const { id: tripId } = await createTrip(user.id, {
        name: name.trim(), country: first.city, flag: first.flag,
        cities: segs.map((s) => s.city), currency: first.currency, timezone: first.tz,
        segments: segs.map((s) => ({ city: s.city, flag: s.flag, currency: s.currency, tz: s.tz, until: s.until })),
        start_date: start || null, end_date: end || null,
      })
      // one itinerary day per trip date
      if (start && end && end >= start) {
        const dates: string[] = []
        const d = new Date(start + 'T00:00:00Z')
        while (d.toISOString().slice(0, 10) <= end) { dates.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1) }
        for (let i = 0; i < dates.length; i++) await addDay(tripId, i, dates[i])
      }
      // travelers — me first, claimed to my account right away
      const ids: string[] = []
      for (let i = 0; i < allPeople.length; i++) {
        ids.push(await addTraveler(tripId, { nickname: allPeople[i], avatar_color: ORDER[i % ORDER.length] }))
      }
      await claimTraveler(ids[0], user.id)
      const { data } = await supabase.from('travelers').select('*').eq('trip_id', tripId).order('created_at')
      switchTrip(tripId)
      setCreated({ tripId, travelers: (data ?? []) as Traveler[] })
      setPhase('share')
    } catch (e) {
      toast.error('สร้างทริปไม่สำเร็จ — ลองใหม่อีกครั้ง')
      console.error(e)
    } finally { setBusy(false) }
  }

  async function shareFor(t: Traveler) {
    if (!t.invite_token) { toast.error('ยังไม่ได้รัน SQL invites.sql — แชร์ลิงก์ไม่ได้'); return }
    const url = `${location.origin}/join/${t.invite_token}`
    const text = `มาร่วมทริป "${name.trim()}" กัน! เปิดลิงก์เพื่อยืนยันว่าคุณคือ "${t.nickname}" → ${url}`
    try {
      if (navigator.share) await navigator.share({ text })
      else { await navigator.clipboard.writeText(text); toast.success('คัดลอกลิงก์แล้ว — ส่งต่อได้เลย') }
      setSent((s) => new Set(s).add(t.id))
    } catch { /* user closed the share sheet */ }
  }

  const art = (icon: ReactNode, flag?: string) => (
    <div className="relative mx-auto mt-2 size-16 rounded-full grid place-items-center"
      style={flag ? { background: 'var(--color-surface)', border: '0.5px solid var(--color-line)' }
        : { background: 'var(--color-brand-soft)', border: '0.5px solid var(--color-brand-border)', color: 'var(--color-brand)' }}>
      {flag ? <span className="text-[30px] leading-none">{flag}</span> : icon}
      {flag && <span className="absolute -right-1 -bottom-1 size-[22px] rounded-full bg-surface hairline grid place-items-center text-ink-2"><IconPencil size={11} /></span>}
    </div>
  )

  return (
    <div className="min-h-dvh bg-canvas flex flex-col max-w-[520px] mx-auto">
      {/* header + progress */}
      {phase !== 'share' && (
        <>
          <div className="flex items-center justify-between px-4 pt-4">
            <button onClick={back} className="btn-icon" aria-label="ย้อนกลับ"><IconChevronLeft size={16} /></button>
            <span className="text-[12px] text-ink-3">ขั้นตอน {stepNo}/6</span>
          </div>
          <div className="flex gap-1 px-4 pt-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <span key={n} className="flex-1 h-[3px] rounded-full" style={{ background: n <= stepNo ? 'var(--color-brand)' : 'var(--color-line)' }} />
            ))}
          </div>
        </>
      )}

      <div className="flex-1 px-4 pt-5 pb-2 overflow-y-auto">
        {phase === 'name' && (
          <>
            {art(<IconPlaneTilt size={28} stroke={1.8} />)}
            <h1 className="text-[18px] font-medium text-center mt-4">ตั้งชื่อทริปของคุณ</h1>
            <p className="text-[12px] text-ink-3 text-center mt-1.5">ชื่อนี้จะโชว์บนการ์ดทริปหน้าแรก — เปลี่ยนทีหลังได้เสมอ</p>
            <div className="mt-5"><div className={lbl}>ชื่อทริป</div>
              <input className={field} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Hongkong 2026" />
            </div>
          </>
        )}

        {phase === 'dates' && (
          <>
            {art(<IconCalendar size={28} stroke={1.8} />)}
            <h1 className="text-[18px] font-medium text-center mt-4">เดินทางเมื่อไหร่?</h1>
            <p className="text-[12px] text-ink-3 text-center mt-1.5">เลือกวันไปและวันกลับ</p>
            <div className="grid grid-cols-2 gap-2.5 mt-5">
              <div><div className={lbl}>วันไป</div>
                <input type="date" className={field} value={start} onChange={(e) => { setStart(e.target.value); if (end && e.target.value && end < e.target.value) setEnd(e.target.value) }} /></div>
              <div><div className={lbl}>วันกลับ</div>
                <input type="date" className={field} value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} /></div>
            </div>
            {days != null && (
              <div className="text-[11px] mt-2 flex items-center gap-1" style={{ color: '#1D9E75' }}>
                <IconCheck size={12} /> รวม {days} วัน — สร้างแพลนรายวันให้อัตโนมัติ
              </div>
            )}
          </>
        )}

        {phase === 'city' && (
          <>
            {art(null, seg.flag)}
            <h1 className="text-[18px] font-medium text-center mt-4">{cityIdx === 0 ? 'จะไปเที่ยวที่ไหน?' : `เมืองที่ ${cityIdx + 1}`}</h1>
            {cityIdx > 0 && segs[cityIdx - 1].until && (
              <p className="text-[12px] text-ink-3 text-center mt-1.5">ตั้งแต่ {thDate(segs[cityIdx - 1].until!.slice(0, 10))} {segs[cityIdx - 1].until!.slice(11, 16)} เป็นต้นไป</p>
            )}
            <div className="space-y-3 mt-5">
              <div><div className={lbl}>ประเทศ / เมือง</div>
                <select className={field} value={DESTS.some((d) => d.name === seg.city) ? seg.city : ''} onChange={(e) => pickDest(e.target.value)}>
                  <option value="" disabled>— เลือกปลายทาง —</option>
                  {DESTS.map((d) => <option key={d.name} value={d.name}>{d.flag} {d.name}</option>)}
                </select>
                <input className={`${field} mt-2`} value={seg.city} onChange={(e) => patchSeg({ city: e.target.value })} placeholder="หรือพิมพ์ชื่อเมืองเอง เช่น Shenzhen" />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div><div className={lbl}>ค่าเงิน</div>
                  <select className={field} value={seg.currency} onChange={(e) => patchSeg({ currency: e.target.value })}>
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                  </select>
                  <div className="text-[11px] mt-1 flex items-center gap-1" style={{ color: '#1D9E75' }}><IconCheck size={12} /> เติมให้อัตโนมัติ — แก้ได้</div>
                </div>
                <div><div className={lbl}>โซนเวลา</div>
                  <select className={[field, !seg.tz ? 'text-ink-3' : ''].join(' ')} value={seg.tz} onChange={(e) => patchSeg({ tz: e.target.value })}>
                    <option value="" disabled>— เลือก —</option>
                    {TIMEZONES.map((t) => <option key={t.tz} value={t.tz}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {/* อยู่เมืองนี้ถึงเมื่อไหร่ — โผล่เมื่อกด "เที่ยวหลายเมือง?" (เมืองแรก)
                  หรือกด "มีอีกเมือง" (เมืองถัดๆ ไป) */}
              {(multi || cityIdx > 0) && (
                <div className="rounded-[12px] p-3" style={{ background: 'var(--color-brand-soft)', border: '0.5px solid var(--color-brand-border)' }}>
                  <div className="text-[12px] font-medium flex items-center gap-1.5 mb-2" style={{ color: 'var(--color-brand-dark)' }}>
                    <IconMapPin size={13} /> อยู่ {seg.city || 'เมืองนี้'} ถึงเมื่อไหร่?{cityIdx > 0 ? ' (เว้นว่าง = จนถึงวันกลับ)' : ''}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <input type="date" className={field} min={start || undefined} max={end || undefined}
                      value={seg.until?.slice(0, 10) ?? ''}
                      onChange={(e) => patchSeg({ until: e.target.value ? `${e.target.value}T${seg.until?.slice(11, 16) || '12:00'}` : null })} />
                    <input type="time" className={field} value={seg.until?.slice(11, 16) ?? ''}
                      onChange={(e) => seg.until && patchSeg({ until: `${seg.until.slice(0, 10)}T${e.target.value || '12:00'}` })} />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {phase === 'people' && (
          <>
            {art(<IconUsers size={28} stroke={1.8} />)}
            <h1 className="text-[18px] font-medium text-center mt-4">ใครไปบ้าง?</h1>
            <p className="text-[12px] text-ink-3 text-center mt-1.5">ใส่ชื่อเล่นทีละคน — เดี๋ยวได้ลิงก์เชิญเฉพาะคนตอนจบ</p>
            <div className="flex flex-wrap gap-2 mt-5">
              {allPeople.map((p, i) => (
                <span key={`${p}-${i}`} className="inline-flex items-center gap-1.5 rounded-full hairline bg-surface pl-1.5 pr-3 py-1 text-[13px]">
                  <Avatar name={p} color={ORDER[i % ORDER.length]} size={24} ring={false} />
                  {p}
                  {i === 0
                    ? <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)' }}>คุณ</span>
                    : <button onClick={() => setPeople((ps) => ps.filter((_, idx) => idx !== i - 1))} className="text-ink-3" aria-label={`ลบ ${p}`}><IconX size={12} /></button>}
                </span>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <input className={field} value={newName} placeholder="พิมพ์ชื่อเล่น…"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) { setPeople((ps) => [...ps, newName.trim()]); setNewName('') } }} />
              <button onClick={() => { if (newName.trim()) { setPeople((ps) => [...ps, newName.trim()]); setNewName('') } }}
                className="shrink-0 h-10 px-4 rounded-md text-[13px] font-medium inline-flex items-center gap-1"
                style={{ border: '0.5px solid var(--color-brand-border)', color: 'var(--color-brand-mid)', background: 'var(--color-surface)' }}>
                <IconPlus size={14} /> เพิ่ม
              </button>
            </div>
          </>
        )}

        {phase === 'confirm' && (
          <>
            <h1 className="text-[18px] font-medium text-center mt-1">ตรวจสอบก่อนสร้างทริป</h1>
            <div className="relative flex flex-col mt-4">
              <div className="relative -mb-3 pt-1 pb-4 px-3.5 rounded-t-[14px] flex items-center gap-1.5 text-white" style={{ background: 'var(--color-brand)' }}>
                <IconPlaneTilt size={14} className="text-white/90" />
                <span className="text-[13px] font-medium truncate">{name.trim() || 'ทริปใหม่'}</span>
                <span className="text-[11px] text-white/80 ml-auto shrink-0">{thDate(start)} – {thDate(end)}{days ? ` · ${days} วัน` : ''}</span>
              </div>
              <div className="card relative">
                <div className="flex gap-2.5 px-3.5 py-3">
                  <IconMapPin size={16} className="text-brand shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-[10.5px] text-ink-3">เมือง</div>
                    <div className="text-[13px] mt-0.5 flex items-center gap-1.5 flex-wrap">
                      {segs.map((s, i) => (
                        <span key={i} className="inline-flex items-center gap-1">
                          {i > 0 && <span className="text-[10.5px] text-ink-3">— {segs[i - 1].until ? `${thDate(segs[i - 1].until!.slice(0, 10))} ${segs[i - 1].until!.slice(11, 16)}` : ''} →</span>}
                          {s.flag} {s.city}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2.5 px-3.5 py-3" style={{ borderTop: '0.5px solid var(--color-line)' }}>
                  <IconCoin size={16} className="text-brand shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10.5px] text-ink-3">ค่าเงิน · โซนเวลา</div>
                    <div className="text-[13px] mt-0.5">{[...new Set(segs.map((s) => s.currency))].join(' → ')}
                      {segs.length > 1 && <span className="text-ink-3"> (สลับตามช่วงเมืองอัตโนมัติ)</span>}</div>
                  </div>
                </div>
                <div className="flex gap-2.5 px-3.5 py-3" style={{ borderTop: '0.5px solid var(--color-line)' }}>
                  <IconUsers size={16} className="text-brand shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10.5px] text-ink-3">ผู้เดินทาง {allPeople.length} คน</div>
                    <div className="flex gap-1 mt-1.5">
                      {allPeople.map((p, i) => <Avatar key={i} name={p} color={ORDER[i % ORDER.length]} size={26} ring={false} />)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {phase === 'share' && created && (
          <>
            <div className="flex justify-end pt-2">
              <span className="text-[12px] inline-flex items-center gap-1" style={{ color: '#1D9E75' }}><IconCheck size={13} /> สร้างทริปแล้ว</span>
            </div>
            <div className="mx-auto mt-2 size-16 rounded-full grid place-items-center" style={{ background: '#E1F5EE', border: '0.5px solid #BFE7D8', color: '#1D9E75' }}>
              <IconCheck size={28} stroke={1.8} />
            </div>
            <h1 className="text-[18px] font-medium text-center mt-4">ชวนเพื่อนร่วมทริป</h1>
            <p className="text-[12px] text-ink-3 text-center mt-1.5 leading-relaxed">ลิงก์ของใครส่งให้คนนั้น — เพื่อนเปิดลิงก์ปุ๊บระบบรู้ทันที<br />ว่าเป็นใคร ไม่ต้องตั้งค่าอะไรอีก</p>
            <div className="space-y-2 mt-5">
              {created.travelers.map((t, i) => (
                <div key={t.id} className="card flex items-center gap-2.5 p-2.5">
                  <Avatar name={t.nickname} color={t.avatar_color ?? ORDER[i % ORDER.length]} size={30} ring={false} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{t.nickname}</div>
                    {t.user_id === user?.id && <div className="text-[10.5px] text-ink-3">เจ้าของทริป</div>}
                  </div>
                  {t.user_id === user?.id
                    ? <span className="text-[11px] text-ink-3 pr-1">คุณ</span>
                    : (
                      <button onClick={() => shareFor(t)}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-medium"
                        style={sent.has(t.id)
                          ? { background: 'var(--color-surface-2)', color: 'var(--color-ink-3)', border: '0.5px solid var(--color-line)' }
                          : { background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }}>
                        {sent.has(t.id) ? <><IconCheck size={12} /> ส่งแล้ว</> : <><IconLink size={12} /> แชร์ลิงก์</>}
                      </button>
                    )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* footer buttons */}
      <div className="px-4 pb-6 pt-2 space-y-2">
        {phase === 'name' && <button onClick={() => name.trim() && setPhase('dates')} disabled={!name.trim()} className="btn-primary w-full h-10 disabled:opacity-50">ถัดไป</button>}
        {phase === 'dates' && <button onClick={() => start && end && setPhase('city')} disabled={!start || !end} className="btn-primary w-full h-10 disabled:opacity-50">ถัดไป</button>}
        {phase === 'city' && (
          <>
            {cityIdx > 0 && (
              <button onClick={addAnotherCity} className="w-full h-10 rounded-md text-[13px] font-medium inline-flex items-center justify-center gap-1.5"
                style={{ border: '0.5px solid var(--color-brand-border)', color: 'var(--color-brand-mid)', background: 'var(--color-surface)' }}>
                <IconPlus size={14} /> มีอีกเมือง
              </button>
            )}
            <button onClick={cityNext} className="btn-primary w-full h-10">
              {multi && cityIdx === 0 ? 'ถัดไป · กรอกเมืองที่ 2' : 'ถัดไป'}
            </button>
            {cityIdx === 0 && (
              <button onClick={() => { setMulti((m) => !m); if (multi) patchSeg({ until: null }) }}
                className="w-full h-8 text-[12px] text-ink-3 inline-flex items-center justify-center gap-1">
                {multi ? <><IconX size={12} /> ยกเลิกเที่ยวหลายเมือง</> : <>🏙️ เที่ยวหลายเมือง?</>}
              </button>
            )}
          </>
        )}
        {phase === 'people' && <button onClick={() => setPhase('confirm')} className="btn-primary w-full h-10">เสร็จสิ้น</button>}
        {phase === 'confirm' && (
          <>
            <button onClick={createAll} disabled={busy} className="btn-primary w-full h-10 disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
              <IconCheck size={15} /> {busy ? 'กำลังสร้างทริป…' : 'ยืนยันสร้างทริป'}
            </button>
            <button onClick={back} disabled={busy} className="w-full h-8 text-[12px] text-ink-3">กลับไปแก้ไข</button>
          </>
        )}
        {phase === 'share' && (
          <>
            <button onClick={async () => { await reload(); navigate('/info') }} className="btn-primary w-full h-10">ไปที่ทริป</button>
            <div className="text-center text-[11px] text-ink-3">แชร์ทีหลังได้ในหน้า Info</div>
          </>
        )}
      </div>
    </div>
  )
}
