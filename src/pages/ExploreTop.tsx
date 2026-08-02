import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  IconArrowLeft, IconArrowRight, IconBuildingMonument, IconToolsKitchen2, IconCoffee,
  IconHeartPlus, IconHeartFilled,
} from '@tabler/icons-react'
import { SignedImage } from '@/components/SignedImage'
import { TopHero, RailCard, PlaceTile, topTitle } from '@/components/exploreTopParts'
import { SaveToTripDialog } from '@/components/SaveToTripDialog'
import { SaveAllToTripDialog } from '@/components/SaveAllToTripDialog'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { savedExploreIds } from '@/lib/placeMutations'
import { listExplore, allPopularity, exploreAsPlace, type PopStat } from '@/lib/exploreMutations'
import { allRatingStats } from '@/lib/exploreReviews'
import {
  buildTopLists, coverForKey, countryForKey, slugify, MAX_PLACES, TOP_BUCKETS,
  type RatingStat, type TopBucket, type TopList,
} from '@/lib/exploreTop'
import { hscroll } from '@/lib/hscroll'
import { FILTER_CARD_ART } from '@/lib/cityImages'
import { tintChromeFromPhoto } from '@/lib/photoTint'
import { useBack } from '@/lib/useBack'
import type { ExplorePlace, Place } from '@/lib/database.types'

const BUCKET_ICON = { place: IconBuildingMonument, food: IconToolsKitchen2, cafe: IconCoffee }
const BUCKET_TINT: Record<TopBucket, { bg: string; fg: string }> = {
  place: { bg: '#EAF1FB', fg: '#185FA5' },
  food: { bg: '#FBEEE8', fg: '#C2562B' },
  cafe: { bg: '#F3EEE6', fg: '#8A6A3B' },
}

/** how many cards a rail shows before "ดูทั้งหมด" takes over */
const RAIL_MAX = 10

/**
 * A country's home page, opened from the Explore banner.
 *
 * A hub, not a list: the filter carousel leads into each category's ranked
 * shortlist, and under it the country is laid out the way you'd browse it —
 * what was added most recently, then a rail per city. Every rail opens into a
 * full page of its own, so nothing here has to be exhaustive.
 */
export default function ExploreTop() {
  const { key = '' } = useParams()
  const navigate = useNavigate()
  const goBack = useBack('/explore')

  const { user } = useAuth()
  const { trips } = useTrip()
  const [lists, setLists] = useState<TopList[] | null>(null)
  const [ratings, setRatings] = useState<Map<string, RatingStat>>(new Map())
  const [bucket, setBucket] = useState<TopBucket>('place')
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set())
  const [fav, setFav] = useState<Place | null>(null)
  const [saveAll, setSaveAll] = useState(false)

  const myTripIds = useMemo(() => trips.filter((t) => t.owner_id === user?.id).map((t) => t.id), [trips, user?.id])
  useEffect(() => { if (myTripIds.length) void refreshSaved() }, [myTripIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  async function refreshSaved() { setSavedSet(await savedExploreIds(myTripIds)) }

  useEffect(() => {
    let off = false
    ;(async () => {
      const [res, pop, r] = await Promise.all([listExplore(), allPopularity(), allRatingStats()])
      if (off) return
      setRatings(r)
      setLists(buildTopLists((res.data ?? []) as ExplorePlace[], pop as Map<string, PopStat>, r))
    })()
    return () => { off = true }
  }, [])

  const list = lists?.find((l) => l.key === key) ?? null
  // Known from the url on the very first render, so the photo and its
  // status-bar tint land immediately instead of after the list request.
  const photo = list?.photo ?? coverForKey(key)
  const country = list?.country ?? countryForKey(key) ?? ''
  useEffect(() => tintChromeFromPhoto(photo, window.innerWidth / 340), [photo])

  // one card per filter, and only for filters this country actually has
  const buckets = useMemo(() => {
    const all = list?.entries ?? []
    return TOP_BUCKETS
      .map((b) => {
        const mine = all.filter((e) => e.bucket === b.key)
        // bespoke artwork wins; otherwise the top-ranked place's own photo
        const art = FILTER_CARD_ART[`${key}:${b.key}`] ?? null
        return {
          ...b, art,
          count: mine.length,
          photo: art ?? mine.find((e) => e.place.photo_url)?.place.photo_url ?? null,
        }
      })
      .filter((b) => b.count > 0)
  }, [list, key])

  // a country without, say, a single café shouldn't open on an empty card
  useEffect(() => {
    if (buckets.length && !buckets.some((b) => b.key === bucket)) setBucket(buckets[0].key)
  }, [buckets, bucket])

  const cities = list?.cities ?? []
  const recent = list?.recent ?? []
  const open = (id: string) => navigate(`/explore/p/${id}`)

  /** the ranked ten behind the card that's showing */
  const top = useMemo(() => (list?.entries ?? [])
    .filter((e) => e.bucket === bucket)
    .slice(0, MAX_PLACES)
    .map((e) => e.place), [list, bucket])
  const allSaved = top.length > 0 && top.every((p) => savedSet.has(p.id))

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
    <div className="min-h-dvh bg-canvas relative">
      <div className="relative max-w-[640px] mx-auto">
        <TopHero
          photo={photo}
          eyebrow={<>{list?.flag ?? '🌍'} {cities.length > 1 ? `${cities.length} เมือง` : cities[0]?.name ?? ''}</>}
          title={topTitle(country)}
          onBack={goBack}
          right={top.length > 0 ? (
            <button onClick={() => setSaveAll(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-white text-[12px] font-bold"
              style={allSaved
                ? { background: 'var(--color-brand)', boxShadow: '0 4px 14px rgba(2,112,251,.4)' }
                : { background: 'rgba(0,0,0,.28)', backdropFilter: 'blur(8px)' }}>
              {allSaved ? <><IconHeartFilled size={15} /> เซฟแล้ว</> : <><IconHeartPlus size={15} /> เซฟทั้งหมด</>}
            </button>
          ) : undefined}
          bottom={buckets.length > 0 ? (
            <div className="pt-4 pb-3">
              <FilterSlider options={buckets} active={bucket} onPick={setBucket} />
            </div>
          ) : undefined}
        />

        <div className="relative pt-4 pb-10 space-y-7">
          {!lists ? (
            <div className="py-14 text-center text-[13px] text-ink-3">กำลังโหลด…</div>
          ) : (
            <>
              {/* the card's own list, right under it — the card IS the heading */}
              {top.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5 px-4 sm:px-6">
                  {top.map((p, n) => (
                    <PlaceTile key={p.id} place={p} rating={ratings.get(p.id) ?? null} rank={n + 1}
                      saved={savedSet.has(p.id)} onOpen={() => open(p.id)}
                      onSave={() => setFav(exploreAsPlace(p))} />
                  ))}
                </div>
              )}

              <Rail title="เพิ่งเพิ่มล่าสุด" count={recent.length}
                onAll={() => navigate(`/explore/top/${key}/new`)}
                items={recent.slice(0, RAIL_MAX)} ratings={ratings}
                sub={(p) => p.city} onOpen={open} />

              {/* one city means the country rail would just repeat the one above
                  it — a "แยกตามเมือง" that doesn't split anything */}
              {cities.length > 1 && cities.map((c) => {
                const mine = recent.filter((p) => (p.city ?? '').trim() === c.name)
                if (!mine.length) return null
                return (
                  <Rail key={c.name} title={c.name} count={mine.length}
                    onAll={() => navigate(`/explore/top/${key}/city/${slugify(c.name)}`)}
                    items={mine.slice(0, RAIL_MAX)} ratings={ratings}
                    sub={(p) => p.routes?.[0]?.station ?? p.station_name} onOpen={open} />
                )
              })}
            </>
          )}
        </div>
      </div>

      <SaveToTripDialog place={fav} open={!!fav} sourceExploreId={fav?.id}
        onClose={() => setFav(null)} onChanged={refreshSaved} />
      <SaveAllToTripDialog items={top} open={saveAll}
        onClose={() => setSaveAll(false)} onChanged={refreshSaved} />
    </div>
  )
}

/** A titled horizontal rail with a "ดูทั้งหมด" out to the full list. */
function Rail({ title, count, items, ratings, sub, onAll, onOpen }: {
  title: string
  count: number
  items: ExplorePlace[]
  ratings: Map<string, RatingStat>
  sub: (p: ExplorePlace) => string | null | undefined
  onAll: () => void
  onOpen: (id: string) => void
}) {
  if (!items.length) return null
  return (
    <section>
      <div className="flex items-end gap-2 px-4 sm:px-6 mb-2.5">
        <h2 className="text-[17px] font-extrabold leading-none" style={{ letterSpacing: '-.3px' }}>{title}</h2>
        <span className="text-[12px] text-ink-3 leading-none">{count} ที่</span>
        <button onClick={onAll} className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand leading-none">
          ดูทั้งหมด <IconArrowRight size={14} />
        </button>
      </div>
      <div ref={hscroll} className="flex gap-3 overflow-x-auto no-scrollbar px-4 sm:px-6 pb-1">
        {items.map((p) => (
          <RailCard key={p.id} place={p} rating={ratings.get(p.id) ?? null}
            sub={sub(p)} onOpen={() => onOpen(p.id)} />
        ))}
      </div>
    </section>
  )
}

/** how far a finger has to travel before it counts as a swipe, not a tap */
const SWIPE_PX = 40

/**
 * The filter carousel: one card per filter (Places / Food / Cafe), worked
 * exactly like the Explore banner — the card stays put and its photo
 * cross-fades, rather than a track sliding sideways, which is what made
 * mid-swipe look like two half cards. No auto-advance.
 *
 * Swipe, tap a dot, or tap the card to move on — the ranked ten for whichever
 * card is showing sits directly below it, on this page.
 */
function FilterSlider({ options, active, onPick }: {
  options: { key: TopBucket; label: string; count: number; photo: string | null; art: string | null }[]
  active: TopBucket
  onPick: (b: TopBucket) => void
}) {
  const i = Math.max(0, options.findIndex((o) => o.key === active))
  const cur = options[i]
  const startX = useRef<number | null>(null)
  const moved = useRef(0)

  const go = (d: number) => onPick(options[(i + d + options.length) % options.length].key)

  return (
    <div
      onPointerDown={(e) => { startX.current = e.clientX; moved.current = 0 }}
      onPointerMove={(e) => { if (startX.current != null) moved.current = e.clientX - startX.current }}
      onPointerUp={() => {
        if (Math.abs(moved.current) >= SWIPE_PX) go(moved.current < 0 ? 1 : -1)
        else if (startX.current != null && options.length > 1) go(1)
        startX.current = null
      }}
      onPointerCancel={() => { startX.current = null }}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') go(1) }}
      className="relative mx-4 sm:mx-6 h-[168px] rounded-[16px] overflow-hidden cursor-pointer select-none touch-pan-y"
      style={{ background: BUCKET_TINT[cur.key].bg, boxShadow: '0 6px 18px rgba(10,40,90,.15)' }}>

      {/* the wash and the label live INSIDE each layer so they cross-fade with
          the photo — artwork that already says "landmark เด็ดฮ่องกง" gets
          neither, or the card would be lettered twice */}
      {options.map((o, n) => {
        const Icon = BUCKET_ICON[o.key]
        const tint = BUCKET_TINT[o.key]
        return (
          <div key={o.key} className="absolute inset-0 transition-opacity duration-500"
            style={{ opacity: n === i ? 1 : 0 }}>
            {o.photo
              ? <SignedImage url={o.photo} alt={o.art ? o.label : ''} className="w-full h-full object-cover" width={900} />
              : <span className="w-full h-full grid place-items-center" style={{ background: tint.bg }}>
                  <Icon size={38} stroke={1.3} style={{ color: tint.fg, opacity: .85 }} />
                </span>}
            {!o.art && (
              <>
                <span className="absolute inset-0" style={{
                  background: 'linear-gradient(95deg,rgba(4,18,38,.9) 0%,rgba(4,18,38,.6) 44%,rgba(4,18,38,.06) 82%)',
                }} />
                <span className="absolute inset-0 p-4 flex flex-col justify-center">
                  <span className="block text-white text-[24px] font-extrabold leading-[1.15]"
                    style={{ letterSpacing: '-.5px' }}>{o.label}</span>
                </span>
              </>
            )}
          </div>
        )
      })}

      {options.length > 1 && (
        <div className="absolute left-4 bottom-4 flex gap-1.5">
          {options.map((o, n) => (
            // padded out to a real tap target; the negative margin keeps the
            // row looking like the 5px dots it draws
            <button key={o.key} aria-label={o.label} className="p-1.5 -m-1.5"
              onClick={(ev) => { ev.stopPropagation(); onPick(o.key) }}
              onPointerDown={(ev) => ev.stopPropagation()}
              onPointerUp={(ev) => ev.stopPropagation()}>
              <span className="block h-[5px] rounded-full transition-all duration-300"
                style={{ width: n === i ? 16 : 5, background: n === i ? '#fff' : 'rgba(255,255,255,.45)' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
