import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  IconArrowLeft, IconHeart, IconHeartFilled, IconMapPin,
  IconSend, IconTrash, IconLoader2, IconArrowBackUp,
  IconBuildingStore, IconToolsKitchen2, IconFileTypePdf, IconPhoto, IconMessageReport,
  IconCheck, IconX, IconInfoCircle, IconLocation,
} from '@tabler/icons-react'
import { PhotoCarousel } from '@/components/PhotoCarousel'
import { Lightbox, type PhotoRef } from '@/components/Lightbox'
import { Avatar } from '@/components/Avatar'
import { StarRating } from '@/components/StarRating'
import { ExploreReviewPanel } from '@/components/ExploreReviewPanel'
import { BranchPicker } from '@/components/BranchPicker'
import { SaveToTripDialog } from '@/components/SaveToTripDialog'
import { ExploreSuggestDialog } from '@/components/ExploreSuggestDialog'
import { SUG_META, sugSummary, timeAgo, NearbyCard } from '@/components/ExploreDetail'
import { catMeta } from '@/lib/placeMeta'
import { modeMeta } from '@/lib/transitModes'
import { stationCode, lineColorFor } from '@/lib/metro/suggest'
import { tintChromeFromPhoto } from '@/lib/photoTint'
import { openMap } from '@/lib/maps'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import {
  listComments, addComment, deleteComment,
  listSuggestions, resolveSuggestion, suggestionToInput, updateExplore,
  exploreAsPlace, logExploreEvent,
} from '@/lib/exploreMutations'
import { getReviews, emptyStat, type ReviewData } from '@/lib/exploreReviews'
import { savedExploreIds, removeExploreCopiesDeep } from '@/lib/placeMutations'
import { confirmDialog } from '@/lib/confirm'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import type { ExplorePlace, ExploreComment, ExploreSuggestion, Place } from '@/lib/database.types'

type Tab = 'info' | 'nearby' | 'reviews'

/** Pull a station code like "R05" / "BL12" / "A-1" out of a free-typed station
 *  label ("R05 Xinyi Anhe", "Xinyi Anhe (R05)", …). Returns the code and the
 *  label with the code removed. */
function splitStationCode(station: string | null | undefined): { code: string | null; name: string } {
  const s = (station ?? '').trim()
  const m = s.match(/(?:^|[\s(（])([A-Z]{1,3}[- ]?\d{1,3})(?=[)）\s]|$)/)
  if (!m) return { code: null, name: s }
  const name = s.replace(m[1], ' ').replace(/[()（）]/g, ' ').replace(/\s+/g, ' ').trim()
  return { code: m[1].replace(/[- ]/, ''), name }
}

export default function ExplorePlaceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { profile, trips, trip: currentTrip, reload: reloadTrip } = useTrip()

  const [e, setE] = useState<ExplorePlace | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('info')
  const [branchIdx, setBranchIdx] = useState<number | null>(null)
  const [lightbox, setLightbox] = useState<number | null>(null)

  const [comments, setComments] = useState<ExploreComment[]>([])
  const [reviews, setReviews] = useState<ReviewData>({ rows: [], stat: emptyStat(), mine: null })
  const [suggestions, setSuggestions] = useState<ExploreSuggestion[]>([])
  const [busySug, setBusySug] = useState<string | null>(null)
  const [nearby, setNearby] = useState<ExplorePlace[]>([])
  const [nearbyByStation, setNearbyByStation] = useState(false)

  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  const [fav, setFav] = useState<Place | null>(null)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  const myTripIds = useMemo(() => trips.filter((t) => t.owner_id === user?.id).map((t) => t.id), [trips, user?.id])
  const isOwner = !!user && !!e && e.created_by === user.id

  async function refreshSaved() {
    if (!id) return
    setSaved((await savedExploreIds(myTripIds)).has(id))
  }

  // load the item + count a view
  useEffect(() => {
    if (!id) return
    setLoading(true); setE(null); setTab('info')
    supabase.from('explore_places').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      setE((data as ExplorePlace) ?? null)
      setLoading(false)
    })
    if (user) logExploreEvent(id, user.id, 'view')
    window.scrollTo(0, 0)
  }, [id, user?.id])

  useEffect(() => { refreshSaved() }, [id, myTripIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  // paint the status-bar zone (and pull-down overscroll) the colour of the
  // photo's top edge so the image looks like it runs to the very top
  useEffect(() => tintChromeFromPhoto(e?.photo_url), [e?.photo_url])

  const hasOwnLocation = !!(e && (e.map_url || e.station_name || e.station_line))
  useEffect(() => { setBranchIdx(e?.branches?.length && !hasOwnLocation ? 0 : null) }, [e?.id, hasOwnLocation, e?.branches?.length])

  async function refresh() {
    if (!e) return
    const [cRes, r] = await Promise.all([listComments(e.id), getReviews(e.id, user?.id)])
    setComments((cRes.data ?? []) as ExploreComment[])
    setReviews(r)
    if (isOwner) setSuggestions(await listSuggestions(e.id))
  }
  /** only the star data — used after rating so the whole page doesn't re-fetch */
  async function refreshReviews() { if (e) setReviews(await getReviews(e.id, user?.id)) }
  useEffect(() => { if (e) refresh() }, [e?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // nearby — same station in the same city first, else the whole city
  useEffect(() => {
    setNearby([]); setNearbyByStation(false)
    if (!e?.city?.trim()) return
    let active = true
    const norm = (x?: string | null) => (x ?? '').trim().toLowerCase()
    const mine = norm(e.station_name)
    supabase.from('explore_places').select('*').eq('city', e.city).neq('id', e.id)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => {
        if (!active) return
        const rows = (data ?? []) as ExplorePlace[]
        if (mine) { setNearby(rows.filter((pl) => norm(pl.station_name) === mine)); setNearbyByStation(true) }
        else { setNearby(rows); setNearbyByStation(false) }
      })
    return () => { active = false }
  }, [e?.id, e?.city])

  async function send(body: string, parentId?: string | null) {
    if (!e || !user || !body.trim()) return
    setSending(true)
    const name = profile?.nickname ?? user.email?.split('@')[0] ?? 'ผู้ใช้'
    await addComment(e.id, user.id, body.trim(), name, profile?.avatar_color ?? null, parentId ?? null, profile?.avatar_url ?? null, profile?.avatar_focus ?? null)
    setText(''); setReplyText(''); setReplyTo(null); setSending(false)
    refresh()
  }
  async function removeComment(cid: string) { await deleteComment(cid); refresh() }

  async function applySug(s: ExploreSuggestion) {
    if (!e) return
    setBusySug(s.id)
    const input = suggestionToInput(e, s)
    if (input) await updateExplore(e.id, input)
    await resolveSuggestion(s.id, 'accepted')
    const { data } = await supabase.from('explore_places').select('*').eq('id', e.id).maybeSingle()
    if (data) setE(data as ExplorePlace)
    setSuggestions((xs) => xs.filter((x) => x.id !== s.id))
    setBusySug(null)
    toast.success(input ? 'นำไปใช้แล้ว — อัปเดตให้เรียบร้อย' : 'รับเรื่องแล้ว')
  }
  async function dismissSug(s: ExploreSuggestion) {
    setBusySug(s.id); await resolveSuggestion(s.id, 'dismissed')
    setSuggestions((xs) => xs.filter((x) => x.id !== s.id)); setBusySug(null)
  }

  async function toggleSave() {
    if (!e) return
    if (saved) {
      if (!(await confirmDialog({ message: `เอา "${e.name}" ออกจากทริปที่เซฟไว้? ถ้ามีจุดแวะของที่นี่ใน Itinerary จะถูกลบไปด้วย`, danger: true, confirmLabel: 'เอาออก' }))) return
      const { stopsRemoved } = await removeExploreCopiesDeep(e.id, myTripIds)
      await refreshSaved()
      if (currentTrip && myTripIds.includes(currentTrip.id)) void reloadTrip()
      toast.success(stopsRemoved > 0 ? `เอาออกแล้ว · ลบจุดแวะใน Itinerary ${stopsRemoved} จุดด้วย` : 'เอาออกจากทริปแล้ว')
    } else {
      setFav(exploreAsPlace(e))
    }
  }

  // comment threading
  const cids = new Set(comments.map((c) => c.id))
  const childrenOf = (parentId: string | null) => comments.filter((c) => {
    const p = c.parent_id && cids.has(c.parent_id) ? c.parent_id : null
    return p === parentId
  })
  function renderThread(parentId: string | null, depth: number): ReactNode {
    return childrenOf(parentId).map((c) => (
      <div key={c.id} className={depth > 0 ? 'pl-7' : ''}>
        <div className="flex items-start gap-2">
          <Avatar name={c.author_name} color={c.author_color} photo={c.author_photo} photoFocus={c.author_focus} size={depth > 0 ? 26 : 30} ring={false} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-medium truncate">{c.author_name ?? 'ผู้ใช้'}</span>
              <span className="text-[11px] text-ink-3 shrink-0">· {timeAgo(c.created_at)}</span>
              {c.user_id === user?.id && (
                <button onClick={() => removeComment(c.id)} aria-label="ลบความคิดเห็น" className="ml-auto text-ink-3 hover:text-booking shrink-0"><IconTrash size={13} /></button>
              )}
            </div>
            <p className="text-[13px] text-ink whitespace-pre-wrap break-words">{c.body}</p>
            {user && (
              <button onClick={() => { setReplyTo((cur) => (cur === c.id ? null : c.id)); setReplyText('') }} className="inline-flex items-center gap-1 text-[11px] text-brand-mid mt-1">
                <IconArrowBackUp size={12} /> ตอบกลับ
              </button>
            )}
            {replyTo === c.id && (
              <div className="flex items-start gap-2 mt-2">
                <Avatar name={profile?.nickname ?? user?.email} color={profile?.avatar_color} photo={profile?.avatar_url} photoFocus={profile?.avatar_focus} size={26} ring={false} />
                <div className="flex-1 min-w-0">
                  <textarea value={replyText} onChange={(ev) => setReplyText(ev.target.value)} rows={2} autoFocus placeholder={`ตอบกลับ ${c.author_name ?? ''}…`}
                    className="w-full resize-none rounded-[10px] bg-surface-2 px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-brand" />
                  <div className="flex justify-end gap-2 mt-1.5">
                    <button onClick={() => { setReplyTo(null); setReplyText('') }} className="h-8 px-3 rounded-full text-[12px] font-medium text-ink-2">ยกเลิก</button>
                    <button onClick={() => send(replyText, c.id)} disabled={sending || !replyText.trim()} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-brand text-white text-[12px] font-medium disabled:opacity-40">
                      {sending ? <IconLoader2 size={14} className="animate-spin" /> : <IconSend size={14} />} ตอบกลับ
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {childrenOf(c.id).length > 0 && <div className="mt-3 space-y-3">{renderThread(c.id, depth + 1)}</div>}
      </div>
    ))
  }

  if (loading) return <div className="min-h-dvh grid place-items-center bg-canvas text-ink-3 text-[13px]"><IconLoader2 className="animate-spin" /></div>
  if (!e) return (
    <div className="min-h-dvh grid place-items-center bg-canvas px-6 text-center">
      <div>
        <div className="text-[15px] font-medium">ไม่พบสถานที่นี้</div>
        <button onClick={() => navigate('/explore')} className="btn-link text-[13px] mt-3">← กลับไป Explore</button>
      </div>
    </div>
  )

  const meta = catMeta(e.category)
  const Icon = meta.icon
  const branches = e.branches ?? []
  const sel = branchIdx != null ? branches[branchIdx] : null
  const mapUrl = sel?.map_url || e.map_url
  const gallery: PhotoRef[] = [...(e.photo_url ? [{ url: e.photo_url }] : []), ...(e.photos ?? []).map((ref) => ({ url: ref }))]
  const extraBase = e.photo_url ? 1 : 0
  const routeList = sel
    ? [{ line: sel.line, color: sel.color, station: sel.station }]
    : (e.routes && e.routes.length) ? e.routes
      : (e.station_line || e.station_name) ? [{ line: e.station_line, color: e.station_color, station: e.station_name }] : []
  // the REAL average — what people gave in explore_ratings, not a like ratio
  const rating = reviews.stat.avg
  const rated = reviews.stat.count
  const multiBranch = e.multi_branch || !!e.branches?.length

  const TABS: { key: Tab; label: string; n?: number }[] = [
    { key: 'info', label: 'ข้อมูล' },
    { key: 'nearby', label: 'ใกล้เคียง', n: nearby.length || undefined },
    { key: 'reviews', label: 'รีวิว', n: rated || comments.length || undefined },
  ]

  return (
    <div className="min-h-dvh bg-canvas pb-[calc(env(safe-area-inset-bottom)+80px)]">

      {/* ── immersive hero cover — full-bleed to the very top, dissolving into
          the tab bar below (which sits over the fading image) ── */}
      <div className="relative h-[600px] bg-surface-2">
        {gallery.length > 0
          ? <PhotoCarousel photos={gallery} alt={e.name ?? ''} width={900} focus={e.photo_focus} priority indicator="count" onExpand={(i) => setLightbox(i)}
              fallback={<div className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><Icon size={64} stroke={1.4} style={{ color: meta.fg, opacity: .85 }} /></div>} />
          : <div className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><Icon size={64} stroke={1.4} style={{ color: meta.fg, opacity: .85 }} /></div>}
        {/* smooth bottom-up darkening (no hard band) behind the text, dissolving
            into the canvas before the tab zone */}
        {/* px stops anchored to the BOTTOM edge — the darken/blur zone hugs the
            text block no matter how tall the hero is, so growing the hero only
            adds clear photo at the top */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, var(--color-canvas) 18px, rgba(6,20,40,.55) 110px, rgba(6,20,40,.36) 212px, rgba(6,20,40,.13) 313px, transparent 424px)' }} />
        {/* blur the whole lower section (behind the stats + tabs) so the photo
            dissolves softly; text painted on top stays sharp */}
        <div className="absolute inset-x-0 bottom-0 h-[190px] pointer-events-none"
          style={{ backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, #000 52%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 52%)' }} />
        <button onClick={() => navigate(-1)} aria-label="กลับ"
          className="absolute z-10 size-10 rounded-full grid place-items-center text-white shadow-md"
          style={{ top: 'calc(env(safe-area-inset-top,0px) + 10px)', left: 12, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '0.5px solid rgba(255,255,255,.3)' }}>
          <IconArrowLeft size={20} />
        </button>
        {/* overlaid identity + 3-stat strip — sits just above the tab bar */}
        <div className="absolute left-4 right-4 bottom-[100px] text-white pointer-events-none">
          {e.country && (
            <span className="inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: '#fff', color: 'var(--color-brand-dark)' }}>{e.country}</span>
          )}
          <h1 className="text-[25px] font-extrabold leading-tight mt-2" style={{ textShadow: '0 1px 10px rgba(0,0,0,.45)' }}>{e.name}</h1>
          {routeList[0] && (() => {
            const m0 = modeMeta('mode' in routeList[0] ? (routeList[0].mode as string | undefined) : undefined)
            const M0 = m0.icon
            const code0 = stationCode(routeList[0].line, routeList[0].station) ?? splitStationCode(routeList[0].station).code
            return (
              <div className="flex items-center gap-1.5 text-[12px] font-medium mt-1.5 opacity-95 min-w-0">
                <M0 size={14} className="shrink-0" />
                {code0 && <span className="font-extrabold shrink-0">{code0}</span>}
                <span className="truncate">{[routeList[0].line, routeList[0].station].filter(Boolean).join(' · ')}</span>
              </div>
            )
          })()}
          <div className="flex items-stretch mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,.28)' }}>
            <div className="flex-1 flex items-center min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-1 leading-none">
                  <StarRating rating={rating} size={13} empty={rated === 0} />
                  {rated > 0 && <span className="text-[12px] font-bold">{rating.toFixed(1)}</span>}
                </div>
                <div className="text-[9.5px] mt-1.5 text-white/75">{rated > 0 ? `คะแนน · ${rated} คน` : 'ยังไม่มีคะแนน'}</div>
              </div>
            </div>
            <div className="flex-1 flex items-center min-w-0">
              <span className="w-px h-6 mr-3 shrink-0" style={{ background: 'rgba(255,255,255,.28)' }} />
              <div className="min-w-0">
                <div className="text-[15px] font-extrabold leading-none truncate">{e.city || '—'}</div>
                <div className="text-[9.5px] mt-1 text-white/75">เมือง</div>
              </div>
            </div>
            <div className="flex-1 flex items-center min-w-0">
              <span className="w-px h-6 mr-3 shrink-0" style={{ background: 'rgba(255,255,255,.28)' }} />
              <div className="min-w-0">
                <span className="inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold truncate max-w-full" style={{ background: '#fff', color: meta.fg }}>{meta.label}</span>
                <div className="text-[9.5px] mt-1 text-white/75">หมวด</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── tabs — glassmorphism over the hero's dissolved bottom, sticky once
          you scroll ── */}
      <div className="sticky top-0 z-20 flex px-2 -mt-24 backdrop-blur-xl"
        style={{ backgroundColor: 'color-mix(in srgb, var(--color-canvas) 55%, transparent)', borderBottom: '0.5px solid color-mix(in srgb, var(--color-line) 60%, transparent)', boxShadow: '0 1px 0 rgba(255,255,255,.35) inset' }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex-1 relative py-3 text-[13px] font-semibold transition-colors"
            style={{ color: tab === t.key ? 'var(--color-brand)' : 'var(--color-ink-3)' }}>
            {t.label}{t.n ? <span className="text-[10px] align-super ml-0.5">{t.n}</span> : ''}
            {tab === t.key && <span className="absolute left-1/4 right-1/4 bottom-0 h-[2.5px] rounded-full bg-brand" />}
          </button>
        ))}
      </div>

      <main className="relative z-10 max-w-[600px] mx-auto px-4 sm:px-6 pt-6 pb-4">
        {/* the blurred hero photo shows through the top of <main>; this backdrop
            fades IN (transparent → canvas) instead of a hard edge, so the grey
            blurred photo dissolves smoothly into the page background with no
            visible seam, then stays solid canvas behind every card below */}
        <div className="absolute inset-x-0 top-0 bottom-0 -z-10"
          style={{ background: 'linear-gradient(to bottom, transparent 0, var(--color-canvas) 68px)' }} />
        {/* ══ INFO ══ */}
        {tab === 'info' && (
          <div className="space-y-4">
            <BranchPicker branches={branches} value={branchIdx} onChange={setBranchIdx} hasOwnLocation={hasOwnLocation} ownLabel={e.branch_label} />

            {/* location & routes */}
            <div className="card p-3.5">
              <div className="text-[12px] font-semibold text-ink-2 mb-2.5 flex items-center gap-1.5">
                <IconLocation size={14} className="text-brand" /> การเดินทาง
                {multiBranch && <span className="chip !py-0.5 !text-[10.5px] !bg-brand-soft !text-brand-dark inline-flex items-center gap-1 ml-auto"><IconBuildingStore size={11} /> หลายสาขา</span>}
              </div>
              <div className="space-y-2.5">
                {routeList.map((r, i) => {
                  const m = modeMeta('mode' in r ? (r.mode as string | undefined) : undefined)
                  const MIcon = m.icon
                  // official per-line code from the built-in networks (Taipei
                  // etc.) first; a code typed into the station label as fallback
                  const parsed = splitStationCode(r.station)
                  const code = stationCode(r.line, r.station) ?? parsed.code
                  const stationName = parsed.name
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="size-9 rounded-full grid place-items-center shrink-0 text-white" style={{ background: lineColorFor(r.line) ?? r.color ?? '#888780' }}><MIcon size={17} /></span>
                      <div className="min-w-0">
                        {/* station: big line-coloured code + bold dark name */}
                        {(code || stationName) && (
                          <div className="flex items-baseline gap-1.5 min-w-0">
                            {code && <span className="text-[20px] font-extrabold leading-none tracking-wide shrink-0" style={{ color: lineColorFor(r.line) ?? r.color ?? 'var(--color-ink)' }}>{code}</span>}
                            {stationName && <span className="text-[16px] font-bold text-ink truncate">{stationName}</span>}
                          </div>
                        )}
                        {/* line name — small, grey, below */}
                        <div className="text-[11.5px] text-ink-3 truncate mt-0.5">{r.line || m.label}</div>
                      </div>
                    </div>
                  )
                })}
                {routeList.length === 0 && <div className="text-[12px] text-ink-3">ยังไม่มีข้อมูลการเดินทาง</div>}
              </div>
              {sel && mapUrl && (
                <div className="text-[11px] text-ink-3 mt-2.5">แตะ "แผนที่" ด้านล่างเพื่อเปิดสาขา {sel.label || `สาขา ${branchIdx! + 1}`}</div>
              )}
            </div>

            {e.note && (
              <div className="card p-3.5">
                <div className="text-[12px] font-semibold text-ink-2 mb-1.5 flex items-center gap-1.5"><IconInfoCircle size={14} className="text-brand" /> โน้ต</div>
                <p className="text-[13px] text-ink-2 whitespace-pre-wrap">{e.note}</p>
              </div>
            )}

            {!!e.photos?.length && (
              <div>
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2 mb-2"><IconPhoto size={14} className="text-brand" /> รูปภาพ ({e.photos.length + (e.photo_url ? 1 : 0)})</div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {e.photos.map((ref, i) => (
                    <button key={ref} onClick={() => setLightbox(extraBase + i)} className="shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-surface-2 hairline">
                      <img src={ref} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!!e.menu_paths?.length && (
              <div>
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2 mb-2"><IconToolsKitchen2 size={14} className="text-brand" /> เมนู ({e.menu_paths.length})</div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {e.menu_paths.map((ref) => (
                    <button key={ref} onClick={() => window.open(ref, '_blank')} className="shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-surface-2 hairline grid place-items-center">
                      {/\.pdf($|\?)/i.test(ref) ? <span className="flex flex-col items-center gap-1 text-ink-3"><IconFileTypePdf size={26} /><span className="text-[10px]">PDF</span></span> : <img src={ref} alt="" className="w-full h-full object-cover" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* owner: review suggestions */}
            {isOwner && suggestions.length > 0 && (
              <div>
                <div className="text-[13px] font-semibold mb-2 flex items-center gap-1.5"><IconMessageReport size={15} className="text-brand" /> ข้อเสนอแก้ไข ({suggestions.length})</div>
                <div className="space-y-2">
                  {suggestions.map((s) => {
                    const M = SUG_META[s.kind]; const SIcon = M.icon; const busy = busySug === s.id
                    return (
                      <div key={s.id} className="card p-3" style={{ border: '0.5px solid var(--color-brand-border)' }}>
                        <div className="flex items-center gap-2">
                          <Avatar name={s.author_name} color={s.author_color} photo={s.author_photo} photoFocus={s.author_focus} size={24} ring={false} />
                          <span className="text-[12px] font-medium truncate flex-1">{s.author_name ?? 'ใครบางคน'}</span>
                          <span className="chip !py-0.5 !text-[10.5px] shrink-0"><SIcon size={11} /> {M.label}</span>
                        </div>
                        <div className="text-[12.5px] text-ink mt-1.5">{sugSummary(s)}</div>
                        {s.note && <div className="text-[12px] text-ink-3 mt-0.5 whitespace-pre-wrap">“{s.note}”</div>}
                        <div className="flex gap-2 mt-2.5">
                          {s.kind !== 'report' && (
                            <button onClick={() => applySug(s)} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-1 h-9 rounded-[9px] text-[12.5px] font-medium disabled:opacity-50" style={{ background: 'var(--color-brand)', color: '#fff' }}>
                              {busy ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} />} นำไปใช้
                            </button>
                          )}
                          <button onClick={() => dismissSug(s)} disabled={busy} className={['inline-flex items-center justify-center gap-1 h-9 rounded-[9px] text-[12.5px] font-medium disabled:opacity-50', s.kind === 'report' ? 'flex-1' : ''].join(' ')}
                            style={{ background: 'var(--color-surface-2)', color: 'var(--color-ink-2)', paddingInline: s.kind === 'report' ? undefined : 14 }}>
                            <IconX size={14} /> {s.kind === 'report' ? 'รับทราบ / ปิด' : 'ปิด'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* non-owner: help edit / report */}
            {!isOwner && user && (
              <button onClick={() => setSuggestOpen(true)} className="w-full flex items-center justify-center gap-1.5 h-11 rounded-[10px] text-[12.5px] font-medium" style={{ background: 'var(--color-surface-2)', color: 'var(--color-ink-2)' }}>
                <IconMessageReport size={15} /> เห็นข้อมูลไม่ตรง? ช่วยแก้ / รายงาน
              </button>
            )}
          </div>
        )}

        {/* ══ REVIEWS ══ */}
        {tab === 'reviews' && (
          <div>
            <ExploreReviewPanel e={e} data={reviews} onChanged={refreshReviews} />

            {/* ── discussion / comments (same topic as reviews) ── */}
            <div className="mt-7 pt-5" style={{ borderTop: '0.5px solid var(--color-line)' }}>
              <div className="text-[13px] font-semibold text-ink-2 mb-3">พูดคุย {comments.length > 0 && <span className="text-ink-3 font-normal">· {comments.length}</span>}</div>
              <div className="flex items-start gap-2 mb-4">
                <Avatar name={profile?.nickname ?? user?.email} color={profile?.avatar_color} photo={profile?.avatar_url} photoFocus={profile?.avatar_focus} size={30} ring={false} />
                <div className="flex-1 min-w-0">
                  <textarea value={text} onChange={(ev) => setText(ev.target.value)} rows={2} placeholder="เขียนความคิดเห็น…"
                    className="w-full resize-none rounded-[10px] bg-surface-2 px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-brand" />
                  <div className="flex justify-end mt-1.5">
                    <button onClick={() => send(text)} disabled={sending || !text.trim()} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-brand text-white text-[12px] font-medium disabled:opacity-40">
                      {sending ? <IconLoader2 size={14} className="animate-spin" /> : <IconSend size={14} />} ส่ง
                    </button>
                  </div>
                </div>
              </div>
              {comments.length === 0
                ? <div className="py-8 text-center text-[12px] text-ink-3">ยังไม่มีความคิดเห็น — มาเป็นคนแรกกัน</div>
                : <div className="space-y-3">{renderThread(null, 0)}</div>}
            </div>
          </div>
        )}

        {/* ══ NEARBY ══ */}
        {tab === 'nearby' && (
          nearby.length === 0
            ? <div className="py-16 text-center text-[13px] text-ink-3">ยังไม่มีสถานที่ใกล้เคียง{e.city ? ` ใน ${e.city}` : ''}</div>
            : (
              <div className="space-y-2">
                <div className="text-[12px] text-ink-3 mb-1">{nearbyByStation ? `สถานี ${e.station_name ?? ''}` : `ใน ${e.city}`} · {nearby.length} ที่</div>
                {nearby.map((p) => <NearbyCard key={p.id} p={p} onOpen={(pl) => navigate(`/explore/p/${pl.id}`)} />)}
              </div>
            )
        )}

      </main>

      {/* ── sticky bottom action bar ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 px-4 pt-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 12px)', background: 'linear-gradient(to top, var(--color-canvas) 72%, transparent)' }}>
        <div className="max-w-[600px] mx-auto flex gap-2.5">
          <button onClick={toggleSave} className="flex-[1.6] h-12 rounded-[14px] inline-flex items-center justify-center gap-2 text-[15px] font-bold shadow-lg"
            style={saved ? { background: 'var(--color-surface)', border: '0.5px solid var(--color-brand-border)', color: 'var(--color-brand)' } : { background: 'var(--color-brand)', color: '#fff', boxShadow: '0 6px 18px rgba(2,112,251,.3)' }}>
            {saved ? <><IconHeartFilled size={19} /> เซฟแล้ว</> : <><IconHeart size={19} /> เซฟเข้าทริป</>}
          </button>
          <button onClick={() => mapUrl && openMap(mapUrl)} disabled={!mapUrl}
            className="flex-1 h-12 rounded-[14px] inline-flex items-center justify-center gap-1.5 text-[14px] font-semibold disabled:opacity-40"
            style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-line)', color: 'var(--color-ink)' }}>
            <IconMapPin size={17} className="text-brand" /> แผนที่
          </button>
        </div>
      </div>

      {lightbox !== null && <Lightbox photos={gallery} index={lightbox} alt={e.name ?? ''} onClose={() => setLightbox(null)} />}
      <SaveToTripDialog place={fav} open={!!fav} sourceExploreId={fav?.id ?? undefined} onClose={() => setFav(null)} onChanged={refreshSaved} />
      <ExploreSuggestDialog place={e} open={suggestOpen} onClose={() => setSuggestOpen(false)} />
    </div>
  )
}
