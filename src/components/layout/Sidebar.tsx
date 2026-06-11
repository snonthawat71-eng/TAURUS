import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { IconPlane, IconChevronDown, IconPlus, IconPencil, IconCheck } from '@tabler/icons-react'
import { NAV_ITEMS } from './nav'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { AvatarStack } from '@/components/Avatar'
import { FxWidget } from '@/components/FxWidget'
import { TripEditor } from '@/components/TripEditor'
import { formatDateRange, dayCount } from '@/lib/format'
import { countryFlag } from '@/lib/countries'
import { createTrip, updateTrip, deleteTrip } from '@/lib/tripMutations'
import type { Trip } from '@/lib/database.types'

export function Sidebar() {
  const { trip, trips, travelers, days, places, switchTrip, reload } = useTrip()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [tripEdit, setTripEdit] = useState<'new' | Trip | null>(null)

  const counts = {
    itinerary: days.length,
    places: places.filter((p) => p.group_type === 'place').length,
    food: places.filter((p) => p.group_type === 'food').length,
  }
  const sections = ['PLAN', 'OVERVIEW'] as const

  return (
    <aside className="w-60 shrink-0 h-dvh sticky top-0 bg-canvas flex flex-col" style={{ borderRight: '0.5px solid var(--color-line)' }}>
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-14">
        <div className="size-7 rounded-[8px] bg-brand grid place-items-center text-white">
          <IconPlane size={16} stroke={1.75} />
        </div>
        <span className="text-[15px] font-medium tracking-tight">TRIP</span>
      </div>

      {/* Trip selector */}
      <div className="px-3 relative">
        <button onClick={() => setOpen((v) => !v)} className="card w-full text-left p-3 hover:bg-surface transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium flex items-center gap-1.5 min-w-0">
              <span>{countryFlag(trip?.country)}</span>
              <span className="truncate">{trip?.name ?? '—'}</span>
            </span>
            <IconChevronDown size={15} className="text-ink-3 shrink-0" />
          </div>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-ink-3">
            <span>🗓</span>
            <span>{formatDateRange(trip?.start_date ?? null, trip?.end_date ?? null)}</span>
            {trip && (
              <span className="chip !bg-brand-soft !text-brand-dark !py-0.5">{dayCount(trip.start_date, trip.end_date)} วัน</span>
            )}
          </div>
          <div className="mt-2.5">
            <AvatarStack people={travelers.map((t, i) => ({ name: t.nickname, color: ['av1', 'av2', 'av3', 'av4'][i % 4] }))} size={22} />
          </div>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-3 right-3 mt-1 card p-1 shadow-lg z-50 max-h-[60vh] overflow-y-auto">
              <div className="px-2.5 py-1.5 text-[10px] font-medium tracking-wider text-ink-3">ทริปของฉัน</div>
              {trips.map((t) => (
                <div key={t.id} className="flex items-center group">
                  <button onClick={() => { switchTrip(t.id); setOpen(false) }}
                    className="flex-1 flex items-center gap-2 px-2.5 h-9 rounded-md text-[13px] hover:bg-surface-2 min-w-0">
                    <span>{countryFlag(t.country)}</span>
                    <span className="flex-1 text-left truncate">{t.name}</span>
                    {t.id === trip?.id && <IconCheck size={14} className="text-brand shrink-0" />}
                  </button>
                  <button onClick={() => { setTripEdit(t); setOpen(false) }} className="btn-icon !border-0 !size-8 text-ink-3" aria-label="แก้ไขทริป">
                    <IconPencil size={14} />
                  </button>
                </div>
              ))}
              <div style={{ borderTop: '0.5px solid var(--color-line)' }} className="my-1" />
              <button onClick={() => { setTripEdit('new'); setOpen(false) }}
                className="w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-[13px] text-brand-mid hover:bg-brand-soft">
                <IconPlus size={15} /> สร้างทริปใหม่
              </button>
            </div>
          </>
        )}
      </div>

      {/* Nav */}
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

      <TripEditor
        open={tripEdit !== null}
        onClose={() => setTripEdit(null)}
        initial={tripEdit && tripEdit !== 'new' ? tripEdit : null}
        onSave={async (fields) => {
          if (tripEdit === 'new' || !tripEdit) {
            if (!user) return
            const { id } = await createTrip(user.id, fields)
            switchTrip(id)
          } else {
            await updateTrip(tripEdit.id, fields)
            await reload()
          }
        }}
        onDelete={tripEdit && tripEdit !== 'new'
          ? async () => { await deleteTrip(tripEdit.id); await reload() }
          : undefined}
      />
    </aside>
  )
}
