import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconArrowLeft, IconHeartPlus, IconHeartFilled } from '@tabler/icons-react'
import { SaveToTripDialog } from '@/components/SaveToTripDialog'
import { SaveAllToTripDialog } from '@/components/SaveAllToTripDialog'
import { TopHero, PlaceTile, topTitle } from '@/components/exploreTopParts'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { listExplore, allPopularity, exploreAsPlace, type PopStat } from '@/lib/exploreMutations'
import { allRatingStats } from '@/lib/exploreReviews'
import { savedExploreIds } from '@/lib/placeMutations'
import {
  buildTopLists, coverForKey, countryForKey, slugify,
  type RatingStat, type TopList,
} from '@/lib/exploreTop'
import { tintChromeFromPhoto } from '@/lib/photoTint'
import { useBack } from '@/lib/useBack'
import type { ExplorePlace, Place } from '@/lib/database.types'

/**
 * One full list out of a country's home page: everything just added, or one
 * city. Unranked and uncapped — simply everything, newest first, because
 * "ดูทั้งหมด" said so. The ranked ten lives on the home page, under its card.
 */
export default function ExploreTopList() {
  const { key = '', city: citySlug } = useParams()
  const navigate = useNavigate()
  const goBack = useBack(`/explore/top/${key}`)
  const { user } = useAuth()
  const { trips } = useTrip()

  const [lists, setLists] = useState<TopList[] | null>(null)
  const [ratings, setRatings] = useState<Map<string, RatingStat>>(new Map())
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set())
  const [fav, setFav] = useState<Place | null>(null)
  const [saveAll, setSaveAll] = useState(false)

  const myTripIds = useMemo(() => trips.filter((t) => t.owner_id === user?.id).map((t) => t.id), [trips, user?.id])

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

  useEffect(() => { if (myTripIds.length) void refreshSaved() }, [myTripIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  async function refreshSaved() { setSavedSet(await savedExploreIds(myTripIds)) }

  const list = lists?.find((l) => l.key === key) ?? null
  const photo = list?.photo ?? coverForKey(key)
  const country = list?.country ?? countryForKey(key) ?? ''
  useEffect(() => tintChromeFromPhoto(photo, window.innerWidth / 340), [photo])

  const cityName = citySlug ? list?.cities.find((c) => slugify(c.name) === citySlug)?.name ?? null : null

  /** the places on this page — everything, newest first */
  const { shown, heading } = useMemo(() => {
    if (!list) return { shown: [] as ExplorePlace[], heading: '' }
    if (cityName) {
      return { shown: list.recent.filter((p) => (p.city ?? '').trim() === cityName), heading: cityName }
    }
    return { shown: list.recent, heading: 'เพิ่งเพิ่มล่าสุด' }
  }, [list, cityName])

  // every place on screen is already in one of my trips — the button flips to
  // the saved colour, and opening it offers to take them all back out
  const allSaved = shown.length > 0 && shown.every((p) => savedSet.has(p.id))

  if (lists && (!list || (citySlug && !cityName))) {
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
          eyebrow={<>{list?.flag ?? '🌍'} {topTitle(country)}</>}
          title={heading}
          onBack={goBack}
          right={shown.length > 0 ? (
            <button onClick={() => setSaveAll(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-white text-[12px] font-bold"
              style={allSaved
                ? { background: 'var(--color-brand)', boxShadow: '0 4px 14px rgba(2,112,251,.4)' }
                : { background: 'rgba(0,0,0,.28)', backdropFilter: 'blur(8px)' }}>
              {allSaved ? <><IconHeartFilled size={15} /> เซฟแล้ว</> : <><IconHeartPlus size={15} /> เซฟทั้งหมด</>}
            </button>
          ) : undefined}
        />

        <div className="relative px-4 sm:px-6 pt-3 pb-10">
          {!lists ? (
            <div className="py-14 text-center text-[13px] text-ink-3">กำลังโหลด…</div>
          ) : shown.length === 0 ? (
            <div className="card p-8 text-center text-[13px] text-ink-3">ยังไม่มีรายการ</div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {shown.map((p) => (
                <PlaceTile key={p.id} place={p} rating={ratings.get(p.id) ?? null}
                  saved={savedSet.has(p.id)}
                  onOpen={() => navigate(`/explore/p/${p.id}`)}
                  onSave={() => setFav(exploreAsPlace(p))} />
              ))}
            </div>
          )}
        </div>
      </div>

      <SaveToTripDialog place={fav} open={!!fav} sourceExploreId={fav?.id}
        onClose={() => setFav(null)} onChanged={refreshSaved} />
      <SaveAllToTripDialog items={shown} open={saveAll}
        onClose={() => setSaveAll(false)} onChanged={refreshSaved} />
    </div>
  )
}
