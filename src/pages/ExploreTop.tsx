import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  IconArrowLeft, IconArrowRight, IconBuildingMonument, IconToolsKitchen2, IconCoffee,
  IconHeartPlus, IconHeartFilled, IconPencil,
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
import { loadCuratedPage, type CuratedPage } from '@/lib/countryPages'
import { useIsAdmin } from '@/lib/useIsAdmin'
import {
  buildTopLists, coverForKey, countryForKey, slugForCountry, MAX_PLACES, TOP_BUCKETS,
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
const NEUTRAL_TINT = { bg: '#EAF1FB', fg: '#185FA5' }

/** how many cards a rail shows before "ดูทั้งหมด" takes over */
const RAIL_MAX = 10

/** One card in the carousel, whether an admin made it or the ranking did. */
interface Card {
  id: string
  /** drawn over the photo; blank when the artwork already carries its lettering */
  label: string
  photo: string | null
  tint: { bg: string; fg: string }
  icon: typeof IconBuildingMonument
  /** the places it opens on this page — empty when it jumps to Explore instead */
  places: ExplorePlace[]
  /** set when tapping should leave for Explore with a filter applied */
  jump: { group: string | null; cat: string | null; city: string | null } | null
}

/**
 * A country's home page, opened from the Explore banner.
 *
 * Two sources, one layout. When an admin has laid the country out (see
 * supabase/admin_pages.sql and /admin) the cover, the cards and the places in
 * them are theirs — nothing here is ranked or computed. A country nobody has
 * touched keeps the automatic page, so no country is ever blank.
 */
export default function ExploreTop() {
  const { key = '' } = useParams()
  const navigate = useNavigate()
  const goBack = useBack('/explore')
  const { user } = useAuth()
  const { trips } = useTrip()
  const isAdmin = useIsAdmin()

  const [lists, setLists] = useState<TopList[] | null>(null)
  const [ratings, setRatings] = useState<Map<string, RatingStat>>(new Map())
  const [curated, setCurated] = useState<CuratedPage | null>(null)
  const [cardIdx, setCardIdx] = useState(0)
  const [opened, setOpened] = useState(false)
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set())
  const [fav, setFav] = useState<Place | null>(null)
  const [saveAll, setSaveAll] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

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
  const country = list?.country ?? countryForKey(key) ?? ''

  // the curated page needs the country name, which the url gives us for every
  // country the app knows — the rest resolve once the pool has loaded
  useEffect(() => {
    if (!country) return
    let off = false
    void loadCuratedPage(country).then((c) => { if (!off) setCurated(c) })
    return () => { off = true }
  }, [country])

  const photo = curated?.page.cover_url ?? list?.photo ?? coverForKey(key)
  useEffect(() => tintChromeFromPhoto(photo, window.innerWidth / 340), [photo])

  const cities = list?.cities ?? []
  const recent = list?.recent ?? []
  const byId = useMemo(() => new Map((list?.recent ?? []).map((p) => [p.id, p])), [list])

  /** the carousel: the admin's blocks when there are any, else the ranking */
  const cards: Card[] = useMemo(() => {
    const blocks = curated?.blocks ?? []
    if (blocks.length) {
      return blocks.map((b) => ({
        id: b.id,
        label: b.title,
        photo: b.image_url,
        tint: NEUTRAL_TINT,
        icon: IconBuildingMonument,
        places: b.placeIds.map((id) => byId.get(id)).filter((p): p is ExplorePlace => !!p),
        jump: b.action === 'explore'
          ? { group: b.filter_group, cat: b.filter_cat, city: b.filter_city }
          : null,
      }))
    }
    const all = list?.entries ?? []
    return TOP_BUCKETS
      .map((b) => {
        const mine = all.filter((e) => e.bucket === b.key)
        const art = FILTER_CARD_ART[`${key}:${b.key}`] ?? null
        return {
          id: b.key,
          label: art ? '' : b.label,
          photo: art ?? mine.find((e) => e.place.photo_url)?.place.photo_url ?? null,
          tint: BUCKET_TINT[b.key],
          icon: BUCKET_ICON[b.key],
          places: mine.slice(0, MAX_PLACES).map((e) => e.place),
          jump: null,
        }
      })
      .filter((c) => c.places.length > 0)
  }, [curated, list, byId, key])

  useEffect(() => { setCardIdx((n) => (n < cards.length ? n : 0)) }, [cards.length])
  const card = cards[Math.min(cardIdx, cards.length - 1)] ?? null
  const top = card?.places ?? []
  const allSaved = top.length > 0 && top.every((p) => savedSet.has(p.id))

  // it opens below the rails, off-screen — take the reader there. Only on the
  // way open: swiping to another card while it's already open shouldn't yank
  // the page away from the card you're swiping.
  useEffect(() => {
    if (opened) gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [opened])

  const open = (id: string) => navigate(`/explore/p/${id}`)
  const browse = (filter: { country: string; city?: string; group?: string; cat?: string }) =>
    navigate('/explore', {
      state: {
        filter: {
          country: filter.country,
          city: filter.city ?? 'all',
          group: filter.group ?? 'all',
          cat: filter.cat ?? 'all',
          sort: 'new',
        },
      },
    })

  function tapCard() {
    if (!card) return
    if (card.jump) {
      browse({ country, city: card.jump.city ?? undefined, group: card.jump.group ?? undefined, cat: card.jump.cat ?? undefined })
      return
    }
    setOpened((o) => !o)
  }

  if (lists && !list && !curated) {
    return (
      <div className="min-h-dvh bg-canvas">
        <div className="max-w-[640px] mx-auto px-4 py-6">
          <button onClick={goBack} className="btn-icon !border-0 mb-4"><IconArrowLeft size={18} /></button>
          <div className="card p-8 text-center text-[13px] text-ink-3">ไม่พบรายการนี้แล้ว</div>
        </div>
      </div>
    )
  }

  const showRecent = curated?.page.show_recent ?? true
  const showCities = (curated?.page.show_cities ?? true) && cities.length > 1

  return (
    <div className="min-h-dvh bg-canvas relative">
      <div className="relative max-w-[640px] mx-auto">
        <TopHero
          photo={photo}
          eyebrow={curated?.page.eyebrow
            ?? <>{list?.flag ?? '🌍'} {cities.length > 1 ? `${cities.length} เมือง` : cities[0]?.name ?? ''}</>}
          title={curated?.page.title || topTitle(country)}
          onBack={goBack}
          right={isAdmin ? (
            <button onClick={() => navigate(`/admin/${slugForCountry(country) || key}`)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-white text-[12px] font-bold"
              style={{ background: 'rgba(0,0,0,.28)', backdropFilter: 'blur(8px)' }}>
              <IconPencil size={15} /> จัดหน้านี้
            </button>
          ) : undefined}
          bottom={cards.length > 0 ? (
            <div className="pt-4 pb-3">
              <CardSlider cards={cards} index={cardIdx} onPick={setCardIdx} onOpen={tapCard} />
            </div>
          ) : undefined}
        />

        <div className="relative pt-4 pb-10 space-y-7">
          {!lists ? (
            <div className="py-14 text-center text-[13px] text-ink-3">กำลังโหลด…</div>
          ) : (
            <>
              {showRecent && (
                <Rail title="เพิ่งเพิ่มล่าสุด"
                  onAll={() => browse({ country })}
                  items={recent.slice(0, RAIL_MAX)} ratings={ratings}
                  sub={(p) => p.city} onOpen={open} />
              )}

              {showCities && cities.map((c) => {
                const mine = recent.filter((p) => (p.city ?? '').trim() === c.name)
                if (!mine.length) return null
                return (
                  <Rail key={c.name} title={c.name}
                    onAll={() => browse({ country, city: c.name })}
                    items={mine.slice(0, RAIL_MAX)} ratings={ratings}
                    sub={(p) => p.routes?.[0]?.station ?? p.station_name} onOpen={open} />
                )
              })}

              {/* the card's list, at the foot of the page — the rails are what
                  the country home is for; this is what you asked to see */}
              {opened && card && top.length > 0 && (
                <section ref={gridRef} style={{ scrollMarginTop: 12 }}>
                  <div className="flex items-end gap-2 px-4 sm:px-6 mb-2.5">
                    <h2 className="text-[17px] font-extrabold leading-none" style={{ letterSpacing: '-.3px' }}>
                      {card.label || 'รายการแนะนำ'}
                    </h2>
                    <button onClick={() => setSaveAll(true)}
                      className="ml-auto inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-bold"
                      style={allSaved
                        ? { background: 'var(--color-brand)', color: '#fff', border: '1.5px solid var(--color-brand)' }
                        : { color: 'var(--color-brand)', border: '1.5px solid var(--color-brand)' }}>
                      {allSaved ? <><IconHeartFilled size={13} /> เซฟแล้ว</> : <><IconHeartPlus size={13} /> เซฟทั้งหมด</>}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 px-4 sm:px-6">
                    {top.map((p, n) => (
                      <PlaceTile key={p.id} place={p} rating={ratings.get(p.id) ?? null} rank={n + 1}
                        saved={savedSet.has(p.id)} onOpen={() => open(p.id)}
                        onSave={() => setFav(exploreAsPlace(p))} />
                    ))}
                  </div>
                </section>
              )}
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
function Rail({ title, items, ratings, sub, onAll, onOpen }: {
  title: string
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
 * The card carousel, worked exactly like the Explore banner — the card stays
 * put and its photo cross-fades, rather than a track sliding sideways, which is
 * what made mid-swipe look like two half cards. No auto-advance.
 *
 * Swipe or tap a dot to change card; tapping the card opens it.
 */
function CardSlider({ cards, index: i, onPick, onOpen }: {
  cards: Card[]
  index: number
  onPick: (n: number) => void
  onOpen: () => void
}) {
  const startX = useRef<number | null>(null)
  const moved = useRef(0)
  const cur = cards[Math.min(i, cards.length - 1)]
  const go = (d: number) => onPick((i + d + cards.length) % cards.length)
  if (!cur) return null

  return (
    <div
      onPointerDown={(e) => { startX.current = e.clientX; moved.current = 0 }}
      onPointerMove={(e) => { if (startX.current != null) moved.current = e.clientX - startX.current }}
      onPointerUp={() => {
        if (Math.abs(moved.current) >= SWIPE_PX) go(moved.current < 0 ? 1 : -1)
        else if (startX.current != null) onOpen()
        startX.current = null
      }}
      onPointerCancel={() => { startX.current = null }}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen() }}
      className="relative mx-4 sm:mx-6 h-[168px] rounded-[16px] overflow-hidden cursor-pointer select-none touch-pan-y"
      style={{ background: cur.tint.bg, boxShadow: '0 6px 18px rgba(10,40,90,.15)' }}>

      {/* the wash and the label live INSIDE each layer so they cross-fade with
          the photo — a card whose artwork already carries its lettering just
          leaves the title blank and gets neither */}
      {cards.map((c, n) => {
        const Icon = c.icon
        return (
          <div key={c.id} className="absolute inset-0 transition-opacity duration-500"
            style={{ opacity: n === i ? 1 : 0 }}>
            {c.photo
              ? <SignedImage url={c.photo} alt={c.label} className="w-full h-full object-cover" width={900} />
              : <span className="w-full h-full grid place-items-center" style={{ background: c.tint.bg }}>
                  <Icon size={38} stroke={1.3} style={{ color: c.tint.fg, opacity: .85 }} />
                </span>}
            {!!c.label && (
              <>
                <span className="absolute inset-0" style={{
                  background: 'linear-gradient(95deg,rgba(4,18,38,.9) 0%,rgba(4,18,38,.6) 44%,rgba(4,18,38,.06) 82%)',
                }} />
                <span className="absolute inset-0 p-4 flex flex-col justify-center">
                  <span className="block text-white text-[24px] font-extrabold leading-[1.15]"
                    style={{ letterSpacing: '-.5px' }}>{c.label}</span>
                </span>
              </>
            )}
          </div>
        )
      })}

      {cards.length > 1 && (
        <div className="absolute left-4 bottom-4 flex gap-1.5">
          {cards.map((c, n) => (
            // padded out to a real tap target; the negative margin keeps the
            // row looking like the 5px dots it draws
            <button key={c.id} aria-label={c.label || `การ์ดที่ ${n + 1}`} className="p-1.5 -m-1.5"
              onClick={(ev) => { ev.stopPropagation(); onPick(n) }}
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
