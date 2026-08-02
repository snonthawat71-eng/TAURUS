import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlus, IconArrowLeft, IconRefresh, IconMapPin } from '@tabler/icons-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { TaurusLogo } from '@/components/TaurusLogo'
import { ExploreCard } from '@/components/ExploreCard'
import { ExploreEditor } from '@/components/ExploreEditor'
import { ExploreNotifications } from '@/components/ExploreNotifications'
import { ExploreFilters } from '@/components/ExploreFilters'
import { SaveToTripDialog } from '@/components/SaveToTripDialog'
import { ScrollToTopBubble } from '@/components/ScrollToTopBubble'
import { ExploreTopBanner } from '@/components/ExploreTopBanner'
import { ExploreSuggestDialog } from '@/components/ExploreSuggestDialog'
import { listExplore, addExplore, updateExplore, deleteExplore, exploreAsPlace, allPopularity, popularSet, type PopStat } from '@/lib/exploreMutations'
import { allRatingStats } from '@/lib/exploreReviews'
import { savedExploreIds, removeExploreCopiesDeep, updateExploreCopies, remapExploreCopyBranches, type PlaceInput } from '@/lib/placeMutations'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import { useBack } from '@/lib/useBack'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { filterExplore, initialExploreFilter, type ExploreFilterState } from '@/lib/exploreFilter'
import { buildTopLists, topListsFor } from '@/lib/exploreTop'
import type { ExplorePlace, Place } from '@/lib/database.types'

// Kept across route unmount (opening a place detail unmounts this page) so
// coming back shows the same list at the same scroll position instead of
// reloading from the top. Stats/popularity are cached too — the "popular"
// sort orders by them, so without the cache the list re-sorts (and jumps)
// the moment they arrive. Lives for the SPA session only.
let cachedItems: ExplorePlace[] | null = null
let cachedFilter: ExploreFilterState | null = null
let cachedScroll = 0
let cachedPop: Map<string, PopStat> | null = null
let cachedRatings: Map<string, { avg: number; count: number }> | null = null

export default function Explore() {
  const { user } = useAuth()
  const { trips, trip: currentTrip, reload: reloadTrip } = useTrip()
  const navigate = useNavigate()
  const goBack = useBack('/')
  const [items, setItems] = useState<ExplorePlace[]>(cachedItems ?? [])
  const [loading, setLoading] = useState(!cachedItems)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<ExploreFilterState>(cachedFilter ?? initialExploreFilter)
  const setF = (patch: Partial<ExploreFilterState>) => setFilter((s) => ({ ...s, ...patch }))
  const [editor, setEditor] = useState<ExplorePlace | 'new' | null>(null)
  const [fav, setFav] = useState<Place | null>(null)
  const [suggest, setSuggest] = useState<ExplorePlace | null>(null)
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set())
  const [pop, setPop] = useState<Map<string, PopStat>>(cachedPop ?? new Map())
  const [ratings, setRatings] = useState<Map<string, { avg: number; count: number }>>(cachedRatings ?? new Map())
  const [live, setLive] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const popular = useMemo(() => popularSet(pop), [pop])
  // "ที่เด็ด" banner: every city while browsing everything, then just the
  // picked country/city — the banner follows the filter instead of ignoring it
  const topAll = useMemo(() => buildTopLists(items, pop, ratings), [items, pop, ratings])
  const topShown = useMemo(() => topListsFor(topAll, filter.country, filter.city), [topAll, filter.country, filter.city])

  async function refreshStats() {
    // fetch both BEFORE setting state — one atomic re-render, no partial sort
    const [p, r] = await Promise.all([allPopularity(), allRatingStats()])
    cachedPop = p; cachedRatings = r
    setPop(p); setRatings(r)
  }

  // quiet reload of the items list (no full-page spinner)
  async function reloadItems() {
    const { data, error } = await listExplore()
    setError(!!error)
    const list = (data ?? []) as ExplorePlace[]
    cachedItems = list
    setItems(list)
  }

  // manual refresh — for when realtime isn't actually delivering updates
  async function refreshAll() {
    setRefreshing(true)
    await Promise.all([reloadItems(), refreshStats(), refreshSaved()])
    setRefreshing(false)
  }

  // open the full detail page (view is counted there). Stash the list scroll
  // position + active filter so returning lands exactly where we left off.
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

  const myTripIds = useMemo(() => trips.filter((t) => t.owner_id === user?.id).map((t) => t.id), [trips, user?.id])
  // every trip I can reach — used only to propagate an Explore edit to saved
  // copies. RLS (can_edit_trip) blocks view/places-only shared trips, so this
  // safely covers owned + edit-shared trips without touching Explore itself.
  const editableTripIds = useMemo(() => trips.map((t) => t.id), [trips])

  async function refreshSaved() {
    setSavedSet(await savedExploreIds(myTripIds))
  }

  async function load() {
    setLoading(true)
    const { data, error } = await listExplore()
    setError(!!error)
    const list = (data ?? []) as ExplorePlace[]
    cachedItems = list
    setItems(list)
    setLoading(false)
  }
  // returning from a place detail: the cached list is already rendered this
  // very frame, so jump to the saved position synchronously BEFORE the first
  // paint — no flash at the top, no late correction (the browser's own
  // restoration is disabled globally; see ScrollManager in App.tsx)
  useLayoutEffect(() => {
    if (cachedItems) window.scrollTo(0, cachedScroll)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cachedItems) reloadItems() // quiet refresh — keeps what's on screen
    else load()
    refreshStats()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { refreshSaved() }, [myTripIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-check what's saved whenever the page is shown again — covers deleting a
  // saved place from the trip's Places page (or back/forward bfcache restores),
  // which would otherwise leave the ♥ stale here.
  useEffect(() => {
    const onShow = () => { if (document.visibilityState !== 'hidden') refreshSaved() }
    document.addEventListener('visibilitychange', onShow)
    window.addEventListener('focus', onShow)
    window.addEventListener('pageshow', onShow)
    return () => {
      document.removeEventListener('visibilitychange', onShow)
      window.removeEventListener('focus', onShow)
      window.removeEventListener('pageshow', onShow)
    }
  }, [myTripIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

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
    // ratings live on their own channel: explore_reviews.sql is optional, and a
    // subscription to a table that isn't there yet must not kill the rest
    const rch = supabase.channel('explore-live-ratings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'explore_ratings' }, bumpStats)
    rch.subscribe()
    return () => { clearTimeout(st); clearTimeout(it); setLive(false); supabase.removeChannel(ch); supabase.removeChannel(rch) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => filterExplore(items, filter, pop, ratings), [items, filter, pop, ratings])

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 bg-canvas/95 backdrop-blur grid grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6 min-h-14" style={{ borderBottom: '0.5px solid var(--color-line)', paddingTop: 'var(--sat)' }}>
        <button onClick={goBack} className="btn-icon !border-0 justify-self-start" aria-label="กลับ"><IconArrowLeft size={18} /></button>
        <TaurusLogo height={42} />
        <div className="flex items-center gap-1 justify-self-end">
          {user && <ExploreNotifications userId={user.id} onOpenItem={(id) => navigate(`/explore/p/${id}`)} />}
          <button onClick={() => navigate('/explore/mine')} className="btn-icon !border-0" aria-label="จัดการสถานที่ของฉัน" title="สถานที่ที่ฉันแชร์"><IconMapPin size={18} /></button>
          <button onClick={() => setEditor('new')} className="btn-icon !w-auto px-3 gap-1.5 text-[12px] font-medium"><IconPlus size={15} /><span className="max-sm:hidden">เพิ่มสถานที่</span></button>
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-4 sm:px-6 py-5">
        {/* realtime status + manual refresh (in case realtime isn't delivering) */}
        <div className="flex items-center gap-1.5 text-[11px] text-ink-3 mb-3">
          <span className="size-2 rounded-full shrink-0" style={{ background: live ? '#1E8E5A' : '#C99A3A' }} />
          <span>{live ? 'อัปเดตแบบเรียลไทม์' : 'ไม่ได้เชื่อมต่อเรียลไทม์'}</span>
          <button onClick={refreshAll} disabled={refreshing}
            className="ml-auto inline-flex items-center gap-1 text-brand-mid font-medium disabled:opacity-50">
            <IconRefresh size={12} className={refreshing ? 'animate-spin' : ''} /> รีเฟรช
          </button>
        </div>

        <ExploreFilters items={items} f={filter} set={setF} userId={user?.id}
          belowSearch={<ExploreTopBanner lists={topShown} onOpen={(l) => { cachedScroll = window.scrollY; cachedFilter = filter; navigate(`/explore/top/${l.key}`) }} />} />

        {loading ? (
          <div className="py-16 text-center text-[13px] text-ink-3">กำลังโหลด…</div>
        ) : error ? (
          <div className="card p-6 text-center text-[12px] text-ink-2">ยังไม่ได้ตั้งค่า Explore — รัน <code className="text-booking">supabase/explore.sql</code> ใน Supabase ก่อน</div>
        ) : shown.length === 0 ? (
          <div className="card p-8 text-center text-[13px] text-ink-3">ยังไม่มีรายการ — กด “เพิ่มสถานที่” เพื่อแชร์ที่แรก</div>
        ) : (
          <div className="space-y-3">
            {shown.map((e) => (
              <ExploreCard key={e.id} e={e} isOwner={e.created_by === user?.id} saved={savedSet.has(e.id)} rating={ratings.get(e.id)} popular={popular.has(e.id)} pop={pop.get(e.id)}
                onOpen={() => openDetail(e)}
                onFav={() => toggleFav(e)}
                onEdit={() => setEditor(e)}
                onSuggest={() => setSuggest(e)}
                onDelete={async () => { if (await confirmDialog({ message: 'ลบรายการนี้ออกจาก Explore?', danger: true, confirmLabel: 'ลบ' })) { await deleteExplore(e.id); load() } }} />
            ))}
          </div>
        )}
      </main>

      <ExploreEditor open={!!editor} initial={editor && editor !== 'new' ? editor : null} existing={items} onClose={() => setEditor(null)}
        onSave={async (input, remap) => {
          if (editor && editor !== 'new') {
            await updateExplore(editor.id, input)
            // keep places already saved into my trips in sync with this edit.
            // `country` isn't a `places` column — drop it before propagating.
            const { country, ...placeFields } = input // eslint-disable-line @typescript-eslint/no-unused-vars
            await updateExploreCopies(editor.id, placeFields as PlaceInput, editableTripIds)
            // the copies just took the new branch list — re-point the branch
            // each saved copy/plan had chosen, or they'd land on another branch
            if (remap) await remapExploreCopyBranches(editor.id, editableTripIds, remap)
          }
          else if (user) await addExplore(user.id, input)
          // quiet reload (no full-page spinner) so the scroll position is kept
          reloadItems()
        }} />

      <SaveToTripDialog place={fav} open={!!fav} sourceExploreId={fav?.id}
        onClose={() => setFav(null)} onChanged={refreshSaved} />

      <ExploreSuggestDialog place={suggest} open={!!suggest} onClose={() => setSuggest(null)} />

      <ScrollToTopBubble />
    </div>
  )
}
