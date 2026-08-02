import { useLocation, useNavigate } from 'react-router-dom'
import { IconUserCircle, IconHome, IconWorldSearch } from '@tabler/icons-react'
import { NAV_ITEMS } from './nav'
import { TripSwitcher } from '@/components/TripSwitcher'
import { FxWidget } from '@/components/FxWidget'
import { useAuth } from '@/contexts/AuthContext'
import { useUnreadNotifs } from '@/lib/useUnreadNotifs'

export function TopBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const unread = useUnreadNotifs(user?.id)

  const current = NAV_ITEMS.find((n) => pathname.startsWith(n.to))
  const title = current?.label ?? 'TAURUS'

  return (
    <header className="sticky top-0 z-30 bg-canvas/95 backdrop-blur flex items-center justify-between gap-2 px-4 sm:px-5 min-h-14"
      style={{ borderBottom: '0.5px solid var(--color-line)', paddingTop: 'var(--sat)' }}>
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
        {/* หน้าแรก / ทริปทั้งหมด */}
        <button onClick={() => navigate('/')} className="btn-icon" aria-label="หน้าแรก" title="หน้าแรก">
          <IconHome size={16} />
        </button>
        {/* โปรไฟล์ของฉัน — ขวาสุด (จุดแดง = มีแจ้งเตือนยังไม่อ่าน) */}
        <button onClick={() => navigate('/profile')} className="btn-icon relative" aria-label="โปรไฟล์ของฉัน" title="โปรไฟล์ของฉัน">
          <IconUserCircle size={16} />
          {unread && <span className="absolute top-1 right-1 size-2 rounded-full bg-[#EF4444]" style={{ boxShadow: '0 0 0 2px var(--color-canvas)' }} />}
        </button>
      </div>
    </header>
  )
}
