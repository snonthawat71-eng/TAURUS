import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlus, IconArrowLeft, IconMapPin, IconWorldSearch } from '@tabler/icons-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { TaurusLogo } from '@/components/TaurusLogo'
import { SignedImage } from '@/components/SignedImage'
import { ExploreCard } from '@/components/ExploreCard'
import { ExploreDetail } from '@/components/ExploreDetail'
import { ExploreEditor } from '@/components/ExploreEditor'
import { ExploreNotifications } from '@/components/ExploreNotifications'
import { SaveToTripDialog } from '@/components/SaveToTripDialog'
import { listExplore, addExplore, updateExplore, deleteExplore, exploreAsPlace, allVoteStats, type VoteStat } from '@/lib/exploreMutations'
import { savedExploreIds, removeExploreCopies } from '@/lib/placeMutations'
import { cityImage } from '@/lib/cityImages'
import { hscroll } from '@/lib/hscroll'
import { PLACE_TABS, FOOD_TABS, foodGroupKey } from '@/lib/placeMeta'
import type { ExplorePlace, Place } from '@/lib/database.types'

export default function Explore() {
  const { user } = useAuth()
  const { trips } = useTrip()
  const navigate = useNavigate()
  const [items, setItems] = useState<ExplorePlace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [group, setGroup] = useState<'all' | 'place' | 'food'>('all')
  const [cat, setCat] = useState('all')
  const [city, setCity] = useState('all')
  const [editor, setEditor] = useState<ExplorePlace | 'new' | null>(null)
  const [fav, setFav] = useState<Place | null>(null)
  const [detail, setDetail] = useState<ExplorePlace | null>(null)
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState<Map<string, VoteStat>>(new Map())

  async function refreshStats() {
    setStats(await allVoteStats())
  }

  function toggleFav(e: ExplorePlace) {
    if (savedSet.has(e.id)) { removeExploreCopies(e.id, myTripIds).then(refreshSaved) }
    else setFav(exploreAsPlace(e))
  }

  const myTripIds = useMemo(() => trips.filter((t) => t.owner_id === user?.id).map((t) => t.id), [trips, user?.id])

  async function refreshSaved() {
    setSavedSet(await savedExploreIds(myTripIds))
  }

  async function load() {
    setLoading(true)
    const { data, error } = await listExplore()
    setError(!!error)
    setItems((data ?? []) as ExplorePlace[])
    setLoading(false)
  }
  useEffect(() => { load(); refreshStats() }, [])
  useEffect(() => { refreshSaved() }, [myTripIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const cities = useMemo(() => {
    const m = new Map<string, ExplorePlace>()
    for (const e of items) if (e.city && !m.has(e.city)) m.set(e.city, e)
    return Array.from(m.entries()).map(([name, sample]) => ({ name, photo: cityImage(name) ?? sample.photo_url }))
  }, [items])

  const catTabs = group === 'place' ? PLACE_TABS : group === 'food' ? FOOD_TABS : []

  const filtered = items
    .filter((e) => group === 'all' || e.group_type === group)
    .filter((e) => cat === 'all' || (group === 'food' ? foodGroupKey(e.category) === cat : e.category === cat))
    .filter((e) => city === 'all' || e.city === city)

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 bg-canvas/95 backdrop-blur flex items-center justify-between px-4 sm:px-6 h-14" style={{ borderBottom: '0.5px solid var(--color-line)' }}>
        <button onClick={() => navigate(-1)} className="btn-icon !border-0" aria-label="กลับ"><IconArrowLeft size={18} /></button>
        <TaurusLogo height={42} />
        <div className="flex items-center gap-1">
          {user && <ExploreNotifications userId={user.id} onOpenItem={(id) => { const it = items.find((e) => e.id === id); if (it) setDetail(it) }} />}
          <button onClick={() => setEditor('new')} className="btn-icon !w-auto px-3 gap-1.5 text-[12px] font-medium"><IconPlus size={15} /><span className="max-sm:hidden">เพิ่มสถานที่</span></button>
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-4 sm:px-6 py-5">
        <div className="flex items-center gap-1.5 mb-1">
          <IconWorldSearch size={20} className="text-brand" />
          <h1 className="text-[20px] font-medium">Explore</h1>
        </div>
        <p className="text-[13px] text-ink-3 mb-4">รวมสถานที่/ร้านที่ทุกคนแชร์ — กด ♥ เพื่อเซฟเข้าทริปของคุณ</p>

        {/* type filter (places / food & cafe) */}
        <div ref={hscroll} className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar">
          {([['all', 'ทั้งหมด'], ['place', 'Places'], ['food', 'Food and Cafe']] as const).map(([g, label]) => (
            <button key={g} onClick={() => { setGroup(g); setCat('all') }}
              className={['px-3.5 h-8 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0', group === g ? 'bg-ink text-white' : 'bg-surface-2 text-ink-2'].join(' ')}>{label}</button>
          ))}
        </div>

        {/* category filter (by type, like Places / Food pages) */}
        {catTabs.length > 0 && (
          <div ref={hscroll} className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar">
            {catTabs.map((t) => (
              <button key={t.key} onClick={() => setCat(t.key)}
                className={['px-3 h-7 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0', cat === t.key ? 'bg-brand text-white' : 'bg-surface-2 text-ink-2'].join(' ')}>{t.label}</button>
            ))}
          </div>
        )}

        {/* city tabs (cards, inline) */}
        {cities.length > 0 && (
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar mb-4 pb-1">
            <button onClick={() => setCity('all')}
              className="shrink-0 w-24 rounded-[12px] overflow-hidden text-left bg-surface"
              style={{ border: `1.5px solid ${city === 'all' ? 'var(--color-brand)' : 'var(--color-line)'}` }}>
              <div className="h-20 grid place-items-center bg-surface-2"><IconWorldSearch size={24} className="text-ink-3" /></div>
              <div className="px-2 py-1.5 text-[12px] font-medium truncate text-center">ทุกเมือง</div>
            </button>
            {cities.map((c) => (
              <button key={c.name} onClick={() => setCity(c.name)}
                className="shrink-0 w-24 rounded-[12px] overflow-hidden text-left bg-surface"
                style={{ border: `1.5px solid ${city === c.name ? 'var(--color-brand)' : 'var(--color-line)'}` }}>
                <div className="h-20">
                  <SignedImage url={c.photo} alt={c.name} className="w-full h-full object-cover"
                    fallback={<div className="w-full h-full grid place-items-center bg-surface-2"><IconMapPin size={20} className="text-ink-3" /></div>} />
                </div>
                <div className="px-2 py-1.5 text-[12px] font-medium truncate text-center">{c.name}</div>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-[13px] text-ink-3">กำลังโหลด…</div>
        ) : error ? (
          <div className="card p-6 text-center text-[12px] text-ink-2">ยังไม่ได้ตั้งค่า Explore — รัน <code className="text-booking">supabase/explore.sql</code> ใน Supabase ก่อน</div>
        ) : filtered.length === 0 ? (
          <div className="card p-8 text-center text-[13px] text-ink-3">ยังไม่มีรายการ — กด “เพิ่มสถานที่” เพื่อแชร์ที่แรก</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((e) => (
              <ExploreCard key={e.id} e={e} isOwner={e.created_by === user?.id} saved={savedSet.has(e.id)} stat={stats.get(e.id)}
                onOpen={() => setDetail(e)}
                onFav={() => toggleFav(e)}
                onEdit={() => setEditor(e)}
                onDelete={async () => { if (confirm('ลบรายการนี้ออกจาก Explore?')) { await deleteExplore(e.id); load() } }} />
            ))}
          </div>
        )}
      </main>

      <ExploreEditor open={!!editor} initial={editor && editor !== 'new' ? editor : null} existing={items} onClose={() => setEditor(null)}
        onSave={async (input) => {
          if (editor && editor !== 'new') await updateExplore(editor.id, input)
          else if (user) await addExplore(user.id, input)
          load()
        }} />

      <ExploreDetail e={detail} open={!!detail} saved={detail ? savedSet.has(detail.id) : false}
        onClose={() => { setDetail(null); refreshStats() }} onFav={() => detail && toggleFav(detail)} />

      <SaveToTripDialog place={fav} open={!!fav} sourceExploreId={fav?.id}
        onClose={() => setFav(null)} onChanged={refreshSaved} />
    </div>
  )
}
