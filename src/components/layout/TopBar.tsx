import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { IconDots, IconShare2, IconLogout, IconUserCircle, IconLayoutGrid, IconWorldSearch } from '@tabler/icons-react'
import { NAV_ITEMS } from './nav'
import { useAuth } from '@/contexts/AuthContext'
import { TripSwitcher } from '@/components/TripSwitcher'
import { ShareDialog } from '@/components/ShareDialog'
import { ProfileEditor } from '@/components/ProfileEditor'

export function TopBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [menu, setMenu] = useState(false)
  const [share, setShare] = useState(false)
  const [profile, setProfile] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = NAV_ITEMS.find((n) => pathname.startsWith(n.to))
  const title = current?.label ?? 'TAURUS'

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <header className="sticky top-0 z-30 bg-canvas/95 backdrop-blur flex items-center justify-between gap-2 px-4 sm:px-5 h-14"
      style={{ borderBottom: '0.5px solid var(--color-line)' }}>
      {/* Desktop: page title. Mobile: trip switcher */}
      <h1 className="text-[16px] font-medium max-md:hidden">{title}</h1>
      <div className="md:hidden min-w-0"><TripSwitcher variant="topbar" /></div>

      <div className="flex items-center gap-1.5 shrink-0">
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
        {/* โปรไฟล์ของฉัน */}
        <button onClick={() => setProfile(true)} className="btn-icon" aria-label="โปรไฟล์ของฉัน" title="โปรไฟล์ของฉัน">
          <IconUserCircle size={16} />
        </button>
        {/* แชร์ทริป */}
        <button onClick={() => setShare(true)} className="btn-icon" aria-label="แชร์ทริป" title="แชร์ทริป">
          <IconShare2 size={16} />
        </button>
        {/* overflow: account + sign out */}
        <div className="relative" ref={ref}>
          <button className="btn-icon" aria-label="เพิ่มเติม" onClick={() => setMenu((v) => !v)}><IconDots size={16} /></button>
          {menu && (
            <div className="absolute right-0 mt-1.5 w-52 card p-1 shadow-lg z-30">
              <div className="px-2.5 py-2 text-[11px] text-ink-3 truncate">{user?.email}</div>
              <div style={{ borderTop: '0.5px solid var(--color-line)' }} />
              <button onClick={() => { setMenu(false); signOut() }}
                className="w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-[13px] text-ink-2 hover:bg-surface-2">
                <IconLogout size={15} /> ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </div>

      <ShareDialog open={share} onClose={() => setShare(false)} />
      <ProfileEditor open={profile} onClose={() => setProfile(false)} />
    </header>
  )
}
