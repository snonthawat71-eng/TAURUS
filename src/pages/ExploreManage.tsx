import { useEffect, useMemo, useState } from 'react'
import { IconArrowLeft, IconPlus, IconEye, IconHeart, IconThumbUp, IconMessageCircle, IconMapPin } from '@tabler/icons-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { useBack } from '@/lib/useBack'
import { TaurusLogo } from '@/components/TaurusLogo'
import { ExploreCard } from '@/components/ExploreCard'
import { ExploreDetail } from '@/components/ExploreDetail'
import { ExploreEditor } from '@/components/ExploreEditor'
import { ExploreFilters } from '@/components/ExploreFilters'
import { SaveToTripDialog } from '@/components/SaveToTripDialog'
import {
  listMyExplore, addExplore, updateExplore, deleteExplore, exploreAsPlace,
  allVoteStats, allPopularity, logExploreEvent, type VoteStat, type PopStat,
} from '@/lib/exploreMutations'
import { savedExploreIds, removeExploreCopies } from '@/lib/placeMutations'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { filterExplore, initialExploreFilter, type ExploreFilterState } from '@/lib/exploreFilter'
import type { ExplorePlace, Place } from '@/lib/database.types'

/** Management view: only the places the current user has shared, with their
 *  engagement stats and quick edit / delete. Lives at /explore/mine. */
export default function ExploreManage() {
  const { user } = useAuth()
  const { trips } = useTrip()
  const goBack = useBack('/explore')
  const [items, setItems] = useState<ExplorePlace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [editor, setEditor] = useState<ExplorePlace | 'new' | null>(null)
  const [detail, setDetail] = useState<ExplorePlace | null>(null)
  const [fav, setFav] = useState<Place | null>(null)
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState<Map<string, VoteStat>>(new Map())
  const [pop, setPop] = useState<Map<string, PopStat>>(new Map())
  const [filter, setFilter] = useState<ExploreFilterState>(initialExploreFilter)
  const setF = (patch: Partial<ExploreFilterState>) => setFilter((s) => ({ ...s, ...patch }))

  const myTripIds = useMemo(() => trips.filter((t) => t.owner_id === user?.id).map((t) => t.id), [trips, user?.id])

  async function refreshStats() {
    setStats(await allVoteStats())
    setPop(await allPopularity())
  }
  async function refreshSaved() {
    setSavedSet(await savedExploreIds(myTripIds))
  }
  async function reloadItems() {
    if (!user) return
    const { data, error } = await listMyExplore(user.id)
    setError(!!error)
    setItems((data ?? []) as ExplorePlace[])
  }

  async function load() {
    setLoading(true)
    await reloadItems()
    setLoading(false)
  }

  useEffect(() => { load(); refreshStats() }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { refreshSaved() }, [myTripIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  // live engagement updates on my items
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let t: ReturnType<typeof setTimeout> | undefined
    const bump = () => { clearTimeout(t); t = setTimeout(() => refreshStats(), 400) }
    const ch = supabase.channel('explore-manage')
    for (const table of ['explore_events', 'explore_votes', 'explore_comments']) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, bump)
    }
    ch.subscribe()
    return () => { clearTimeout(t); supabase.removeChannel(ch) }
  }, [])

  function openDetail(e: ExplorePlace) {
    setDetail(e)
    if (user) logExploreEvent(e.id, user.id, 'view')
  }
  function toggleFav(e: ExplorePlace) {
    if (savedSet.has(e.id)) removeExploreCopies(e.id, myTripIds).then(refreshSaved)
    else setFav(exploreAsPlace(e))
  }

  // headline totals across all of my shared places
  const totals = useMemo(() => {
    let views = 0, saves = 0, likes = 0, comments = 0
    for (const e of items) {
      const p = pop.get(e.id)
      if (p) { views += p.views; saves += p.saves; likes += p.likes; comments += p.comments }
    }
    return { views, saves, likes, comments }
  }, [items, pop])

  const shown = useMemo(() => filterExplore(items, filter, pop), [items, filter, pop])

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 bg-canvas/95 backdrop-blur flex items-center justify-between px-4 sm:px-6 h-14" style={{ borderBottom: '0.5px solid var(--color-line)' }}>
        <button onClick={goBack} className="btn-icon !border-0" aria-label="กลับ"><IconArrowLeft size={18} /></button>
        <TaurusLogo height={42} />
        <button onClick={() => setEditor('new')} className="btn-icon !w-auto px-3 gap-1.5 text-[12px] font-medium"><IconPlus size={15} /><span className="max-sm:hidden">เพิ่มสถานที่</span></button>
      </header>

      <main className="max-w-[640px] mx-auto px-4 sm:px-6 py-5">
        <div className="flex items-center gap-1.5 mb-1">
          <IconMapPin size={20} className="text-brand" />
          <h1 className="text-[20px] font-medium">สถานที่ที่ฉันแชร์</h1>
        </div>
        <p className="text-[13px] text-ink-3 mb-4">จัดการเฉพาะสถานที่/ร้านที่คุณแชร์ไว้ใน Explore — ดูยอดและแก้ไข/ลบได้</p>

        {/* engagement summary */}
        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-5">
            {([['ยอดคลิก', totals.views, IconEye], ['ยอดเซฟ', totals.saves, IconHeart], ['ยอดไลก์', totals.likes, IconThumbUp], ['คอมเมนต์', totals.comments, IconMessageCircle]] as const).map(([label, n, Icon]) => (
              <div key={label} className="card p-2.5 text-center">
                <Icon size={16} className="mx-auto text-brand" />
                <div className="text-[16px] font-semibold tabular-nums mt-1">{n}</div>
                <div className="text-[10.5px] text-ink-3">{label}</div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <ExploreFilters items={items} f={filter} set={setF} showSort={false} userId={user?.id} />
        )}

        {loading ? (
          <div className="py-16 text-center text-[13px] text-ink-3">กำลังโหลด…</div>
        ) : error ? (
          <div className="card p-6 text-center text-[12px] text-ink-2">ยังไม่ได้ตั้งค่า Explore — รัน <code className="text-booking">supabase/explore.sql</code> ใน Supabase ก่อน</div>
        ) : items.length === 0 ? (
          <div className="card p-8 text-center text-[13px] text-ink-3">คุณยังไม่ได้แชร์สถานที่ — กด “เพิ่มสถานที่” เพื่อแชร์ที่แรก</div>
        ) : shown.length === 0 ? (
          <div className="card p-8 text-center text-[13px] text-ink-3">ไม่พบสถานที่ที่ตรงกับตัวกรอง</div>
        ) : (
          <div className="space-y-3">
            {shown.map((e) => (
              <ExploreCard key={e.id} e={e} isOwner saved={savedSet.has(e.id)} stat={stats.get(e.id)} pop={pop.get(e.id)}
                onOpen={() => openDetail(e)}
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
