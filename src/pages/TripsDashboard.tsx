import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconPlus, IconPencil, IconTrash, IconCopy, IconDownload, IconCalendar, IconCrown, IconLoader2,
  IconUserCircle, IconArrowRight, IconLogout, IconHome, IconCompass, IconUser, IconShare2, IconClock,
} from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { confirmDialog } from '@/lib/confirm'
import { TaurusMark } from '@/components/TaurusMark'
import { TaurusLogo } from '@/components/TaurusLogo'
import { AvatarStack } from '@/components/Avatar'
import { PopMenu } from '@/components/PopMenu'
import { TripEditor } from '@/components/TripEditor'
import { ProfileEditor } from '@/components/ProfileEditor'
import { ShareDialog } from '@/components/ShareDialog'
import { formatDateRange, dayCount, tripCountdown } from '@/lib/format'
import { useWeather, tripCityCandidates } from '@/lib/weather'
import { WeatherBadge } from '@/components/WeatherBadge'
import { countryFlag } from '@/lib/countries'
import { tripFlag, tripActiveCity } from '@/lib/segments'
import { CITY_IMAGES, TRIP_COVER_IMAGES, tripCoverImage } from '@/lib/cityImages'
import { createTrip, updateTrip, deleteTrip, duplicateTrip } from '@/lib/tripMutations'
import { downloadItineraryPdf } from '@/lib/itineraryPdf'
import type { Trip } from '@/lib/database.types'

interface TravelerLite { id: string; trip_id: string; nickname: string | null }
const AV = ['av1', 'av2', 'av3', 'av4']

// Dark navy brand gradients for the card's left side. Picked deterministically
// from the trip so each card keeps a stable colour.
const HERO_GRADIENTS = [
  'linear-gradient(135deg,#0f3b7e,#040f28)',
  'linear-gradient(135deg,#123a72,#05152f)',
  'linear-gradient(135deg,#0c2f63,#03101f)',
  'linear-gradient(135deg,#143f80,#06182e)',
]
/** Hard cap the card title so a long name can never stretch the card — over
 *  15 chars gets clipped to "…" (the full name is on the title attribute). */
const clipName = (s?: string | null) => {
  const t = (s ?? '').trim()
  return t.length > 15 ? `${t.slice(0, 15)}…` : t
}
function heroGradient(t: Trip) {
  const s = t.id || t.name || ''
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return HERO_GRADIENTS[h % HERO_GRADIENTS.length]
}

// Cover photo for the card hero, reusing the curated city images (same source as
// the Explore city-filter cards). We know the trip's city, so match on it first;
// then fall back to country/name, and finally to a known city name appearing
// inside the trip name (e.g. "Hongkong 2026" → Hongkong).
const normCity = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase()
function coverImage(t: Trip): string | undefined {
  // multi-city: the card shows the city we're in right now
  const act = tripActiveCity(t)
  if (act) { const img = tripCoverImage(act); if (img) return img }
  for (const c of t.cities ?? []) { const img = tripCoverImage(c); if (img) return img }
  const direct = tripCoverImage(t.country ?? '') ?? tripCoverImage(t.name ?? '')
  if (direct) return direct
  const n = normCity(t.name ?? '')
  // fuzzy match on the trip name → known city. Longest key first so a short
  // city name can't shadow a more specific one it happens to be a substring of.
  const keys = [...new Set([...Object.keys(TRIP_COVER_IMAGES), ...Object.keys(CITY_IMAGES)])]
    .sort((a, b) => b.length - a.length)
  const hit = n ? keys.find((k) => n.includes(normCity(k))) : undefined
  return hit ? tripCoverImage(hit) : undefined
}

// Insert a Cloudinary transform right after `/image/upload/` (originals are
// multi-MB; we never want to ship those to a card).
function cld(url: string, transform: string): string {
  const m = '/image/upload/'
  const i = url.indexOf(m)
  return i < 0 ? url : url.slice(0, i + m.length) + transform + '/' + url.slice(i + m.length)
}

// Full-bleed cover photo (shifted right) with a blur-up placeholder: a tiny
// (~1KB) blurred copy shows instantly so the card never looks empty, then the
// sharp image fades in. A navy overlay over this dims the left side.
/** Weather chip for a trip card — today's if the trip is on, else the start day. */
function TripWeather({ trip, className }: { trip: Trip; className?: string }) {
  const today = new Date().toISOString().slice(0, 10)
  const date = trip.start_date
    ? (trip.end_date && today >= trip.start_date && today <= trip.end_date ? today : trip.start_date)
    : null
  const wx = useWeather(tripCityCandidates(trip), date ? [date] : [])
  if (!date) return null
  return <WeatherBadge wx={wx[date]} showMin={false} size={13} className={className} />
}

function CoverImage({ url }: { url?: string }) {
  const [loaded, setLoaded] = useState(false)
  const [broken, setBroken] = useState(false)
  if (!url || broken) return null
  const full = cld(url, 'f_auto,q_auto,w_560,c_limit')
  const tiny = cld(url, 'f_auto,q_auto:low,w_32,e_blur:1200')
  return (
    <>
      <div className="absolute inset-0 bg-cover bg-center scale-105"
        style={{ backgroundImage: `url(${tiny})`, filter: 'blur(2px)' }} />
      <img src={full} alt="" loading="eager" decoding="async"
        onLoad={() => setLoaded(true)} onError={() => setBroken(true)}
        className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`} />
    </>
  )
}

export default function TripsDashboard() {
  const { trips, loading, switchTrip, reload } = useTrip()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [travelers, setTravelers] = useState<TravelerLite[]>([])
  const [editor, setEditor] = useState<'new' | Trip | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')

  useEffect(() => {
    const ids = trips.map((t) => t.id)
    if (!ids.length) { setTravelers([]); return }
    supabase.from('travelers').select('id,trip_id,nickname').in('trip_id', ids)
      .then(({ data }) => setTravelers((data ?? []) as TravelerLite[]))
  }, [trips])

  // First time on the web: pop the profile setup so the user picks a name/colour
  // straight away. Shown once per account (remembered in localStorage).
  useEffect(() => {
    if (!user || loading) return
    const key = `taurus:onboarded:profile:${user.id}`
    if (localStorage.getItem(key)) return
    setProfileOpen(true)
    localStorage.setItem(key, '1')
  }, [user, loading])

  const byTrip = useMemo(() => {
    const m = new Map<string, TravelerLite[]>()
    for (const t of travelers) { if (!m.has(t.trip_id)) m.set(t.trip_id, []); m.get(t.trip_id)!.push(t) }
    return m
  }, [travelers])

  // Split into two tabs:
  //  - Upcoming: trips that haven't finished yet (soonest first) + undated trips.
  //  - Past: trips whose end date is before today (most recently ended first).
  const { upcoming, past } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const t0 = today.getTime()
    const rank = (t: Trip) => {
      if (!t.start_date) return { bucket: 1, key: 0 }
      const startMs = new Date(t.start_date).getTime()
      const endMs = new Date(t.end_date || t.start_date).getTime()
      return endMs >= t0 ? { bucket: 0, key: startMs } : { bucket: 2, key: -startMs }
    }
    const sorted = [...trips].sort((a, b) => { const ra = rank(a), rb = rank(b); return ra.bucket - rb.bucket || ra.key - rb.key })
    return {
      upcoming: sorted.filter((t) => rank(t).bucket !== 2),
      past: sorted.filter((t) => rank(t).bucket === 2),
    }
  }, [trips])

  const visibleTrips = tab === 'upcoming' ? upcoming : past

  function open(t: Trip) { switchTrip(t.id); navigate(t.owner_id === user?.id ? '/info' : '/places') }
  async function duplicate(t: Trip) {
    if (!user) return
    setBusyId(t.id)
    await duplicateTrip(t, user.id)
    setBusyId(null)
    await reload()
  }

  const flagOf = (t: Trip) => tripFlag(t) || countryFlag(t.country)

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-canvas/95 backdrop-blur flex items-center justify-between px-5 sm:px-8 h-16"
        style={{ borderBottom: '0.5px solid var(--color-line)' }}>
        <TaurusLogo height={50} />
        <button onClick={signOut} className="btn-icon" aria-label="ออกจากระบบ" title="ออกจากระบบ" style={{ color: '#D85A30' }}>
          <IconLogout size={16} />
        </button>
      </header>

      <main className="max-w-[960px] mx-auto px-5 sm:px-8 pt-7 pb-36">
        <div className="mb-4 flex items-baseline gap-2 flex-wrap">
          <h1 className="text-[20px] font-medium">ทริปของฉัน</h1>
          <p className="text-[13px] text-ink-3">{trips.length} ทริป · วางแผนการเดินทางของคุณ</p>
        </div>

        {/* Upcoming / Past tabs — full width, split evenly */}
        <div className="flex mb-5" style={{ borderBottom: '0.5px solid var(--color-line)' }} role="tablist">
          {([
            { key: 'upcoming', label: 'Upcoming Trips', count: upcoming.length },
            { key: 'past', label: 'Past Trips', count: past.length },
          ] as const).map((tt) => {
            const active = tab === tt.key
            return (
              <button key={tt.key} role="tab" aria-selected={active} onClick={() => setTab(tt.key)}
                className={`relative -mb-px flex-1 pb-3 text-center text-[15px] font-semibold transition-colors ${active ? 'text-brand' : 'text-ink-3 hover:text-ink-2'}`}>
                {tt.label}
                <span className={`ml-1.5 text-[12px] font-medium ${active ? 'text-brand' : 'text-ink-3'}`}>{tt.count}</span>
                {active && <span className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-brand" />}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="grid place-items-center py-20"><span className="animate-pulse"><TaurusMark size={36} /></span></div>
        ) : visibleTrips.length === 0 ? (
          <div className="card border-dashed py-16 grid place-items-center text-center gap-2">
            <IconCalendar size={28} className="text-ink-3" />
            <p className="text-[14px] text-ink-2 font-medium">
              {tab === 'upcoming' ? 'ยังไม่มีทริปที่กำลังจะถึง' : 'ยังไม่มีทริปที่ผ่านไปแล้ว'}
            </p>
            {tab === 'upcoming' && (
              <button onClick={() => navigate('/create')} className="btn-primary h-9 px-4 flex items-center gap-1.5 mt-1">
                <IconPlus size={16} /> สร้างทริป
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleTrips.map((t) => {
              const isOwner = t.owner_id === user?.id
              const tvs = byTrip.get(t.id) ?? []
              const countdown = tripCountdown(t.start_date, t.end_date)
              return (
                <div key={t.id} className="relative flex flex-col">
                  <div className="card !border-0 p-0 overflow-hidden relative isolate min-h-[200px] flex flex-col text-white z-10" style={{ background: heroGradient(t) }}>
                  {/* full photo (shifted right) */}
                  <CoverImage url={coverImage(t)} />
                  {/* liquid-glass: frost the photo (blur), then a navy tint that fades
                      left→right for text contrast. Kept mask-free — backdrop-filter +
                      mask-image blanks the layer (white screen) on iOS Safari. */}
                  <div className="absolute inset-0 pointer-events-none" style={{
                    backdropFilter: 'blur(16px) saturate(1.3)',
                    WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
                  }} />
                  <div className="absolute inset-0 pointer-events-none" style={{
                    background: 'linear-gradient(100deg, rgba(9,28,74,0.50) 0%, rgba(9,28,74,0.24) 42%, rgba(9,28,74,0.06) 72%, rgba(9,28,74,0) 100%)',
                  }} />

                  {/* everything sits on the photo (min-w-0 so a long name can truncate
                      instead of stretching the card) */}
                  <div className="relative flex-1 flex flex-col p-3.5 min-w-0" style={{ textShadow: '0 1px 4px rgba(8,18,40,.45)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[24px] leading-none">{flagOf(t)}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <PopMenu items={[
                          // draft trips (no dates) edit through the create wizard, like the "พร้อมเดินทางแล้ว" button
                          { label: 'แก้ไข', icon: <IconPencil size={15} />, onClick: () => (t.start_date ? setEditor(t) : navigate(`/create?upgrade=${t.id}`)) },
                          { label: 'ทำสำเนา', icon: busyId === t.id ? <IconLoader2 size={15} className="animate-spin" /> : <IconCopy size={15} />, onClick: () => duplicate(t) },
                          ...(isOwner ? [{ label: 'ลบทริป', icon: <IconTrash size={15} />, onClick: async () => { if (await confirmDialog({ title: 'ลบทริป', message: `ลบ "${t.name ?? 'ทริปนี้'}"? การลบนี้กู้คืนไม่ได้`, danger: true, confirmLabel: 'ลบ' })) { await deleteTrip(t.id); await reload() } }, danger: true }] : []),
                        ]} buttonClassName="!bg-transparent !text-white hover:!bg-white/25" />
                      </div>
                    </div>

                    <div className="flex-1 min-h-3" />

                    <button onClick={() => open(t)} className="text-left block w-full min-w-0">
                      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/85">Trip to</div>
                      <div className="text-[20px] font-semibold leading-tight truncate" title={t.name ?? ''}>{clipName(t.name)}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-white/95 mt-0.5">
                        <IconCalendar size={12} />
                        <span>{formatDateRange(t.start_date, t.end_date) || 'ยังไม่กำหนดวัน'}{t.start_date && t.end_date ? ` · ${dayCount(t.start_date, t.end_date)} วัน` : ''}</span>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 mt-2.5">
                      <AvatarStack people={tvs.map((tv, i) => ({ name: tv.nickname, color: AV[i % 4] }))} size={22} />
                      {isOwner && <IconCrown size={14} className="text-white/85" />}
                    </div>

                    <div className="flex items-center gap-2 mt-2.5">
                      <button onClick={() => open(t)}
                        className="h-9 flex-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-left">
                        View details <IconArrowRight size={13} />
                      </button>
                      <button onClick={() => downloadItineraryPdf(t)} title="ดาวน์โหลด Itinerary (PDF)"
                        className="size-9 grid place-items-center rounded-[10px] bg-white/20 hover:bg-white/35 backdrop-blur-sm border border-white/30 transition-colors"><IconDownload size={16} /></button>
                      <button onClick={() => { switchTrip(t.id); setShareOpen(true) }} title="แชร์ทริป"
                        className="size-9 grid place-items-center rounded-[10px] bg-white/20 hover:bg-white/35 backdrop-blur-sm border border-white/30 transition-colors"><IconShare2 size={16} /></button>
                    </div>
                  </div>
                  </div>

                  {/* stacked colour strip — sits behind the card and peeks out below
                      with its own rounded bottom (layered look) */}
                  {t.start_date && (
                    <div className="relative z-0 -mt-3 pt-4 pb-2 px-4 rounded-b-[14px] flex items-center justify-between gap-2 text-[11px] font-medium text-white"
                      style={{ background: tab === 'past' ? '#5B6573' : 'var(--color-brand)' }}>
                      <span className="inline-flex items-center gap-1">
                        <IconClock size={13} /> {countdown ?? (tab === 'past' ? 'จบแล้ว' : '')}
                      </span>
                      <TripWeather trip={t} className="text-white" />
                    </div>
                  )}
                </div>
              )
            })}

            {/* create card — only on the Upcoming tab */}
            {tab === 'upcoming' && (
              <button onClick={() => navigate('/create')}
                className="card border-dashed p-4 min-h-[150px] flex flex-col items-center justify-center gap-2 text-ink-3 hover:bg-surface-2/40">
                <div className="size-10 rounded-full bg-brand-soft grid place-items-center text-brand"><IconPlus size={20} /></div>
                <span className="text-[13px] font-medium text-ink-2">สร้างทริปใหม่</span>
              </button>
            )}
          </div>
        )}

        <div className="mt-6 text-[11px] text-ink-3 flex items-center gap-1.5">
          <IconUserCircle size={13} /> เข้าระบบด้วย {user?.email}
        </div>
      </main>

      {/* Minimal glass bottom nav with soft centre wave — dashboard only */}
      <nav className="mobile-bottom-nav">
        <div className="nav-bg" aria-hidden="true" />
        <button className="bottom-nav-item active" aria-current="page" aria-label="Home"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <IconHome size={25} stroke={1.9} />
          <span>Home</span>
        </button>
        <button className="center-action" aria-label="Explore" onClick={() => navigate('/explore')}>
          <span className="dot"><IconCompass size={24} stroke={1.9} /></span>
          <span>Explore</span>
        </button>
        <button className="bottom-nav-item" aria-label="Profile" onClick={() => setProfileOpen(true)}>
          <IconUser size={25} stroke={1.9} />
          <span>Profile</span>
        </button>
      </nav>

      <TripEditor
        open={editor !== null}
        onClose={() => setEditor(null)}
        initial={editor && editor !== 'new' ? editor : null}
        onSave={async (fields) => {
          if (editor === 'new' || !editor) {
            if (!user) return
            const { id } = await createTrip(user.id, fields)
            await reload()
            switchTrip(id)
            navigate('/info')
          } else {
            await updateTrip(editor.id, fields)
            await reload()
          }
        }}
        onDelete={editor && editor !== 'new' && editor.owner_id === user?.id
          ? async () => { await deleteTrip(editor.id); await reload() }
          : undefined}
      />

      <ProfileEditor open={profileOpen} onClose={() => setProfileOpen(false)} scope="global" />
      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  )
}
