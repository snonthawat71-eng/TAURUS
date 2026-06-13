import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlus, IconArrowLeft, IconMapPin, IconChevronDown, IconCheck, IconWorldSearch } from '@tabler/icons-react'
import { useAuth } from '@/contexts/AuthContext'
import { TaurusLogo } from '@/components/TaurusLogo'
import { Drawer } from '@/components/Drawer'
import { SignedImage } from '@/components/SignedImage'
import { ExploreCard } from '@/components/ExploreCard'
import { ExploreEditor } from '@/components/ExploreEditor'
import { SaveToTripDialog } from '@/components/SaveToTripDialog'
import { listExplore, addExplore, deleteExplore, exploreAsPlace } from '@/lib/exploreMutations'
import type { ExplorePlace, Place } from '@/lib/database.types'

export default function Explore() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<ExplorePlace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [group, setGroup] = useState<'all' | 'place' | 'food'>('all')
  const [city, setCity] = useState('all')
  const [cityMenu, setCityMenu] = useState(false)
  const [editor, setEditor] = useState(false)
  const [fav, setFav] = useState<Place | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await listExplore()
    setError(!!error)
    setItems((data ?? []) as ExplorePlace[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const cities = useMemo(() => {
    const m = new Map<string, ExplorePlace>()
    for (const e of items) if (e.city && !m.has(e.city)) m.set(e.city, e)
    return Array.from(m.entries()).map(([name, sample]) => ({ name, photo: sample.photo_url }))
  }, [items])

  const filtered = items
    .filter((e) => group === 'all' || e.group_type === group)
    .filter((e) => city === 'all' || e.city === city)

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-20 bg-canvas/95 backdrop-blur flex items-center justify-between px-4 sm:px-6 h-14" style={{ borderBottom: '0.5px solid var(--color-line)' }}>
        <button onClick={() => navigate('/')} className="btn-icon !border-0" aria-label="กลับ"><IconArrowLeft size={18} /></button>
        <TaurusLogo height={26} />
        <button onClick={() => setEditor(true)} className="btn-icon !w-auto px-3 gap-1.5 text-[12px] font-medium"><IconPlus size={15} /><span className="max-sm:hidden">เพิ่มสถานที่</span></button>
      </header>

      <main className="max-w-[640px] mx-auto px-4 sm:px-6 py-5">
        <div className="flex items-center gap-1.5 mb-1">
          <IconWorldSearch size={20} className="text-brand" />
          <h1 className="text-[20px] font-medium">Explore</h1>
        </div>
        <p className="text-[13px] text-ink-3 mb-4">รวมสถานที่/ร้านที่ทุกคนแชร์ — กด ♥ เพื่อเซฟเข้าทริปของคุณ</p>

        {/* filter bar */}
        <div className="flex items-center gap-1.5 mb-4">
          <button onClick={() => setCityMenu(true)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium hairline bg-surface whitespace-nowrap shrink-0">
            <IconMapPin size={14} /> {city === 'all' ? 'ทุกเมือง' : city} <IconChevronDown size={13} className="text-ink-3" />
          </button>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar min-w-0">
            {([['all', 'ทั้งหมด'], ['place', 'สถานที่'], ['food', 'ร้าน/คาเฟ่']] as const).map(([g, label]) => (
              <button key={g} onClick={() => setGroup(g)}
                className={['px-3 h-8 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0', group === g ? 'bg-ink text-white' : 'bg-surface-2 text-ink-2'].join(' ')}>{label}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[13px] text-ink-3">กำลังโหลด…</div>
        ) : error ? (
          <div className="card p-6 text-center text-[12px] text-ink-2">ยังไม่ได้ตั้งค่า Explore — รัน <code className="text-booking">supabase/explore.sql</code> ใน Supabase ก่อน</div>
        ) : filtered.length === 0 ? (
          <div className="card p-8 text-center text-[13px] text-ink-3">ยังไม่มีรายการ — กด “เพิ่มสถานที่” เพื่อแชร์ที่แรก</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((e) => (
              <ExploreCard key={e.id} e={e} isOwner={e.created_by === user?.id}
                onFav={() => setFav(exploreAsPlace(e))}
                onDelete={async () => { if (confirm('ลบรายการนี้ออกจาก Explore?')) { await deleteExplore(e.id); load() } }} />
            ))}
          </div>
        )}
      </main>

      <ExploreEditor open={editor} onClose={() => setEditor(false)}
        onSave={async (input) => { if (user) { await addExplore(user.id, input); load() } }} />

      <SaveToTripDialog place={fav} open={!!fav} onClose={() => setFav(null)} />

      {/* City filter sheet */}
      <Drawer open={cityMenu} onClose={() => setCityMenu(false)} title="เลือกเมือง">
        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={() => { setCity('all'); setCityMenu(false) }}
            className="card overflow-hidden text-left">
            <div className="h-24 grid place-items-center bg-surface-2"><IconWorldSearch size={28} className="text-ink-3" /></div>
            <div className="p-2.5 text-[13px] font-medium flex items-center justify-between">ทุกเมือง {city === 'all' && <IconCheck size={15} className="text-brand" />}</div>
          </button>
          {cities.map((c) => (
            <button key={c.name} onClick={() => { setCity(c.name); setCityMenu(false) }} className="card overflow-hidden text-left">
              <div className="h-24">
                <SignedImage url={c.photo} alt={c.name} className="w-full h-full object-cover"
                  fallback={<div className="w-full h-full grid place-items-center bg-surface-2"><IconMapPin size={24} className="text-ink-3" /></div>} />
              </div>
              <div className="p-2.5 text-[13px] font-medium flex items-center justify-between">{c.name} {city === c.name && <IconCheck size={15} className="text-brand" />}</div>
            </button>
          ))}
        </div>
      </Drawer>
    </div>
  )
}
