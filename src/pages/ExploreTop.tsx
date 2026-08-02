import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  IconArrowLeft, IconStarFilled, IconHeart, IconHeartFilled,
  IconBuildingMonument, IconToolsKitchen2, IconCoffee, IconWorldSearch, IconMapPin,
} from '@tabler/icons-react'
import { SignedImage } from '@/components/SignedImage'
import { SaveToTripDialog } from '@/components/SaveToTripDialog'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { listExplore, allPopularity, exploreAsPlace, type PopStat } from '@/lib/exploreMutations'
import { allRatingStats } from '@/lib/exploreReviews'
import { savedExploreIds } from '@/lib/placeMutations'
import {
  buildTopLists, coverForKey, countryForKey, MAX_PLACES, TOP_BUCKETS, TOP_LABEL,
  type TopBucket, type TopList, type TopEntry,
} from '@/lib/exploreTop'
import { catMeta } from '@/lib/placeMeta'
import { hscroll } from '@/lib/hscroll'
import { tintChromeFromPhoto } from '@/lib/photoTint'
import { useBack } from '@/lib/useBack'
import type { ExplorePlace, Place } from '@/lib/database.types'

/** The photo's dissolve into the page.
 *
 *  Two things make it read as one surface rather than a photo with a lid on it:
 *  the fade runs most of the photo's height, and the alpha is eased across many
 *  stops. A short two-stop gradient banded and ended on a visible line.
 *  color-mix keeps it right in dark mode, where the canvas colour differs. */
const FADE = `linear-gradient(to bottom,
  color-mix(in srgb, var(--color-canvas) 0%, transparent) 0%,
  color-mix(in srgb, var(--color-canvas) 3%, transparent) 12%,
  color-mix(in srgb, var(--color-canvas) 9%, transparent) 24%,
  color-mix(in srgb, var(--color-canvas) 18%, transparent) 36%,
  color-mix(in srgb, var(--color-canvas) 31%, transparent) 47%,
  color-mix(in srgb, var(--color-canvas) 46%, transparent) 58%,
  color-mix(in srgb, var(--color-canvas) 62%, transparent) 68%,
  color-mix(in srgb, var(--color-canvas) 77%, transparent) 78%,
  color-mix(in srgb, var(--color-canvas) 89%, transparent) 87%,
  color-mix(in srgb, var(--color-canvas) 96%, transparent) 94%,
  var(--color-canvas) 100%)`

/** how tall the photo is, and therefore where the grid may start */
const HERO_H = 340

const BUCKET_ICON = { place: IconBuildingMonument, food: IconToolsKitchen2, cafe: IconCoffee }
const BUCKET_TINT: Record<TopBucket, { bg: string; fg: string }> = {
  place: { bg: '#EAF1FB', fg: '#185FA5' },
  food: { bg: '#FBEEE8', fg: '#C2562B' },
  cafe: { bg: '#F3EEE6', fg: '#8A6A3B' },
}

/**
 * A country's shortlist, opened from the Explore banner. A full page, not a
 * sheet: it's a destination you can land on and share.
 *
 * Laid out as a photo grid because that's what the page is for — ten places to
 * look at and pick from. The country photo is a full-bleed backdrop the heading
 * and the filter cards sit ON, dissolving into the page behind the grid —
 * rather than a separate band with an edge, which is what made the seam obvious.
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
  const [bucket, setBucket] = useState<TopBucket>('place')
  const [city, setCity] = useState<string | null>(null)

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
  // Known from the url on the very first render, so the photo and its
  // status-bar tint land immediately instead of after the list request.
  const photo = list?.photo ?? coverForKey(key)
  const country = list?.country ?? countryForKey(key) ?? ''
  // the photo runs to the very top, so the status-bar zone has to be painted
  // its colour too — otherwise it sits under a white band. Pass the hero's
  // shape so the sample comes from the strip the crop actually shows.
  useEffect(() => tintChromeFromPhoto(photo, window.innerWidth / HERO_H), [photo])

  // one card per filter, and only for filters this country actually has. The
  // card wears the photo of that filter's top-ranked place, so it shows what
  // it opens instead of just naming it.
  const buckets = useMemo(() => {
    const all = list?.entries ?? []
    return TOP_BUCKETS
      .map((b) => {
        const mine = all.filter((e) => e.bucket === b.key)
        return { ...b, count: mine.length, photo: mine.find((e) => e.place.photo_url)?.place.photo_url ?? null }
      })
      .filter((b) => b.count > 0)
  }, [list])

  // a country with no places at all in the default filter shouldn't open empty
  useEffect(() => {
    if (buckets.length && !buckets.some((b) => b.key === bucket)) setBucket(buckets[0].key)
  }, [buckets, bucket])

  // a city picked on one filter may not exist on the next
  const cities = list?.cities ?? []
  useEffect(() => {
    if (city && !cities.some((c) => c.name === city)) setCity(null)
  }, [cities, city])

  const shown = useMemo(() => (list?.entries ?? [])
    .filter((e) => e.bucket === bucket)
    .filter((e) => !city || e.place.city === city)
    .slice(0, MAX_PLACES), [list, bucket, city])

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
      {/* the country photo as a backdrop the heading sits on, not a band above it */}
      <div className="absolute inset-x-0 top-0 overflow-hidden pointer-events-none"
        style={{ height: HERO_H, background: 'linear-gradient(140deg,#8fa8c9,#2f4a72)' }}>
        {photo && <SignedImage url={photo} alt="" className="w-full h-full object-cover" width={900} />}
        <div className="absolute inset-x-0 bottom-0 h-[250px]" style={{ background: FADE }} />
      </div>

      <div className="relative max-w-[640px] mx-auto">
        {/* Everything that sits ON the photo. The block holds the photo's height
            so the grid always starts where the photo has faded out, with the
            filter cards pinned to its bottom edge. */}
        <div className="flex flex-col justify-between" style={{ minHeight: HERO_H }}>
          <div className="px-4 sm:px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)' }}>
            <button onClick={goBack} aria-label="ย้อนกลับ"
              className="size-9 rounded-full grid place-items-center text-white"
              style={{ background: 'rgba(0,0,0,.28)', backdropFilter: 'blur(8px)' }}>
              <IconArrowLeft size={18} />
            </button>

            <div className="pt-5">
              <div className="text-[10px] font-bold uppercase text-white/85"
                style={{ letterSpacing: '.16em', textShadow: '0 1px 10px rgba(0,0,0,.45)' }}>
                {list?.flag ?? '🌍'} {cities.length > 1 ? `${cities.length} เมือง` : cities[0]?.name ?? ''}
              </div>
              <h1 className="text-[19px] font-extrabold leading-[1.2] mt-1.5 text-white"
                style={{ letterSpacing: '-.3px', textShadow: '0 2px 16px rgba(0,0,0,.4)' }}>
                {TOP_LABEL}{country ? ` ${country}` : ''}
              </h1>
            </div>
          </div>

          <div className="pt-3 pb-3">
            {buckets.length > 0 && (
              <FilterSlider options={buckets} active={bucket} onPick={setBucket} />
            )}

            {/* cities of this country, same cards as the Explore rail */}
            {cities.length > 1 && (
              <div ref={hscroll} className="flex gap-2.5 overflow-x-auto no-scrollbar px-4 sm:px-6 mt-3 pb-1">
                <CityCard on={!city} label="ทุกเมือง" onClick={() => setCity(null)} />
                {cities.map((c) => (
                  <CityCard key={c.name} on={city === c.name} label={c.name} photo={c.photo}
                    onClick={() => setCity(city === c.name ? null : c.name)} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 sm:px-6 pt-3 pb-10">
          {!lists ? (
            <div className="py-14 text-center text-[13px] text-ink-3">กำลังโหลด…</div>
          ) : shown.length === 0 ? (
            <div className="card p-8 text-center text-[13px] text-ink-3">ยังไม่มีรายการ</div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {shown.map((e, n) => (
                <Tile key={e.place.id} entry={e} rank={n + 1}
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

/** how far a finger has to travel before it counts as a swipe, not a tap */
const SWIPE_PX = 40
/** gutter between the cards while one slides past */
const GAP = 10

/**
 * The filter carousel: one wide card per filter (สถานที่ / ร้านอาหาร / คาเฟ่),
 * swiped like the Explore banner. The card you're looking at IS the filter, so
 * there's no separate "apply" — and the next one peeks in from the right so the
 * swipe doesn't have to be guessed at. Tapping the peeking card works too.
 */
function FilterSlider({ options, active, onPick }: {
  options: { key: TopBucket; label: string; count: number; photo: string | null }[]
  active: TopBucket
  onPick: (b: TopBucket) => void
}) {
  const i = Math.max(0, options.findIndex((o) => o.key === active))
  const startX = useRef<number | null>(null)
  const moved = useRef(0)

  const go = (d: number) => {
    const n = Math.min(options.length - 1, Math.max(0, i + d))
    if (n !== i) onPick(options[n].key)
  }

  return (
    <div className="mx-4 sm:mx-6">
      {/* the clip has to be the content box, not a padded one: the card that
          slid off would otherwise leave a sliver in the page margin. py/-my
          gives the card's shadow room to fall without costing layout height. */}
      <div className="overflow-hidden py-6 -my-6 select-none touch-pan-y"
        onPointerDown={(e) => { startX.current = e.clientX; moved.current = 0 }}
        onPointerMove={(e) => { if (startX.current != null) moved.current = e.clientX - startX.current }}
        onPointerUp={() => {
          if (Math.abs(moved.current) >= SWIPE_PX) go(moved.current < 0 ? 1 : -1)
          startX.current = null
        }}
        onPointerCancel={() => { startX.current = null }}>
        <div className="flex transition-transform duration-300 ease-out"
          style={{ gap: GAP, transform: `translateX(calc(${-i * 100}% - ${i * GAP}px))` }}>
          {options.map((o) => {
            const Icon = BUCKET_ICON[o.key]
            const tint = BUCKET_TINT[o.key]
            return (
              // a swipe ends in a click on whatever card the finger left —
              // ignore it, or the slide would immediately snap back
              <button key={o.key} onClick={() => { if (Math.abs(moved.current) < SWIPE_PX) onPick(o.key) }}
                className="relative shrink-0 w-full h-[168px] rounded-[16px] overflow-hidden text-left"
                style={{ background: tint.bg, boxShadow: '0 6px 18px rgba(10,40,90,.15)' }}>
                {o.photo
                  ? <SignedImage url={o.photo} alt="" className="w-full h-full object-cover" width={700} />
                  : <span className="w-full h-full grid place-items-center">
                      <Icon size={38} stroke={1.3} style={{ color: tint.fg, opacity: .85 }} />
                    </span>}
                <span className="absolute inset-0" style={{
                  background: 'linear-gradient(95deg,rgba(4,18,38,.9) 0%,rgba(4,18,38,.6) 44%,rgba(4,18,38,.06) 82%)',
                }} />
                <span className="absolute inset-0 p-4 flex flex-col justify-center">
                  <span className="block text-white text-[24px] font-extrabold leading-[1.15]"
                    style={{ letterSpacing: '-.5px' }}>{o.label}</span>
                </span>
                {/* dots live inside the card, like the Explore banner */}
                {options.length > 1 && (
                  <span className="absolute left-4 bottom-4 flex gap-1.5">
                    {options.map((d, n) => (
                      <span key={d.key} className="h-[5px] rounded-full transition-all duration-300"
                        style={{ width: n === i ? 16 : 5, background: n === i ? '#fff' : 'rgba(255,255,255,.45)' }} />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CityCard({ on, label, photo, onClick }: {
  on: boolean
  label: string
  photo?: string | null
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="relative shrink-0 w-24 rounded-[12px] overflow-hidden text-left bg-surface"
      style={{ border: `1.5px solid ${on ? 'var(--color-brand)' : 'var(--color-line)'}` }}>
      <div className="h-20">
        {photo
          ? <SignedImage url={photo} alt={label} className="w-full h-full object-cover" width={240}
              fallback={<div className="w-full h-full grid place-items-center bg-surface-2"><IconMapPin size={20} className="text-ink-3" /></div>} />
          : <div className="w-full h-full grid place-items-center bg-surface-2"><IconWorldSearch size={22} className="text-ink-3" /></div>}
      </div>
      <div className="px-2 py-1.5 text-[12px] font-medium truncate text-center">{label}</div>
    </button>
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
