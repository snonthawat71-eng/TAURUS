import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './nav'

export function BottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur grid grid-cols-6"
      style={{ borderTop: '0.5px solid var(--color-line)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV_ITEMS.map((item) => (
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
