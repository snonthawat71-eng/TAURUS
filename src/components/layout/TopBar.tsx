import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { IconSearch, IconDots, IconShare2, IconPlane, IconLogout } from '@tabler/icons-react'
import { NAV_ITEMS } from './nav'
import { useAuth } from '@/contexts/AuthContext'

export function TopBar() {
  const { pathname } = useLocation()
  const { user, signOut } = useAuth()
  const [menu, setMenu] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = NAV_ITEMS.find((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)))
  const title = current?.label ?? 'TRIP'

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <header
      className="sticky top-0 z-20 bg-canvas/95 backdrop-blur flex items-center justify-between px-5 h-14"
      style={{ borderBottom: '0.5px solid var(--color-line)' }}
    >
      <div className="flex items-center gap-2">
        <div className="md:hidden size-6 rounded-[7px] bg-brand grid place-items-center text-white">
          <IconPlane size={14} stroke={1.75} />
        </div>
        <h1 className="text-[16px] font-medium">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <button className="btn-icon" aria-label="ค้นหา"><IconSearch size={16} /></button>
        <div className="relative" ref={ref}>
          <button className="btn-icon" aria-label="เพิ่มเติม" onClick={() => setMenu((v) => !v)}>
            <IconDots size={16} />
          </button>
          {menu && (
            <div className="absolute right-0 mt-1.5 w-52 card p-1 shadow-lg z-30">
              <div className="px-2.5 py-2 text-[11px] text-ink-3 truncate">{user?.email}</div>
              <div style={{ borderTop: '0.5px solid var(--color-line)' }} />
              <button
                onClick={() => { setMenu(false); signOut() }}
                className="w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-[13px] text-ink-2 hover:bg-surface-2"
              >
                <IconLogout size={15} /> ออกจากระบบ
              </button>
            </div>
          )}
        </div>
        <button className="btn-icon !w-auto px-3 gap-1.5 text-[12px] font-medium">
          <IconShare2 size={15} />
          <span className="max-md:hidden">แชร์ทริป</span>
        </button>
      </div>
    </header>
  )
}
