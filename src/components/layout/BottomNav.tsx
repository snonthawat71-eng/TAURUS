import { NavLink } from 'react-router-dom'
import { visibleNav } from './nav'
import { useTrip } from '@/contexts/TripContext'

export function BottomNav() {
  const { myPermission } = useTrip()
  const items = visibleNav(myPermission)
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur grid"
      style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)`, borderTop: '0.5px solid var(--color-line)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            [
              'flex flex-col items-center justify-center gap-0.5 h-14 text-[9px]',
              isActive ? 'text-brand' : 'text-ink-3',
            ].join(' ')
          }
        >
          <item.icon size={20} stroke={1.6} />
          <span className="leading-none truncate max-w-full px-0.5">{item.label.split(' ')[0]}</span>
        </NavLink>
      ))}
    </nav>
  )
}
