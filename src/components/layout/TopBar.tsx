import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { IconShare2, IconUserCircle, IconLayoutGrid, IconWorldSearch } from '@tabler/icons-react'
import { NAV_ITEMS } from './nav'
import { TripSwitcher } from '@/components/TripSwitcher'
import { ShareDialog } from '@/components/ShareDialog'
import { ProfileEditor } from '@/components/ProfileEditor'
import { FxWidget } from '@/components/FxWidget'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'

export function TopBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { trip, travelers, profile: myProfile, myPermission } = useTrip()
  const { user } = useAuth()
  const [share, setShare] = useState(false)
  const [profile, setProfile] = useState(false)

  // First time entering a trip that was shared with me (I'm not the owner): pop
  // the "which traveler am I" picker. Shown once per trip, and skipped if my name
  // already matches a traveler here. Remembered in localStorage.
  useEffect(() => {
    if (!user || !trip || myPermission !== 'edit' || !travelers.length) return
    const key = `taurus:claimed:${user.id}:${trip.id}`
    if (localStorage.getItem(key)) return
    const myName = myProfile?.nickname?.trim().toLowerCase()
    const linked = !!myName && travelers.some((t) => t.nickname?.trim().toLowerCase() === myName)
    if (!linked) setProfile(true)
    localStorage.setItem(key, '1')
  }, [user, trip?.id, myPermission, travelers, myProfile]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = NAV_ITEMS.find((n) => pathname.startsWith(n.to))
  const title = current?.label ?? 'TAURUS'

  return (
    <header className="sticky top-0 z-30 bg-canvas/95 backdrop-blur flex items-center justify-between gap-2 px-4 sm:px-5 h-14"
      style={{ borderBottom: '0.5px solid var(--color-line)' }}>
      {/* Desktop: page title. Mobile: trip switcher */}
      <h1 className="text-[16px] font-medium max-md:hidden">{title}</h1>
      <div className="md:hidden min-w-0"><TripSwitcher variant="topbar" /></div>

      <div className="flex items-center gap-1.5 shrink-0">
        {/* FX rate — only on mobile (desktop shows it in the sidebar) */}
        <div className="md:hidden"><FxWidget variant="bar" /></div>
        {/* Explore — highlighted so it stands out */}
        <button onClick={() => navigate('/explore')} aria-label="Explore"
          className="btn-icon !w-auto px-3 gap-1.5 text-[12px] font-medium !border-0 text-white shadow-sm"
          style={{ background: 'linear-gradient(120deg, #0270FB, #4BC5D9)' }}>
          <IconWorldSearch size={16} /> <span className="max-md:hidden">Explore</span>
        </button>
        {/* ทริปทั้งหมด */}
        <button onClick={() => navigate('/')} className="btn-icon" aria-label="ทริปทั้งหมด" title="ทริปทั้งหมด">
          <IconLayoutGrid size={16} />
        </button>
        {/* แชร์ทริป */}
        <button onClick={() => setShare(true)} className="btn-icon" aria-label="แชร์ทริป" title="แชร์ทริป">
          <IconShare2 size={16} />
        </button>
        {/* โปรไฟล์ของฉัน — ขวาสุด */}
        <button onClick={() => setProfile(true)} className="btn-icon" aria-label="โปรไฟล์ของฉัน" title="โปรไฟล์ของฉัน">
          <IconUserCircle size={16} />
        </button>
      </div>

      <ShareDialog open={share} onClose={() => setShare(false)} />
      <ProfileEditor open={profile} onClose={() => setProfile(false)} />
    </header>
  )
}
