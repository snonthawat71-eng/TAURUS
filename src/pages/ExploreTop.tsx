import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  IconArrowLeft, IconStarFilled, IconMapPin, IconHeartFilled, IconPlus, IconMap2,
} from '@tabler/icons-react'
import { SignedImage } from '@/components/SignedImage'
import { SaveToTripDialog } from '@/components/SaveToTripDialog'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { listExplore, allPopularity, exploreAsPlace, type PopStat } from '@/lib/exploreMutations'
import { allRatingStats } from '@/lib/exploreReviews'
import { savedExploreIds } from '@/lib/placeMutations'
import { buildTopLists, TOP_LABEL, type TopList, type TopEntry } from '@/lib/exploreTop'
import { catMeta } from '@/lib/placeMeta'
import { stationCode, lineColorFor } from '@/lib/metro/suggest'
import { openMap } from '@/lib/maps'
import { useBack } from '@/lib/useBack'
import type { ExplorePlace, Place } from '@/lib/database.types'

/** A city's must-see shortlist, opened from the Explore banner. A full page,
 *  not a sheet: it's a destination you can land on and share, and the ranked
 *  list is long enough that a sheet would fight the page behind it. */
export default function ExploreTop() {
  const { key = '' } = useParams()
  const navigate = useNavigate()
  const goBack = useBack('/explore')
  const { user } = useAuth()
  const { trips } = useTrip()

  const [lists, setLists] = useState<TopList[] | null>(null)
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set())
  const [fav, setFav] = useState<Place | null>(null)
  const [group, setGroup] = useState<'all' | 'place' | 'food'>('all')

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
  const shown = useMemo(() => {
    if (!list) return []
    if (group === 'all') return list.entries
    return list.entries.filter((e) => (e.place.group_type ?? 'place') === group)
  }, [list, group])

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
      {/* hero */}
      <div className="relative h-[190px] overflow-hidden" style={{ background: 'linear-gradient(140deg,#8fa8c9,#2f4a72)' }}>
        {list?.photo && <SignedImage url={list.photo} alt="" className="w-full h-full object-cover" width={900} />}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(transparent 28%,rgba(4,18,38,.88))' }} />
        <button onClick={goBack} aria-label="ย้อนกลับ"
          className="absolute size-9 rounded-full bg-white/90 grid place-items-center text-ink-2 shadow-sm"
          style={{ top: 'calc(env(safe-area-inset-top,0px) + 12px)', left: 14 }}>
          <IconArrowLeft size={18} />
        </button>
        <div className="absolute inset-x-0 bottom-0 p-4 max-w-[640px] mx-auto">
          <h1 className="text-white text-[24px] font-extrabold leading-[1.15]" style={{ letterSpacing: '-.5px' }}>
            {TOP_LABEL}<br />{list?.city ?? ''}
          </h1>
          <div className="text-white/[.8] text-[11.5px] mt-1.5 flex items-center gap-1.5">
            <span>{list?.entries.length ?? 0} ที่</span>
            {!!list?.avgRating && (
              <><span>·</span><IconStarFilled size={10} /><span className="tabular-nums">{list.avgRating.toFixed(1)}</span></>
            )}
            <span>·</span><span>เรียงจากคะแนนรีวิวและยอดเซฟจริง</span>
          </div>
        </div>
      </div>

      <div className="max-w-[640px] mx-auto px-4 sm:px-6 py-4 pb-10">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-3">
          {([['all', 'ทั้งหมด'], ['place', 'ที่เที่ยว'], ['food', 'ร้านอาหาร']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setGroup(k)}
              className={['h-8 px-3.5 rounded-full text-[12px] font-semibold whitespace-nowrap shrink-0 border',
                group === k ? 'bg-ink text-white border-ink' : 'bg-surface text-ink-2 border-line-2'].join(' ')}>
              {label}
            </button>
          ))}
        </div>

        {!lists ? (
          <div className="py-14 text-center text-[13px] text-ink-3">กำลังโหลด…</div>
        ) : shown.length === 0 ? (
          <div className="card p-8 text-center text-[13px] text-ink-3">ยังไม่มีรายการในหมวดนี้</div>
        ) : (
          <div className="space-y-2.5">
            {shown.map((e, n) => (
              <Row key={e.place.id} entry={e} rank={n + 1}
                saved={savedSet.has(e.place.id)}
                onOpen={() => navigate(`/explore/p/${e.place.id}`)}
                onSave={() => setFav(exploreAsPlace(e.place))} />
            ))}
          </div>
        )}
      </div>

      <SaveToTripDialog place={fav} open={!!fav} sourceExploreId={fav?.id}
        onClose={() => setFav(null)} onChanged={refreshSaved} />
    </div>
  )
}

function Row({ entry, rank, saved, onOpen, onSave }: {
  entry: TopEntry
  rank: number
  saved: boolean
  onOpen: () => void
  onSave: () => void
}) {
  const { place: p, rating, reason } = entry
  const meta = catMeta(p.category)
  const Icon = meta.icon
  const line = p.routes?.[0]?.line ?? p.station_line
  const station = p.routes?.[0]?.station ?? p.station_name
  const code = stationCode(line, station)
  // the first three get a gold badge — a podium reads faster than a number
  const podium = rank <= 3

  return (
    <div className="card p-2.5 flex gap-3 relative">
      <span className="absolute -left-1 -top-1.5 size-[26px] rounded-full grid place-items-center text-[12px] font-extrabold text-white z-10"
        style={podium
          ? { background: 'linear-gradient(135deg,#FFC93C,#E8A21B)', boxShadow: '0 3px 8px rgba(232,162,27,.45)' }
          : { background: 'var(--color-brand)', boxShadow: '0 3px 8px rgba(2,112,251,.35)' }}>
        {rank}
      </span>

      <button onClick={onOpen} aria-label={p.name ?? ''}
        className="w-[96px] h-[96px] rounded-[11px] overflow-hidden shrink-0 relative bg-surface-2">
        {p.photo_url
          ? <SignedImage url={p.photo_url} alt="" className="w-full h-full object-cover" width={280} />
          : <span className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><Icon size={26} stroke={1.4} style={{ color: meta.fg }} /></span>}
        {!!rating?.count && (
          <span className="absolute left-1 bottom-1 inline-flex items-center gap-0.5 rounded-full px-1.5 h-[17px] text-[10px] font-bold text-white"
            style={{ background: 'rgba(0,0,0,.55)' }}>
            <IconStarFilled size={9} style={{ color: '#F5A623' }} />
            <span className="tabular-nums">{rating.avg.toFixed(1)}</span>
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <button onClick={onOpen} className="text-left w-full">
          <div className="text-[14px] font-bold leading-snug line-clamp-2">{p.name}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-ink-3 mt-1">
            {code
              ? <span className="rounded-full px-1.5 h-[15px] inline-flex items-center text-[8.5px] font-extrabold text-white shrink-0"
                  style={{ background: lineColorFor(line) ?? p.station_color ?? '#888780' }}>{code}</span>
              : <IconMapPin size={11} className="shrink-0" />}
            <span className="truncate">{station || p.city}</span>
          </div>
        </button>

        {reason && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold mt-1.5"
            style={{ background: '#FFF4E0', color: '#B4690E' }}>{reason}</span>
        )}

        <div className="flex gap-1.5 mt-2">
          <button onClick={onSave}
            className="flex-1 h-[29px] rounded-[9px] text-[11.5px] font-bold inline-flex items-center justify-center gap-1"
            style={saved
              ? { background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)' }
              : { background: 'var(--color-brand)', color: '#fff' }}>
            {saved ? <><IconHeartFilled size={13} /> เซฟแล้ว</> : <><IconPlus size={13} /> เซฟเข้าทริป</>}
          </button>
          {p.map_url && (
            <button onClick={() => openMap(p.map_url)} aria-label="เปิดแผนที่"
              className="w-[34px] h-[29px] rounded-[9px] bg-surface-2 text-ink-2 grid place-items-center">
              <IconMap2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
