import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  IconChevronLeft, IconPlaneTilt, IconCalendar, IconUsers, IconCheck, IconPlus, IconX,
  IconMapPin, IconLink, IconPencil, IconBuildingSkyscraper,
} from '@tabler/icons-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { supabase } from '@/lib/supabase'
import { createTrip, updateTrip, addTraveler, claimTraveler } from '@/lib/tripMutations'
import { updateDay } from '@/lib/mutations'
import { CURRENCIES } from '@/lib/fx'
import { TIMEZONES } from '@/lib/timezones'
import { ORDER } from '@/lib/avatars'
import { Avatar } from '@/components/Avatar'
import { ClearableField } from '@/components/ClearableField'
import { toast } from '@/lib/toast'
import type { Traveler } from '@/lib/database.types'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full min-w-0 outline-none focus:border-brand'
const lbl = 'text-[11px] text-ink-3 mb-1'

// Destination presets — pick a country and currency/timezone/flag autofill.
// The CITY stays for the user to type (ข้อ 2).
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

interface Seg { country: string; city: string; flag: string; currency: string; tz: string; until: string | null }
const blankSeg = (): Seg => ({ country: '', city: '', flag: '🌍', currency: 'CNY', tz: '', until: null })
const segName = (s: Seg) => s.city.trim() || s.country.trim()

interface Person { nick: string; full: string }

type Phase = 'name' | 'dates' | 'city' | 'people' | 'confirm' | 'share'

const thDate = (d: string | null | undefined) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
const thDay = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })
const tzLabel = (tz: string) => TIMEZONES.find((t) => t.tz === tz)?.label ?? tz

// 30-minute time choices for the "ย้ายเมืองกี่โมง" select
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

export default function CreateTrip() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const { profile, switchTrip, reload, trips } = useTrip()

  // "พร้อมเดินทางแล้ว" on a draft trip → same wizard, prefilled, saving into
  // the existing trip (nothing planned so far is lost)
  const upgradeId = params.get('upgrade')
  const upgrading = trips.find((t) => t.id === upgradeId) ?? null
  // "แก้ไขทริป" → same wizard again, everything prefilled; travelers are managed
  // in the Info page so the people step is skipped
  const editId = params.get('edit')
  const editing = trips.find((t) => t.id === editId) ?? null

  const [phase, setPhase] = useState<Phase>('name')
  // draft = สร้างแบบไม่ระบุวัน/ผู้เดินทาง (ทำแพลนไว้ก่อน); Info stays locked
  const [draft, setDraft] = useState(false)
  const [seeded, setSeeded] = useState(false)
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [segs, setSegs] = useState<Seg[]>([blankSeg()])
  const [cityIdx, setCityIdx] = useState(0)
  const [multi, setMulti] = useState(false)
  const [people, setPeople] = useState<Person[]>([])
  const [newName, setNewName] = useState('')
  const [newFull, setNewFull] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<{ tripId: string; travelers: Traveler[] } | null>(null)
  const [sent, setSent] = useState<Set<string>>(new Set())

  // prefill once from the trip being upgraded (draft → real) or edited
  useMemo(() => {
    const src = upgrading ?? editing
    if (!src || seeded) return
    setSeeded(true)
    setName(src.name ?? '')
    const fromSegs = src.segments?.length
      ? src.segments.map((sg) => ({ country: (sg as { country?: string }).country ?? '', city: sg.city ?? '', flag: sg.flag ?? src.flag ?? '🌍', currency: sg.currency ?? src.currency ?? 'CNY', tz: sg.tz ?? src.timezone ?? '', until: sg.until ?? null }))
      : (src.cities?.length ? src.cities : ['']).map((city): Seg => ({ country: src.country ?? '', city, flag: src.flag ?? '🌍', currency: src.currency ?? 'CNY', tz: src.timezone ?? '', until: null }))
    setSegs(fromSegs)
    setMulti(fromSegs.length > 1)
    if (editing) {
      setStart(editing.start_date ?? '')
      setEnd(editing.end_date ?? '')
      // start at step 1 with everything filled — user walks through and fixes
    } else {
      setPhase('dates') // ชื่อมีแล้ว — เริ่มที่วันเดินทางเลย
    }
  }, [upgrading, editing, seeded])

  const myName = profile?.nickname?.trim() || 'ฉัน'
  const seg = segs[cityIdx]
  const days = start && end && end >= start
    ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1
    : null
  // every date of the trip — the "อยู่ถึงวันไหน" picker only offers these (ข้อ 4)
  const tripDates = useMemo(() => {
    if (!start || !end || end < start) return []
    const out: string[] = []
    const d = new Date(start + 'T00:00:00Z')
    while (d.toISOString().slice(0, 10) <= end) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1) }
    return out
  }, [start, end])
  const stepNo = phase === 'name' ? 1 : phase === 'dates' ? 2 : phase === 'city' ? Math.min(3 + cityIdx, 4) : phase === 'people' ? 5 : 6

  const patchSeg = (p: Partial<Seg>, idx = cityIdx) => setSegs((ss) => ss.map((s, i) => (i === idx ? { ...s, ...p } : s)))
  function pickDest(destName: string) {
    const d = DESTS.find((x) => x.name === destName)
    if (d) patchSeg({ country: d.name, flag: d.flag, currency: d.currency, tz: d.tz })
  }

  // dates this segment may hand over on: after the previous segment's handover
  const untilChoices = useMemo(() => {
    const prev = cityIdx > 0 ? segs[cityIdx - 1].until?.slice(0, 10) : null
    return tripDates.filter((d) => !prev || d >= prev)
  }, [tripDates, segs, cityIdx])
  const defaultUntil = () => `${untilChoices[1] ?? untilChoices[0] ?? start}T12:00`

  function back() {
    if (phase === 'name') { navigate('/'); return }
    if (phase === 'dates') setPhase('name')
    else if (phase === 'city') {
      if (cityIdx > 0) setCityIdx(cityIdx - 1)
      else setPhase('dates')
    } else if (phase === 'people') { setCityIdx(segs.length - 1); setPhase('city') }
    else if (phase === 'confirm') {
      if (draft || editing) { setCityIdx(segs.length - 1); setPhase('city') }
      else setPhase('people')
    }
  }

  function toggleMulti() {
    if (multi) { setMulti(false); setSegs((ss) => ss.slice(0, 1)); setCityIdx(0); patchSeg({ until: null }, 0) }
    else { setMulti(true); if (!seg.until) patchSeg({ until: defaultUntil() }) } // prefill (ข้อ 4)
  }
  function addAnotherCity() {
    if (!segName(seg) || !seg.tz) { toast.error('เลือกประเทศและใส่ชื่อเมืองก่อน'); return }
    if (!seg.until) patchSeg({ until: defaultUntil() }) // เมืองถัดไปต้องรู้วันย้าย — เติมให้แก้ได้
    setSegs((ss) => (cityIdx === ss.length - 1 ? [...ss, blankSeg()] : ss))
    setCityIdx(cityIdx + 1)
    setMulti(false)
  }
  function cityNext() {
    if (!segName(seg) || !seg.tz) { toast.error('เลือกประเทศและใส่ชื่อเมืองก่อน'); return }
    if (multi && cityIdx === 0) { addAnotherCity(); return }
    patchSeg({ until: null }) // last segment runs to the end of the trip
    // ร่าง/แก้ไขทริป: ข้ามผู้เดินทาง (จัดการในหน้า Info อยู่แล้ว) ไปยืนยันเลย
    if (draft || editing) { setPhase('confirm'); return }
    setPeople((ps) => (ps.length ? ps : [{ nick: myName, full: '' }]))
    setPhase('people')
  }

  function addPerson() {
    if (!newName.trim() || !newFull.trim()) return
    setPeople((ps) => [...ps, { nick: newName.trim(), full: newFull.trim() }])
    setNewName(''); setNewFull('')
  }
  const peopleComplete = people.length > 0 && people.every((p) => p.nick.trim() && p.full.trim())

  async function createAll() {
    if (!user || busy) return
    setBusy(true)
    try {
      const first = segs[0]
      const segPayload = segs.map((s) => ({ city: segName(s), country: s.country, flag: s.flag, currency: s.currency, tz: s.tz, until: s.until }))
      const base = {
        name: name.trim(), country: first.country || segName(first), flag: first.flag,
        cities: segs.map(segName), currency: first.currency, timezone: first.tz,
        segments: segPayload,
      }

      // ── ทริปแบบร่าง: ไม่มีวัน ไม่มีผู้เดินทาง — Info ล็อกไว้จนกด "พร้อมเดินทาง" ──
      if (draft) {
        const { id: tripId } = await createTrip(user.id, { ...base, start_date: null, end_date: null })
        switchTrip(tripId)
        await reload()
        toast.success('สร้างทริปแบบร่างแล้ว — เริ่มเก็บสถานที่/วางแพลนได้เลย')
        navigate('/places')
        return
      }

      // ── แก้ไขทริปเดิม: อัปเดตข้อมูล + เลื่อนวันที่ของแพลนรายวันตามลำดับ ──
      if (editing) {
        await updateTrip(editing.id, { ...base, start_date: start || null, end_date: end || null })
        // เลื่อนวันที่ให้วันที่มีอยู่ตามลำดับ (จุดแวะไม่หาย) — ไม่สร้างวันใหม่ให้เอง
        const { data: existDays } = await supabase.from('itinerary_days').select('id,position').eq('trip_id', editing.id).order('position')
        for (let i = 0; i < (existDays?.length ?? 0) && i < tripDates.length; i++) {
          await updateDay(existDays![i].id, { day_date: tripDates[i] })
        }
        switchTrip(editing.id)
        await reload()
        toast.success('บันทึกการแก้ไขทริปแล้ว')
        navigate('/')
        return
      }

      // ── อัปเกรดทริปแบบร่าง → ทริปจริง: อัปเดตทริปเดิม ของที่แพลนไว้อยู่ครบ ──
      if (upgrading) {
        await updateTrip(upgrading.id, { ...base, start_date: start || null, end_date: end || null })
        // ใส่วันที่ให้วันที่มีอยู่ตามลำดับ (จุดแวะไม่หาย) — ไม่สร้างวันใหม่ให้เอง
        const { data: existDays } = await supabase.from('itinerary_days').select('id,position').eq('trip_id', upgrading.id).order('position')
        for (let i = 0; i < (existDays?.length ?? 0) && i < tripDates.length; i++) {
          await updateDay(existDays![i].id, { day_date: tripDates[i] })
        }
        // ผู้เดินทาง: เพิ่มเฉพาะชื่อที่ยังไม่มี; ถ้าฉันยังไม่มีการ์ด ให้การ์ดใหม่ใบแรกเป็นของฉัน
        const { data: existTrav } = await supabase.from('travelers').select('*').eq('trip_id', upgrading.id).order('created_at')
        const have = new Set((existTrav ?? []).map((t) => (t.nickname ?? '').trim().toLowerCase()))
        const startIdx = existTrav?.length ?? 0
        let firstNewId: string | null = null
        for (let i = 0; i < people.length; i++) {
          const nick = people[i].nick.trim()
          if (!nick || have.has(nick.toLowerCase())) continue
          const id = await addTraveler(upgrading.id, { nickname: nick, full_name: people[i].full.trim() || null, avatar_color: ORDER[(startIdx + i) % ORDER.length] })
          if (!firstNewId) firstNewId = id
        }
        const mineAlready = (existTrav ?? []).some((t) => t.user_id === user.id)
        if (!mineAlready && firstNewId) await claimTraveler(firstNewId, user.id)
        const { data } = await supabase.from('travelers').select('*').eq('trip_id', upgrading.id).order('created_at')
        switchTrip(upgrading.id)
        setCreated({ tripId: upgrading.id, travelers: (data ?? []) as Traveler[] })
        setPhase('share')
        return
      }

      const { id: tripId } = await createTrip(user.id, {
        name: name.trim(), country: first.country || segName(first), flag: first.flag,
        cities: segs.map(segName), currency: first.currency, timezone: first.tz,
        segments: segs.map((s) => ({ city: segName(s), country: s.country, flag: s.flag, currency: s.currency, tz: s.tz, until: s.until })),
        start_date: start || null, end_date: end || null,
      })
      const ids: string[] = []
      for (let i = 0; i < people.length; i++) {
        ids.push(await addTraveler(tripId, { nickname: people[i].nick, full_name: people[i].full.trim() || null, avatar_color: ORDER[i % ORDER.length] }))
      }
      await claimTraveler(ids[0], user.id)
      const { data } = await supabase.from('travelers').select('*').eq('trip_id', tripId).order('created_at')
      switchTrip(tripId)
      setCreated({ tripId, travelers: (data ?? []) as Traveler[] })
      setPhase('share')
    } catch (e) {
      toast.error(editing ? 'บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง' : 'สร้างทริปไม่สำเร็จ — ลองใหม่อีกครั้ง')
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

  // segment date range for the confirm cards (ข้อ 6)
  const segRange = (i: number): string => {
    if (!start) return 'ยังไม่กำหนดวัน'
    const from = i === 0 ? start : segs[i - 1].until
    const to = segs[i].until
    const fromTxt = i === 0 ? thDate(start) : `${thDate(from?.slice(0, 10))} ${from?.slice(11, 16) ?? ''}`
    const toTxt = to ? `${thDate(to.slice(0, 10))} ${to.slice(11, 16)}` : `${thDate(end)} (วันกลับ)`
    return `${fromTxt} → ${toTxt}`
  }

  return (
    <div className="min-h-dvh bg-canvas flex flex-col max-w-[520px] mx-auto">
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
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div><div className={lbl}>วันไป</div>
                <ClearableField type="date" ariaLabel="ล้างวันไป" value={start}
                  onChange={(val) => { setStart(val); if (end && val && end < val) setEnd(val) }} onClear={() => setStart('')} />
              </div>
              <div><div className={lbl}>วันกลับ</div>
                <ClearableField type="date" ariaLabel="ล้างวันกลับ" value={end} min={start || undefined}
                  onChange={(val) => setEnd(val && start && val < start ? start : val)} onClear={() => setEnd('')} />
              </div>
            </div>
            {days != null && (
              <div className="text-[11px] mt-2 flex items-center gap-1" style={{ color: '#1D9E75' }}>
                <IconCheck size={12} /> รวม {days} วัน — ไปกด "เพิ่มวัน" วางแพลนเองได้ในหน้า Itinerary
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
              <div><div className={lbl}>ประเทศ</div>
                <select className={[field, !seg.country ? 'text-ink-3' : ''].join(' ')} value={seg.country} onChange={(e) => pickDest(e.target.value)}>
                  <option value="" disabled>— เลือกประเทศ —</option>
                  {DESTS.map((d) => <option key={d.name} value={d.name}>{d.flag} {d.name}</option>)}
                </select>
              </div>
              <div><div className={lbl}>เมืองที่จะไป</div>
                <input className={field} value={seg.city} onChange={(e) => patchSeg({ city: e.target.value })}
                  placeholder={seg.country === 'Japan' ? 'เช่น Tokyo, Osaka' : seg.country === 'China' ? 'เช่น Shanghai, Shenzhen' : 'พิมพ์ชื่อเมือง เช่น Hongkong'} />
              </div>
              <div className="grid grid-cols-2 gap-3">
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

              {/* วันย้ายเมือง — เลือกจากวันในทริปเท่านั้น + เติมค่าให้ล่วงหน้า (ข้อ 4) */}
              {(multi || cityIdx > 0) && (
                <div className="rounded-[12px] p-3" style={{ background: 'var(--color-brand-soft)', border: '0.5px solid var(--color-brand-border)' }}>
                  <div className="text-[12px] font-medium flex items-center gap-1.5" style={{ color: 'var(--color-brand-dark)' }}>
                    <IconMapPin size={13} /> อยู่ {segName(seg) || 'เมืองนี้'} ถึงวันไหน?
                  </div>
                  <div className="text-[11px] mt-0.5 mb-2" style={{ color: 'var(--color-brand-dark)', opacity: .75 }}>
                    เลือกได้เฉพาะวันในทริป ({thDate(start)} – {thDate(end)})
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select className={field} value={seg.until?.slice(0, 10) ?? ''}
                      onChange={(e) => patchSeg({ until: e.target.value ? `${e.target.value}T${seg.until?.slice(11, 16) || '12:00'}` : null })}>
                      {cityIdx > 0 && <option value="">จนถึงวันกลับ</option>}
                      {untilChoices.map((d) => <option key={d} value={d}>{thDay(d)}</option>)}
                    </select>
                    <select className={field} disabled={!seg.until} value={seg.until?.slice(11, 16) ?? '12:00'}
                      onChange={(e) => seg.until && patchSeg({ until: `${seg.until.slice(0, 10)}T${e.target.value}` })}>
                      {TIMES.map((t) => <option key={t} value={t}>{t} น.</option>)}
                    </select>
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
            {/* รายชื่อแบบลิสต์แนวตั้ง + ช่องชื่อจริง-นามสกุลต่อคน (ข้อ 5) */}
            <div className="space-y-2 mt-5">
              {people.map((p, i) => (
                <div key={i} className="card flex items-center gap-2.5 p-2.5">
                  <Avatar name={p.nick} color={ORDER[i % ORDER.length]} size={32} ring={false} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium flex items-center gap-1.5">
                      <span className="truncate">{p.nick}</span>
                      {i === 0 && <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5 shrink-0" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)' }}>คุณ</span>}
                    </div>
                    <input className="w-full min-w-0 bg-transparent outline-none text-[12px] text-ink-2 mt-0.5 placeholder:text-[#D85A30]/70"
                      value={p.full} placeholder="ชื่อจริง-นามสกุล *"
                      onChange={(e) => setPeople((ps) => ps.map((x, idx) => (idx === i ? { ...x, full: e.target.value } : x)))} />
                  </div>
                  {i > 0 && (
                    <button onClick={() => setPeople((ps) => ps.filter((_, idx) => idx !== i))}
                      className="shrink-0 text-ink-3 hover:text-[#D85A30]" aria-label={`ลบ ${p.nick}`}><IconX size={15} /></button>
                  )}
                </div>
              ))}
            </div>
            {/* ฟอร์มเพิ่มคน — ชื่อเล่น + ชื่อจริง-นามสกุล บังคับทั้งคู่ */}
            <div className="card p-2.5 space-y-2 mt-3">
              <div className="grid grid-cols-2 gap-2">
                <input className={field} value={newName} placeholder="ชื่อเล่น *" onChange={(e) => setNewName(e.target.value)} />
                <input className={field} value={newFull} placeholder="ชื่อจริง-นามสกุล *" onChange={(e) => setNewFull(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addPerson() }} />
              </div>
              <button onClick={addPerson} disabled={!newName.trim() || !newFull.trim()}
                className="w-full h-9 rounded-md text-[13px] font-medium inline-flex items-center justify-center gap-1 disabled:opacity-40"
                style={{ border: '0.5px solid var(--color-brand-border)', color: 'var(--color-brand-mid)', background: 'var(--color-brand-soft)' }}>
                <IconPlus size={14} /> เพิ่มผู้เดินทาง
              </button>
            </div>
          </>
        )}

        {phase === 'confirm' && (
          <>
            <h1 className="text-[18px] font-medium text-center mt-1">{editing ? 'ตรวจสอบก่อนบันทึก' : 'ตรวจสอบก่อนสร้างทริป'}</h1>
            <div className="text-[15px] font-medium text-center mt-1.5 flex items-center justify-center gap-1.5">
              <span>{segs[0].flag}</span> {name.trim() || 'ทริปใหม่'}
            </div>

            {/* ① วันเดินทาง — หัวข้อของตัวเอง */}
            <div className="text-[11px] text-ink-3 mt-5 mb-1.5 flex items-center gap-1"><IconCalendar size={12} /> วันเดินทาง</div>
            {draft ? (
              <div className="card p-3.5 text-center">
                <div className="text-[13px] font-medium">📝 ยังไม่กำหนดวัน — ทำแพลนไว้ก่อน</div>
                <div className="text-[11px] text-ink-3 mt-1">หน้า Personal จะล็อกไว้ จนกด "พร้อมเดินทางแล้ว" ในแอป</div>
              </div>
            ) : (
            <div className="card p-3.5">
              <div className="grid grid-cols-2">
                <div>
                  <div className="text-[10.5px] text-ink-3">วันไป</div>
                  <div className="text-[14px] font-medium mt-0.5">{thDate(start)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10.5px] text-ink-3">วันกลับ</div>
                  <div className="text-[14px] font-medium mt-0.5">{thDate(end)}</div>
                </div>
              </div>
              <div className="text-[11.5px] mt-2.5 pt-2.5 flex items-center gap-1" style={{ borderTop: '0.5px solid var(--color-line)', color: '#1D9E75' }}>
                <IconCheck size={12} /> ไป-กลับ รวม {days ?? '-'} วัน
              </div>
            </div>
            )}

            {/* ② ผู้เดินทาง — ตอนแก้ไขทริปจัดการในหน้า Info จึงไม่โชว์ */}
            {!draft && !editing && (<>
            <div className="text-[11px] text-ink-3 mt-4 mb-1.5 flex items-center gap-1"><IconUsers size={12} /> ผู้เดินทาง · {people.length} คน</div>
            <div className="card p-2 space-y-0.5">
              {people.map((p, i) => (
                <div key={i} className="flex items-center gap-2.5 px-1.5 py-1.5">
                  <Avatar name={p.nick} color={ORDER[i % ORDER.length]} size={28} ring={false} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium flex items-center gap-1.5">
                      <span className="truncate">{p.nick}</span>
                      {i === 0 && <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5 shrink-0" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)' }}>คุณ</span>}
                    </div>
                    {p.full.trim() && <div className="text-[11px] text-ink-3 truncate">{p.full.trim()}</div>}
                  </div>
                </div>
              ))}
            </div>

            </>)}

            {/* ③ การ์ดรายเมือง — แถบฟ้าขอบมนซ้อน + รายละเอียดวันที่ */}
            <div className="text-[11px] text-ink-3 mt-4 mb-1.5 flex items-center gap-1"><IconBuildingSkyscraper size={12} /> เมืองที่ไป · {segs.length} เมือง</div>
            <div className="space-y-3">
              {segs.map((s, i) => (
                <div key={i} className="relative flex flex-col">
                  <div className="relative -mb-3 pt-1 pb-4 px-3.5 rounded-t-[14px] flex items-center gap-1.5 text-white" style={{ background: 'var(--color-brand)' }}>
                    <span className="text-[13px]">{s.flag}</span>
                    <span className="text-[13px] font-medium truncate">{segName(s)}</span>
                    {segs.length > 1 && <span className="text-[11px] text-white/80 ml-auto shrink-0">เมืองที่ {i + 1}</span>}
                  </div>
                  <div className="card relative p-3.5">
                    <div className="flex items-center gap-2.5">
                      <IconCalendar size={15} className="text-brand shrink-0" />
                      <div className="text-[12.5px] text-ink">{segRange(i)}</div>
                    </div>
                    <div className="text-[11px] text-ink-3 mt-2 pt-2" style={{ borderTop: '0.5px solid var(--color-line)' }}>
                      ค่าเงิน {s.currency} · โซนเวลา {tzLabel(s.tz)}
                    </div>
                  </div>
                </div>
              ))}
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
                    <div className="text-[10.5px] text-ink-3 truncate">{t.user_id === user?.id ? 'เจ้าของทริป' : t.full_name || ''}</div>
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

      {/* footer */}
      <div className="px-4 pb-6 pt-2 space-y-2">
        {phase === 'name' && <button onClick={() => name.trim() && setPhase('dates')} disabled={!name.trim()} className="btn-primary w-full h-10 disabled:opacity-50">ถัดไป</button>}
        {phase === 'dates' && (
          <>
            <button onClick={() => { setDraft(false); if (start && end) setPhase('city') }} disabled={!start || !end} className="btn-primary w-full h-10 disabled:opacity-50">ถัดไป</button>
            {!upgrading && !editing && (
              <button onClick={() => { setDraft(true); setStart(''); setEnd(''); setMulti(false); setPhase('city') }}
                className="w-full h-10 rounded-md text-[13px] font-medium inline-flex items-center justify-center gap-1.5"
                style={{ border: '0.5px solid var(--color-brand-border)', color: 'var(--color-brand-mid)', background: 'var(--color-brand-soft)' }}>
                📝 ยังไม่กำหนดวัน — ทำแพลนไว้ก่อน
              </button>
            )}
          </>
        )}
        {phase === 'city' && (
          <>
            {cityIdx > 0 && (
              <button onClick={addAnotherCity} className="w-full h-10 rounded-md text-[13px] font-medium inline-flex items-center justify-center gap-1.5"
                style={{ border: '0.5px solid var(--color-brand-border)', color: 'var(--color-brand-mid)', background: 'var(--color-surface)' }}>
                <IconPlus size={14} /> มีอีกเมือง
              </button>
            )}
            {/* ปุ่มเที่ยวหลายเมือง — เด่นชัดเป็นปุ่มเต็มแถบ (ข้อ 3) */}
            {cityIdx === 0 && !draft && (
              <button onClick={toggleMulti}
                className="w-full h-10 rounded-md text-[13px] font-medium inline-flex items-center justify-center gap-1.5"
                style={multi
                  ? { border: '0.5px solid var(--color-line)', color: 'var(--color-ink-2)', background: 'var(--color-surface)' }
                  : { border: '0.5px solid var(--color-brand-border)', color: 'var(--color-brand-mid)', background: 'var(--color-brand-soft)' }}>
                {multi ? <><IconX size={14} /> ยกเลิกเที่ยวหลายเมือง</> : <><IconBuildingSkyscraper size={15} /> เที่ยวหลายเมือง?</>}
              </button>
            )}
            <button onClick={cityNext} className="btn-primary w-full h-10">
              {multi && cityIdx === 0 ? 'ถัดไป · กรอกเมืองที่ 2' : 'ถัดไป'}
            </button>
          </>
        )}
        {phase === 'people' && (
          <>
            {!peopleComplete && <div className="text-center text-[11px]" style={{ color: '#D85A30' }}>กรอกชื่อจริง-นามสกุลให้ครบทุกคนก่อนกดเสร็จสิ้น</div>}
            <button onClick={() => setPhase('confirm')} disabled={!peopleComplete} className="btn-primary w-full h-10 disabled:opacity-50">เสร็จสิ้น</button>
          </>
        )}
        {phase === 'confirm' && (
          <>
            <button onClick={createAll} disabled={busy} className="btn-primary w-full h-10 disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
              <IconCheck size={15} /> {busy ? 'กำลังบันทึก…' : draft ? 'สร้างทริปแบบร่าง' : editing ? 'บันทึกการแก้ไข' : upgrading ? 'บันทึก — พร้อมเดินทาง!' : 'ยืนยันสร้างทริป'}
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
