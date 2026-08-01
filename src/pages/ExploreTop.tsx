import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconArrowLeft, IconStarFilled, IconHeart, IconHeartFilled } from '@tabler/icons-react'
import { SignedImage } from '@/components/SignedImage'
import { SaveToTripDialog } from '@/components/SaveToTripDialog'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { listExplore, allPopularity, exploreAsPlace, type PopStat } from '@/lib/exploreMutations'
import { allRatingStats } from '@/lib/exploreReviews'
import { savedExploreIds } from '@/lib/placeMutations'
import { buildTopLists, TOP_LABEL, type TopList, type TopEntry } from '@/lib/exploreTop'
import { catMeta } from '@/lib/placeMeta'
import { useBack } from '@/lib/useBack'
import type { ExplorePlace, Place } from '@/lib/database.types'

type Tab = 'all' | 'place' | 'food'
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'place', label: 'PLACES' },
  { key: 'food', label: 'FOOD' },
]

/** The strip's fade into the page. A plain two-stop gradient to the canvas
 *  colour banded badly and ended in a visible line; easing the alpha across
 *  several stops dissolves it. color-mix keeps it correct in dark mode, where
 *  the canvas colour is a different one. */
const FADE = `linear-gradient(to bottom,
  color-mix(in srgb, var(--color-canvas) 0%, transparent) 0%,
  color-mix(in srgb, var(--color-canvas) 8%, transparent) 20%,
  color-mix(in srgb, var(--color-canvas) 24%, transparent) 38%,
  color-mix(in srgb, var(--color-canvas) 48%, transparent) 55%,
  color-mix(in srgb, var(--color-canvas) 72%, transparent) 70%,
  color-mix(in srgb, var(--color-canvas) 90%, transparent) 84%,
  var(--color-canvas) 100%)`

/**
 * A city's shortlist, opened from the Explore banner. A full page, not a sheet:
 * it's a destination you can land on and share.
 *
 * Laid out as a photo grid because that's what the page is for — ten places to
 * look at and pick from. The city photo is only a short strip that fades into
 * the page: a full hero would compete with the ten photos below it, which are
 * the actual content.
 */
export default function ExploreTop() {
  const { key = '' } = useParams()
  const navigate = useNavigate()
  const goBack = useBack('/explore')
  const { user } = useAuth()
  const { trips } = useTrip()

  const [lists, setLists] = useState<TopList[] | null>(null)
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set())
  const [fav, setFav] = useState<Place | null>(null)
  const [tab, setTab] = useState<Tab>('all')

  const myTripIds = useMemo(() => trips.filter((t) => t.owner_id === user?.id).map((t) => t.id), [trips, user?.id])

  useEffect(() => {
    let off = false
    ;(async () => {
      const [res, pop, ratings] = await Promise.all([listExplore(), allPopularity(), allRatingStats()])
      if (off) return
      setLists(buildTopLists((res.data ?? []) as ExplorePlace[], pop as Map<string, PopStat>, ratings))
    })()
    return () => { off = true }
  }, [])

  useEffect(() => { if (myTripIds.length) void refreshSaved() }, [myTripIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  async function refreshSaved() { setSavedSet(await savedExploreIds(myTripIds)) }

  const list = lists?.find((l) => l.key === key) ?? null
  const groupOf = (e: TopEntry) => (e.place.group_type === 'food' ? 'food' : 'place')
  const counts = useMemo(() => ({
    all: list?.entries.length ?? 0,
    place: list?.entries.filter((e) => groupOf(e) === 'place').length ?? 0,
    food: list?.entries.filter((e) => groupOf(e) === 'food').length ?? 0,
  }), [list])
  const shown = useMemo(
    () => (!list ? [] : tab === 'all' ? list.entries : list.entries.filter((e) => groupOf(e) === tab)),
    [list, tab],
  )

  if (lists && !list) {
    return (
      <div className="min-h-dvh bg-canvas">
        <div className="max-w-[640px] mx-auto px-4 py-6">
          <button onClick={goBack} className="btn-icon !border-0 mb-4"><IconArrowLeft size={18} /></button>
          <div className="card p-8 text-center text-[13px] text-ink-3">ไม่พบรายการนี้แล้ว</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-canvas">
      {/* a strip of the city, dissolving into the page rather than a full hero */}
      <div className="relative h-[150px] overflow-hidden" style={{ background: 'linear-gradient(140deg,#8fa8c9,#2f4a72)' }}>
        {list?.photo && <SignedImage url={list.photo} alt="" className="w-full h-full object-cover" width={900} />}
        <div className="absolute inset-x-0 bottom-0 h-[104px]" style={{ background: FADE }} />
        <button onClick={goBack} aria-label="ย้อนกลับ"
          className="absolute size-9 rounded-full bg-white/90 grid place-items-center text-ink-2 shadow-sm"
          style={{ top: 'calc(env(safe-area-inset-top,0px) + 12px)', left: 14 }}>
          <IconArrowLeft size={18} />
        </button>
      </div>

      <div className="max-w-[640px] mx-auto">
        <div className="px-4 sm:px-6 pt-2.5 pb-3.5">
          <div className="text-[9.5px] font-bold uppercase text-ink-3" style={{ letterSpacing: '.16em' }}>
            {list?.flag} {list?.country}
          </div>
          <h1 className="text-[26px] font-extrabold leading-[1.13] mt-1.5" style={{ letterSpacing: '-.6px' }}>
            {TOP_LABEL}<br />{list?.city ?? ''}
          </h1>
        </div>

        <div className="flex gap-6 px-4 sm:px-6 overflow-x-auto no-scrollbar"
          style={{ borderBottom: '0.5px solid var(--color-line)' }}>
          {TABS.map((t) => {
            const on = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={['relative pb-2.5 text-[12.5px] font-extrabold whitespace-nowrap flex items-center gap-1.5',
                  on ? 'text-ink' : 'text-ink-3'].join(' ')}
                style={{ letterSpacing: '.08em' }}>
                {t.label}
                <span className="text-[11px] font-bold rounded-full px-1.5 py-px"
                  style={on
                    ? { background: 'var(--color-brand-soft)', color: 'var(--color-brand-mid)' }
                    : { background: 'var(--color-surface-2)', color: 'var(--color-ink-3)' }}>
                  {counts[t.key]}
                </span>
                {on && <span className="absolute left-0 right-0 -bottom-[0.5px] h-[2.5px] rounded-full bg-brand" />}
              </button>
            )
          })}
        </div>

        <div className="px-4 sm:px-6 pt-3.5 pb-10">
          {!lists ? (
            <div className="py-14 text-center text-[13px] text-ink-3">กำลังโหลด…</div>
          ) : shown.length === 0 ? (
            <div className="card p-8 text-center text-[13px] text-ink-3">ยังไม่มีรายการในหมวดนี้</div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {shown.map((e) => (
                <Tile key={e.place.id} entry={e}
                  rank={(list?.entries.indexOf(e) ?? 0) + 1}
                  saved={savedSet.has(e.place.id)}
                  onOpen={() => navigate(`/explore/p/${e.place.id}`)}
                  onSave={() => setFav(exploreAsPlace(e.place))} />
              ))}
            </div>
          )}
        </div>
      </div>

      <SaveToTripDialog place={fav} open={!!fav} sourceExploreId={fav?.id}
        onClose={() => setFav(null)} onChanged={refreshSaved} />
    </div>
  )
}

function Tile({ entry, rank, saved, onOpen, onSave }: {
  entry: TopEntry
  rank: number
  saved: boolean
  onOpen: () => void
  onSave: () => void
}) {
  const { place: p, rating, reason } = entry
  const meta = catMeta(p.category)
  const Icon = meta.icon
  const where = p.routes?.[0]?.station ?? p.station_name ?? p.city
  // top three wear gold; the rest a plain white disc
  const podium = rank <= 3

  return (
    <div onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen() }}
      className="relative h-[186px] rounded-[15px] overflow-hidden cursor-pointer bg-surface-2"
      style={{ boxShadow: '0 3px 12px rgba(10,40,90,.1)' }}>
      {p.photo_url
        ? <SignedImage url={p.photo_url} alt="" className="w-full h-full object-cover" width={420} />
        : <span className="w-full h-full grid place-items-center" style={{ background: meta.bg }}>
            <Icon size={34} stroke={1.3} style={{ color: meta.fg, opacity: .85 }} />
          </span>}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(transparent 40%,rgba(4,18,38,.85))' }} />

      <span className="absolute left-2 top-2 size-[25px] rounded-full grid place-items-center text-[12px] font-extrabold"
        style={podium
          ? { background: 'linear-gradient(135deg,#FFC93C,#E8A21B)', color: '#fff' }
          : { background: 'rgba(255,255,255,.94)', color: 'var(--color-ink)' }}>
        {rank}
      </span>

      <button onClick={(ev) => { ev.stopPropagation(); onSave() }}
        aria-label={saved ? 'จัดการที่เซฟไว้' : 'เซฟเข้าทริป'}
        className="absolute right-2 top-2 size-[30px] rounded-full grid place-items-center bg-white/[.92]"
        style={{ color: saved ? 'var(--color-brand)' : 'var(--color-ink-3)' }}>
        {saved ? <IconHeartFilled size={15} /> : <IconHeart size={15} />}
      </button>

      {reason && (
        <span className="absolute left-2 right-2 bottom-[62px] inline-flex w-fit max-w-full items-center rounded-full px-2 py-0.5 text-[9px] font-extrabold truncate"
          style={{ background: '#FFF4E0', color: '#B4690E' }}>{reason}</span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-2.5 pointer-events-none">
        <div className="text-white text-[13px] font-extrabold leading-[1.2] line-clamp-2">{p.name}</div>
        <div className="text-white/[.85] text-[10.5px] mt-0.5 flex items-center gap-1 truncate">
          {!!rating?.count && (
            <>
              <IconStarFilled size={9} />
              <span className="tabular-nums">{rating.avg.toFixed(1)}</span>
              <span>·</span>
            </>
          )}
          <span className="truncate">{where}</span>
        </div>
      </div>
    </div>
  )
}
