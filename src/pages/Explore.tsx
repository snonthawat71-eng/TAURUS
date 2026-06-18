import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlus, IconArrowLeft, IconWorldSearch, IconRefresh, IconMapPin } from '@tabler/icons-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { TaurusLogo } from '@/components/TaurusLogo'
import { ExploreCard } from '@/components/ExploreCard'
import { ExploreDetail } from '@/components/ExploreDetail'
import { ExploreEditor } from '@/components/ExploreEditor'
import { ExploreNotifications } from '@/components/ExploreNotifications'
import { ExploreFilters } from '@/components/ExploreFilters'
import { SaveToTripDialog } from '@/components/SaveToTripDialog'
import { listExplore, addExplore, updateExplore, deleteExplore, exploreAsPlace, allVoteStats, allPopularity, popularSet, logExploreEvent, type VoteStat, type PopStat } from '@/lib/exploreMutations'
import { savedExploreIds, removeExploreCopies } from '@/lib/placeMutations'
import { useBack } from '@/lib/useBack'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { filterExplore, initialExploreFilter, type ExploreFilterState } from '@/lib/exploreFilter'
import type { ExplorePlace, Place } from '@/lib/database.types'

export default function Explore() {
  const { user } = useAuth()
  const { trips } = useTrip()
  const navigate = useNavigate()
  const goBack = useBack('/')
  const [items, setItems] = useState<ExplorePlace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<ExploreFilterState>(initialExploreFilter)
  const setF = (patch: Partial<ExploreFilterState>) => setFilter((s) => ({ ...s, ...patch }))
  const [editor, setEditor] = useState<ExplorePlace | 'new' | null>(null)
  const [fav, setFav] = useState<Place | null>(null)
  const [detail, setDetail] = useState<ExplorePlace | null>(null)
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState<Map<string, VoteStat>>(new Map())
  const [pop, setPop] = useState<Map<string, PopStat>>(new Map())
  const [live, setLive] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const popular = useMemo(() => popularSet(pop), [pop])

  async function refreshStats() {
    setStats(await allVoteStats())
    setPop(await allPopularity())
  }

  // quiet reload of the items list (no full-page spinner)
  async function reloadItems() {
    const { data, error } = await listExplore()
    setError(!!error)
    setItems((data ?? []) as ExplorePlace[])
  }

  // manual refresh — for when realtime isn't actually delivering updates
  async function refreshAll() {
    setRefreshing(true)
    await Promise.all([reloadItems(), refreshStats(), refreshSaved()])
    setRefreshing(false)
  }

  // open detail + count the click toward popularity
  function openDetail(e: ExplorePlace) {
    setDetail(e)
    if (user) logExploreEvent(e.id, user.id, 'view')
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

  // live updates — refresh stats on votes/clicks/comments, reload the list when
  // items are added/edited, and track whether the realtime connection is alive
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let st: ReturnType<typeof setTimeout> | undefined
    let it: ReturnType<typeof setTimeout> | undefined
    const bumpStats = () => { clearTimeout(st); st = setTimeout(() => { refreshStats() }, 400) }
    const bumpItems = () => { clearTimeout(it); it = setTimeout(() => { reloadItems() }, 400) }
    const ch = supabase.channel('explore-live')
    for (const table of ['explore_events', 'explore_votes', 'explore_comments']) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, bumpStats)
    }
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'explore_places' }, bumpItems)
    ch.subscribe((status) => setLive(status === 'SUBSCRIBED'))
    return () => { clearTimeout(st); clearTimeout(it); setLive(false); supabase.removeChannel(ch) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => filterExplore(items, filter, pop), [items, filter, pop])

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 bg-canvas/95 backdrop-blur flex items-center justify-between px-4 sm:px-6 h-14" style={{ borderBottom: '0.5px solid var(--color-line)' }}>
        <button onClick={goBack} className="btn-icon !border-0" aria-label="กลับ"><IconArrowLeft size={18} /></button>
        <TaurusLogo height={42} />
        <div className="flex items-center gap-1">
          {user && <ExploreNotifications userId={user.id} onOpenItem={(id) => { const it = items.find((e) => e.id === id); if (it) setDetail(it) }} />}
          <button onClick={() => navigate('/explore/mine')} className="btn-icon !border-0" aria-label="จัดการสถานที่ของฉัน" title="สถานที่ที่ฉันแชร์"><IconMapPin size={18} /></button>
          <button onClick={() => setEditor('new')} className="btn-icon !w-auto px-3 gap-1.5 text-[12px] font-medium"><IconPlus size={15} /><span className="max-sm:hidden">เพิ่มสถานที่</span></button>
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-4 sm:px-6 py-5">
        <div className="flex items-center gap-1.5 mb-1">
          <IconWorldSearch size={20} className="text-brand" />
          <h1 className="text-[20px] font-medium">Explore</h1>
        </div>
        <p className="text-[13px] text-ink-3 mb-2">รวมสถานที่/ร้านที่ทุกคนแชร์ — กด ♥ เพื่อเซฟเข้าทริปของคุณ</p>

        {/* realtime status + manual refresh (in case realtime isn't delivering) */}
        <div className="flex items-center gap-1.5 text-[11px] text-ink-3 mb-4">
          <span className="size-2 rounded-full shrink-0" style={{ background: live ? '#1E8E5A' : '#C99A3A' }} />
          <span>{live ? 'อัปเดตแบบเรียลไทม์' : 'ไม่ได้เชื่อมต่อเรียลไทม์'}</span>
          <button onClick={refreshAll} disabled={refreshing}
            className="ml-auto inline-flex items-center gap-1 text-brand-mid font-medium disabled:opacity-50">
            <IconRefresh size={12} className={refreshing ? 'animate-spin' : ''} /> รีเฟรช
          </button>
        </div>

        <ExploreFilters items={items} f={filter} set={setF} />

        {loading ? (
          <div className="py-16 text-center text-[13px] text-ink-3">กำลังโหลด…</div>
        ) : error ? (
          <div className="card p-6 text-center text-[12px] text-ink-2">ยังไม่ได้ตั้งค่า Explore — รัน <code className="text-booking">supabase/explore.sql</code> ใน Supabase ก่อน</div>
        ) : shown.length === 0 ? (
          <div className="card p-8 text-center text-[13px] text-ink-3">ยังไม่มีรายการ — กด “เพิ่มสถานที่” เพื่อแชร์ที่แรก</div>
        ) : (
          <div className="space-y-3">
            {shown.map((e) => (
              <ExploreCard key={e.id} e={e} isOwner={e.created_by === user?.id} saved={savedSet.has(e.id)} stat={stats.get(e.id)} popular={popular.has(e.id)} pop={pop.get(e.id)}
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
