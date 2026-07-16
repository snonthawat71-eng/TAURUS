import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconArrowLeft, IconSettings, IconCompass, IconCheck,
  IconPlaneTilt, IconBuildingCommunity, IconBell, IconHeartFilled, IconMessageCircle, IconMessageReport,
  IconSeeding, IconStarFilled, IconCrown, IconTargetArrow,
} from '@tabler/icons-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { Avatar } from '@/components/Avatar'
import { ProfileEditor } from '@/components/ProfileEditor'
import { listMyExplore, allPopularity, getExploreNotifs, type ExploreNotif } from '@/lib/exploreMutations'
import { loyaltyTier } from '@/lib/loyalty'
import { countryFlag } from '@/lib/countries'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

interface Stats { shared: number; views: number; saves: number; likes: number; comments: number }

const LOYALTY_ICON = { seedling: IconSeeding, compass: IconCompass, star: IconStarFilled, crown: IconCrown }

function notifTime(at: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 1000))
  if (s < 60) return 'เมื่อสักครู่'
  const m = Math.round(s / 60); if (m < 60) return `${m} นาทีที่แล้ว`
  const h = Math.round(m / 60); if (h < 24) return `${h} ชม.ที่แล้ว`
  const d = Math.round(h / 24); if (d < 30) return `${d} วันที่แล้ว`
  return new Date(at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}
const SUG_TEXT: Record<string, string> = { route: 'เสนอเพิ่มเส้นทางให้', branch: 'เสนอเพิ่มสาขาให้', edit: 'เสนอแก้ข้อมูลของ', report: 'รายงาน' }

export default function Profile() {
  const { profile, trips, switchTrip } = useTrip()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [settings, setSettings] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [notifs, setNotifs] = useState<ExploreNotif[]>([])

  // my Explore contribution stats
  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      const [{ data: mine }, pop] = await Promise.all([listMyExplore(user.id), allPopularity()])
      if (!active) return
      const items = (mine ?? []) as { id: string }[]
      let views = 0, saves = 0, likes = 0, comments = 0
      for (const it of items) { const p = pop.get(it.id); if (p) { views += p.views; saves += p.saves; likes += p.likes; comments += p.comments } }
      setStats({ shared: items.length, views, saves, likes, comments })
    })()
    return () => { active = false }
  }, [user?.id])

  // notifications feed (Explore) + realtime refresh
  useEffect(() => {
    if (!user) return
    let active = true
    const load = () => getExploreNotifs(user.id).then((l) => { if (active) setNotifs(l) })
    load()
    if (!isSupabaseConfigured) return () => { active = false }
    let t: ReturnType<typeof setTimeout>
    const bump = () => { clearTimeout(t); t = setTimeout(load, 400) }
    const ch = supabase.channel('profile-notifs')
    for (const table of ['explore_votes', 'explore_comments', 'explore_suggestions']) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, bump)
    }
    ch.subscribe()
    return () => { active = false; clearTimeout(t); supabase.removeChannel(ch) }
  }, [user?.id])

  const yearNum = new Date().getFullYear()
  const today = new Date().toISOString().slice(0, 10)

  // travel stats + this-year goal bar
  const view = useMemo(() => {
    const cityKeys = new Set<string>()
    for (const t of trips) for (const c of (t.cities ?? [])) { const k = (c ?? '').trim().toLowerCase(); if (k) cityKeys.add(k) }
    const thisYear = trips
      .filter((t) => t.start_date && new Date(t.start_date + 'T00:00:00').getFullYear() === yearNum)
      .sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1))
    const goal = profile?.year_goal?.[String(yearNum)] ?? 0
    const slots = Math.max(goal, thisYear.length)
    const upcoming = trips
      .filter((t) => t.start_date && t.start_date >= today)
      .sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1))[0] ?? null
    const daysTo = upcoming?.start_date
      ? Math.round((new Date(upcoming.start_date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000)
      : null
    return { cities: cityKeys.size, thisYear, goal, slots, upcoming, daysTo }
  }, [trips, profile?.year_goal, yearNum, today])

  const lt = loyaltyTier(stats?.shared ?? 0)
  const LIcon = LOYALTY_ICON[lt.tier.icon]

  function openTrip(id: string) { switchTrip(id); navigate('/info') }

  const notifIcon = (n: ExploreNotif) => n.kind === 'like'
    ? { bg: '#FCE7EA', el: <IconHeartFilled size={15} className="text-[#EF4444]" /> }
    : n.kind === 'suggestion'
      ? { bg: '#EAF6EE', el: <IconMessageReport size={15} style={{ color: '#16A34A' }} /> }
      : { bg: 'var(--color-brand-soft)', el: <IconMessageCircle size={15} className="text-brand" /> }

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-20 bg-canvas/95 backdrop-blur flex items-center gap-2 px-4 h-14" style={{ borderBottom: '0.5px solid var(--color-line)' }}>
        <button onClick={() => navigate(-1)} className="btn-icon !border-0" aria-label="กลับ"><IconArrowLeft size={18} /></button>
        <span className="text-[15px] font-medium">โปรไฟล์ของฉัน</span>
        <button onClick={() => setSettings(true)} className="btn-icon !border-0 ml-auto" aria-label="ตั้งค่าโปรไฟล์" title="ตั้งค่าโปรไฟล์"><IconSettings size={18} /></button>
      </header>

      <main className="max-w-[560px] mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* ── passport header ── */}
        <div className="rounded-[18px] p-4 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-mid) 100%)' }}>
          <div className="flex items-center gap-3.5">
            <span className="rounded-full shrink-0" style={{ boxShadow: '0 0 0 3px rgba(255,255,255,.35)' }}>
              <Avatar name={profile?.nickname || '?'} color={profile?.avatar_color} photo={profile?.avatar_url} photoFocus={profile?.avatar_focus} size={82} ring={false} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[24px] font-bold leading-none truncate">{profile?.nickname || 'นักเดินทาง'}</div>
              {profile?.full_name && <div className="text-[12px] text-white/70 mt-1 truncate">{profile.full_name}</div>}
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 mt-2 text-[11px] font-semibold" style={{ background: '#fff', color: lt.tier.color }}>
                <LIcon size={12} /> {lt.tier.label}
              </span>
            </div>
          </div>

          {/* year travel bar — goal slots, real trips fill in, finished get ✓ */}
          {view.slots > 0 ? (
            <div className="mt-4 rounded-[12px] bg-white/12 px-3 py-3">
              <div className="flex items-center justify-between text-[10.5px] text-white/80 mb-2">
                <span className="inline-flex items-center gap-1"><IconTargetArrow size={12} /> เป้าหมายปี {yearNum + 543}</span>
                <span>{view.thisYear.length}/{view.slots} ทริป</span>
              </div>
              <div className="flex items-center">
                {Array.from({ length: view.slots }).map((_, i) => {
                  const trip = view.thisYear[i]
                  const done = !!(trip?.end_date && trip.end_date < today)
                  const active = !!trip && !done
                  return (
                    <div key={i} className="flex items-center flex-1 last:flex-none">
                      <button onClick={() => trip && openTrip(trip.id)} disabled={!trip}
                        className="relative flex flex-col items-center shrink-0">
                        <span className="size-6 rounded-full grid place-items-center text-[10px] font-bold"
                          style={done ? { background: '#fff', color: 'var(--color-brand)' }
                            : active ? { background: 'rgba(255,255,255,.9)', color: 'var(--color-brand)', boxShadow: '0 0 0 3px rgba(255,255,255,.25)' }
                              : { background: 'rgba(255,255,255,.22)', color: '#fff' }}>
                          {done ? <IconCheck size={13} /> : i + 1}
                        </span>
                        <span className="absolute top-7 text-[8.5px] font-medium text-white/80 whitespace-nowrap max-w-[54px] truncate">
                          {trip ? (trip.name ?? `TRIP ${i + 1}`) : ''}
                        </span>
                      </button>
                      {i < view.slots - 1 && <span className="h-[3px] flex-1 rounded-full mx-1" style={{ background: view.thisYear[i + 1] ? '#fff' : 'rgba(255,255,255,.25)' }} />}
                    </div>
                  )
                })}
              </div>
              <div className="h-3" />
            </div>
          ) : (
            <button onClick={() => setSettings(true)} className="mt-4 w-full rounded-[12px] bg-white/12 py-2.5 text-[12px] font-medium inline-flex items-center justify-center gap-1.5">
              <IconTargetArrow size={14} /> ตั้งเป้าหมายการเดินทางปีนี้
            </button>
          )}
        </div>

        {/* ── stats row ── */}
        <div className="flex items-stretch gap-3">
          <div className="card flex-1 p-3 text-center">
            <IconPlaneTilt size={18} className="mx-auto text-brand" />
            <div className="text-[22px] font-bold leading-none mt-1.5 tabular-nums">{trips.length}</div>
            <div className="text-[10.5px] text-ink-3 mt-1">ทริป</div>
          </div>
          <div className="card flex-1 p-3 text-center">
            <IconBuildingCommunity size={18} className="mx-auto text-brand" />
            <div className="text-[22px] font-bold leading-none mt-1.5 tabular-nums">{view.cities}</div>
            <div className="text-[10.5px] text-ink-3 mt-1">เมือง</div>
          </div>
          {view.upcoming ? (
            <button onClick={() => openTrip(view.upcoming!.id)} className="flex-[1.4] rounded-[12px] p-3 text-left text-white relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-mid) 100%)' }}>
              <div className="flex items-center gap-1 text-[10px] font-semibold text-white/85"><IconPlaneTilt size={12} /> ทริปถัดไป</div>
              <div className="text-[11px] font-medium truncate mt-0.5">{view.upcoming.flag || countryFlag(view.upcoming.country)} {view.upcoming.name}</div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-[26px] font-bold leading-none tabular-nums">{view.daysTo === 0 ? 'วันนี้' : view.daysTo}</span>
                {view.daysTo !== 0 && <span className="text-[11px] font-medium">วัน</span>}
              </div>
            </button>
          ) : (
            <div className="card flex-[1.4] p-3 grid place-items-center text-center text-[11px] text-ink-3">ยังไม่มีทริปถัดไป</div>
          )}
        </div>

        {/* ── quick actions ── */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/explore/mine')} className="card p-3.5 text-left hover:bg-surface-2/40">
            <IconCompass size={22} className="text-brand" />
            <div className="text-[13px] font-medium mt-2">สถานที่ที่ฉันแชร์</div>
            <div className="text-[11px] text-ink-3 mt-0.5">{stats ? `${stats.shared} Locations` : '—'}</div>
          </button>
          <button onClick={() => setSettings(true)} className="card p-3.5 text-left hover:bg-surface-2/40">
            <IconSettings size={22} className="text-brand" />
            <div className="text-[13px] font-medium mt-2">ตั้งค่าโปรไฟล์</div>
            <div className="text-[11px] text-ink-3 mt-0.5">รูป · ชื่อ · สี · เป้าหมาย</div>
          </button>
        </div>

        {/* ── notifications ── */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center gap-1.5 px-4 h-12 text-[13px] font-semibold" style={{ borderBottom: '0.5px solid var(--color-line)' }}>
            <IconBell size={16} className="text-brand" /> การแจ้งเตือน
            {notifs.length > 0 && <span className="text-ink-3 font-normal">· {notifs.length}</span>}
          </div>
          {notifs.length === 0 ? (
            <div className="py-12 text-center text-[12px] text-ink-3">ยังไม่มีการแจ้งเตือน — แชร์สถานที่บน Explore แล้วรอคนมาไลก์/คอมเมนต์</div>
          ) : (
            <div>
              {notifs.map((n) => {
                const ic = notifIcon(n)
                return (
                  <button key={n.id} onClick={() => navigate('/explore/mine')}
                    className="w-full flex items-start gap-2.5 px-4 py-3 text-left hover:bg-surface-2/40" style={{ borderTop: '0.5px solid var(--color-line)' }}>
                    <span className="size-8 rounded-full grid place-items-center shrink-0 mt-0.5" style={{ background: ic.bg }}>{ic.el}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] leading-snug">
                        <span className="font-medium">{n.who}</span>
                        {n.kind === 'like' ? ' ถูกใจ ' : n.kind === 'suggestion' ? ` ${SUG_TEXT[n.sugKind ?? 'edit']} ` : ' คอมเมนต์ '}
                        <span className="font-medium">{n.placeName}</span>
                      </div>
                      {(n.kind === 'comment' || n.kind === 'suggestion') && n.body && (
                        <div className="text-[12px] text-ink-3 mt-0.5 line-clamp-2">“{n.body}”</div>
                      )}
                      <div className="text-[10.5px] text-ink-3 mt-0.5">{notifTime(n.at)}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </main>

      <ProfileEditor open={settings} onClose={() => setSettings(false)} scope="global" />
    </div>
  )
}
