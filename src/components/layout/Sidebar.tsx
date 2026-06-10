import { NavLink } from 'react-router-dom'
import { IconPlane, IconSelector, IconPlus, IconTrendingUp } from '@tabler/icons-react'
import { NAV_ITEMS } from './nav'
import { useTrip } from '@/contexts/TripContext'
import { AvatarStack } from '@/components/Avatar'
import { formatDateRange, dayCount } from '@/lib/format'

export function Sidebar() {
  const { trip, travelers, days, places } = useTrip()

  const counts = {
    itinerary: days.length,
    places: places.filter((p) => p.group_type === 'place').length,
    food: places.filter((p) => p.group_type === 'food').length,
  }

  const sections = ['PLAN', 'OVERVIEW'] as const

  return (
    <aside className="w-60 shrink-0 h-dvh sticky top-0 bg-canvas flex flex-col"
      style={{ borderRight: '0.5px solid var(--color-line)' }}>
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-14">
        <div className="size-7 rounded-[8px] bg-brand grid place-items-center text-white">
          <IconPlane size={16} stroke={1.75} />
        </div>
        <span className="text-[15px] font-medium tracking-tight">TRIP</span>
      </div>

      {/* Trip selector card */}
      <div className="px-3">
        <button className="card w-full text-left p-3 hover:bg-surface transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium flex items-center gap-1.5">
              <span>🇨🇳</span>
              {trip?.name ?? '—'}
            </span>
            <IconSelector size={15} className="text-ink-3" />
          </div>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-ink-3">
            <span>🗓</span>
            <span>{formatDateRange(trip?.start_date ?? null, trip?.end_date ?? null)}</span>
            {trip && (
              <span className="chip !bg-brand-soft !text-brand-dark !py-0.5">
                {dayCount(trip.start_date, trip.end_date)} วัน
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <AvatarStack people={travelers.map((t) => ({ name: t.nickname }))} size={22} />
            <span className="btn-icon !size-6 !rounded-full border-dashed">
              <IconPlus size={13} />
            </span>
          </div>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 mt-4 no-scrollbar">
        {sections.map((section) => (
          <div key={section} className="mb-4">
            <div className="px-2 mb-1.5 text-[10px] font-medium tracking-wider text-ink-3">{section}</div>
            {NAV_ITEMS.filter((n) => n.section === section).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  [
                    'relative flex items-center gap-2.5 rounded-md px-2.5 h-9 text-[13px] mb-0.5 transition-colors',
                    isActive ? 'bg-surface-2 text-ink font-medium' : 'text-ink-2 hover:bg-surface-2/60',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-full bg-brand" />
                    )}
                    <item.icon size={17} stroke={1.6} />
                    <span className="flex-1">{item.label}</span>
                    {item.count && counts[item.count] > 0 && (
                      <span className="text-[11px] text-ink-3">{counts[item.count]}</span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* FX rate */}
      <div className="m-3 card p-3">
        <div className="flex items-center justify-between text-[11px] text-ink-3">
          <span>อัตราแลกเปลี่ยน</span>
          <span className="flex items-center gap-0.5 text-brand"><IconTrendingUp size={12} /> 0.4%</span>
        </div>
        <div className="text-[18px] font-medium mt-0.5">¥1 = ฿4.92</div>
        <div className="text-[10px] text-ink-3 mt-0.5">อัปเดต 5 นาทีที่แล้ว</div>
      </div>
    </aside>
  )
}
