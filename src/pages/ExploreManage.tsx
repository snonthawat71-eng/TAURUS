import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconPlus, IconEye, IconHeart, IconStarFilled, IconMessageCircle, IconMapPin, IconMapPins, IconLoader2 } from '@tabler/icons-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { useBack } from '@/lib/useBack'
import { confirmDialog } from '@/lib/confirm'
import { TaurusLogo } from '@/components/TaurusLogo'
import { ExploreCard } from '@/components/ExploreCard'
import { ExploreEditor } from '@/components/ExploreEditor'
import { ExploreFilters } from '@/components/ExploreFilters'
import { SaveToTripDialog } from '@/components/SaveToTripDialog'
import {
  listMyExplore, addExplore, updateExplore, deleteExplore, exploreAsPlace, syncExploreCoord,
  allPopularity, type PopStat,
} from '@/lib/exploreMutations'
import { allRatingStats } from '@/lib/exploreReviews'
import { savedExploreIds, removeExploreCopiesDeep } from '@/lib/placeMutations'
import { toast } from '@/lib/toast'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { filterExplore, initialExploreFilter, type ExploreFilterState } from '@/lib/exploreFilter'
import type { ExplorePlace, Place } from '@/lib/database.types'

// Same round-trip cache as pages/Explore.tsx: opening a place detail unmounts
// this page, so keep the list + stats + scroll so "back" lands exactly where
// the user left off with the exact same card order (no re-sort jump).
let cachedItems: ExplorePlace[] | null = null
let cachedFilter: ExploreFilterState | null = null
let cachedScroll = 0
let cachedPop: Map<string, PopStat> | null = null
let cachedRatings: Map<string, { avg: number; count: number }> | null = null
let cachedUserId: string | null = null

/** Management view: only the places the current user has shared, with their
 *  engagement stats and quick edit / delete. Lives at /explore/mine. */
export default function ExploreManage() {
  const { user } = useAuth()
  const { trips, trip: currentTrip, reload: reloadTrip } = useTrip()
  const goBack = useBack('/explore')
  const navigate = useNavigate()
  // a different user's cache must never leak in (cache is per SPA session)
  const hasCache = !!cachedItems && cachedUserId === (user?.id ?? null)
  const [items, setItems] = useState<ExplorePlace[]>(hasCache ? cachedItems! : [])
  const [loading, setLoading] = useState(!hasCache)
  const [error, setError] = useState(false)
  const [editor, setEditor] = useState<ExplorePlace | 'new' | null>(null)
  const [fav, setFav] = useState<Place | null>(null)
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set())
  const [pop, setPop] = useState<Map<string, PopStat>>((hasCache && cachedPop) || new Map())
  const [ratings, setRatings] = useState<Map<string, { avg: number; count: number }>>((hasCache && cachedRatings) || new Map())
  const [filter, setFilter] = useState<ExploreFilterState>((hasCache && cachedFilter) || initialExploreFilter)
  const setF = (patch: Partial<ExploreFilterState>) => setFilter((s) => ({ ...s, ...patch }))

  const myTripIds = useMemo(() => trips.filter((t) => t.owner_id === user?.id).map((t) => t.id), [trips, user?.id])
  const [syncing, setSyncing] = useState(false)

  // Re-resolve the coordinate of every item I shared from its map_url and push
  // it onto ALL saved copies — so the same Explore place sits at the identical
  // spot in every trip, including trips saved before this existed. One click,
  // no SQL needed; the copies get fixed even without the explore_coords columns.
  async function resolveAllCoords() {
    const list = items.filter((e) => e.map_url)
    if (!list.length || syncing) return
    setSyncing(true)
    let done = 0
    const q = [...list]
    const worker = async () => {
      let e: ExplorePlace | undefined
      while ((e = q.shift())) {
        try { await syncExploreCoord(e.id, e.map_url, e.country) } catch { /* skip one */ }
        done++
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker))
    setSyncing(false)
    await reloadItems()
    if (currentTrip && myTripIds.includes(currentTrip.id)) void reloadTrip()
    toast.success(`อัปเดตพิกัด ${done} สถานที่ให้ตรงกันทุกทริปแล้ว`)
  }

  async function refreshStats() {
    // fetch both BEFORE setting state — one atomic re-render, no partial sort
    const [p, r] = await Promise.all([allPopularity(), allRatingStats()])
    cachedPop = p; cachedRatings = r
    setPop(p); setRatings(r)
  }
  async function refreshSaved() {
    setSavedSet(await savedExploreIds(myTripIds))
  }
  async function reloadItems() {
    if (!user) return
    const { data, error } = await listMyExplore(user.id)
    setError(!!error)
    const list = (data ?? []) as ExplorePlace[]
    cachedItems = list
    cachedUserId = user.id
    setItems(list)
  }

  async function load() {
    setLoading(true)
    await reloadItems()
    setLoading(false)
  }

  // returning from a place detail — restore the saved scroll position
  // synchronously before first paint (cached list renders this same frame)
  useLayoutEffect(() => {
    if (hasCache) window.scrollTo(0, cachedScroll)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hasCache) reloadItems() // quiet refresh — keeps what's on screen
    else load()
    refreshStats()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
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
    // separate channel — explore_reviews.sql is optional and must not be able
    // to take the rest of the live updates down with it
    const rch = supabase.channel('explore-manage-ratings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'explore_ratings' }, bump)
    rch.subscribe()
    return () => { clearTimeout(t); supabase.removeChannel(ch); supabase.removeChannel(rch) }
  }, [])

  // stash scroll + filter so "back" from the detail lands right here
  function openDetail(e: ExplorePlace) {
    cachedScroll = window.scrollY
    cachedFilter = filter
    navigate(`/explore/p/${e.id}`)
  }
  async function toggleFav(e: ExplorePlace) {
    if (savedSet.has(e.id)) {
      // un-save from every trip + delete the itinerary stops made from it
      if (!(await confirmDialog({
        message: `เอา "${e.name}" ออกจากทริปที่เซฟไว้? ถ้ามีจุดแวะของที่นี่ใน Itinerary จะถูกลบไปด้วย`,
        danger: true, confirmLabel: 'เอาออก',
      }))) return
      const { stopsRemoved } = await removeExploreCopiesDeep(e.id, myTripIds)
      refreshSaved()
      if (currentTrip && myTripIds.includes(currentTrip.id)) void reloadTrip()
      toast.success(stopsRemoved > 0 ? `เอาออกแล้ว · ลบจุดแวะใน Itinerary ${stopsRemoved} จุดด้วย` : 'เอาออกจากทริปแล้ว')
    } else setFav(exploreAsPlace(e))
  }

  // headline totals across all of my shared places
  const totals = useMemo(() => {
    let views = 0, saves = 0, comments = 0, starSum = 0, starN = 0
    for (const e of items) {
      const p = pop.get(e.id)
      if (p) { views += p.views; saves += p.saves; comments += p.comments }
      const r = ratings.get(e.id)
      // weight by how many people rated, so one 5★ place doesn't skew the mean
      if (r) { starSum += r.avg * r.count; starN += r.count }
    }
    return { views, saves, comments, stars: starN ? starSum / starN : 0, starN }
  }, [items, pop, ratings])

  const shown = useMemo(() => filterExplore(items, filter, pop, ratings), [items, filter, pop, ratings])

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
            {([
              ['ยอดคลิก', String(totals.views), IconEye],
              ['ยอดเซฟ', String(totals.saves), IconHeart],
              [totals.starN ? `คะแนน · ${totals.starN} คน` : 'คะแนนเฉลี่ย', totals.starN ? totals.stars.toFixed(1) : '–', IconStarFilled],
              ['คอมเมนต์', String(totals.comments), IconMessageCircle],
            ] as const).map(([label, n, Icon]) => (
              <div key={label} className="card p-2.5 text-center">
                <Icon size={16} className="mx-auto text-brand" />
                <div className="text-[16px] font-semibold tabular-nums mt-1">{n}</div>
                <div className="text-[10.5px] text-ink-3">{label}</div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <button onClick={resolveAllCoords} disabled={syncing}
            className="w-full mb-4 h-10 rounded-xl bg-surface-2 text-ink-2 text-[12.5px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {syncing ? <IconLoader2 size={15} className="animate-spin" /> : <IconMapPins size={15} className="text-brand" />}
            {syncing ? 'กำลังอัปเดตพิกัด…' : 'อัปเดตพิกัดให้ตรงกันทุกทริป'}
          </button>
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
              <ExploreCard key={e.id} e={e} isOwner saved={savedSet.has(e.id)} rating={ratings.get(e.id)} pop={pop.get(e.id)}
                onOpen={() => openDetail(e)}
                onFav={() => toggleFav(e)}
                onEdit={() => setEditor(e)}
                onDelete={async () => { if (await confirmDialog({ message: 'ลบรายการนี้ออกจาก Explore?', danger: true, confirmLabel: 'ลบ' })) { await deleteExplore(e.id); load() } }} />
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


      <SaveToTripDialog place={fav} open={!!fav} sourceExploreId={fav?.id}
        onClose={() => setFav(null)} onChanged={refreshSaved} />
    </div>
  )
}
