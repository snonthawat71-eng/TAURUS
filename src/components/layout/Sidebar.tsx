import { NavLink } from 'react-router-dom'
import { IconPlane } from '@tabler/icons-react'
import { NAV_ITEMS } from './nav'
import { useTrip } from '@/contexts/TripContext'
import { FxWidget } from '@/components/FxWidget'
import { TripSwitcher } from '@/components/TripSwitcher'

export function Sidebar() {
  const { days, places } = useTrip()

  const counts = {
    itinerary: days.length,
    places: places.filter((p) => p.group_type === 'place').length,
    food: places.filter((p) => p.group_type === 'food').length,
  }
  const sections = ['PLAN', 'OVERVIEW'] as const

  return (
    <aside className="w-60 shrink-0 h-dvh sticky top-0 bg-canvas flex flex-col" style={{ borderRight: '0.5px solid var(--color-line)' }}>
      <div className="flex items-center gap-2.5 px-5 h-14">
        <div className="size-7 rounded-[8px] bg-brand grid place-items-center text-white"><IconPlane size={16} stroke={1.75} /></div>
        <span className="text-[15px] font-medium tracking-tight">TRIP</span>
      </div>

      <div className="px-3"><TripSwitcher variant="sidebar" /></div>

      <nav className="flex-1 overflow-y-auto px-3 mt-4 no-scrollbar">
        {sections.map((section) => (
          <div key={section} className="mb-4">
            <div className="px-2 mb-1.5 text-[10px] font-medium tracking-wider text-ink-3">{section}</div>
            {NAV_ITEMS.filter((n) => n.section === section).map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}
                className={({ isActive }) => [
                  'relative flex items-center gap-2.5 rounded-md px-2.5 h-9 text-[13px] mb-0.5 transition-colors',
                  isActive ? 'bg-surface-2 text-ink font-medium' : 'text-ink-2 hover:bg-surface-2/60',
                ].join(' ')}>
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-full bg-brand" />}
                    <item.icon size={17} stroke={1.6} />
                    <span className="flex-1">{item.label}</span>
                    {item.count && counts[item.count] > 0 && <span className="text-[11px] text-ink-3">{counts[item.count]}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <FxWidget />
    </aside>
  )
}
