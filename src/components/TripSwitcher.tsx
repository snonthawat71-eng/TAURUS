import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconChevronDown, IconChevronRight, IconPlus, IconPencil, IconCheck, IconCalendar } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { AvatarStack } from './Avatar'
import { useTrip } from '@/contexts/TripContext'
import { formatDateRange, dayCount } from '@/lib/format'
import { countryFlag } from '@/lib/countries'
import { tripFlag } from '@/lib/segments'
import type { Trip } from '@/lib/database.types'

const flagOf = (t: Trip | null | undefined) => (tripFlag(t) || countryFlag(t?.country))

export function TripSwitcher({ variant }: { variant: 'sidebar' | 'topbar' }) {
  const { trip, trips, travelers, switchTrip } = useTrip()
  const navigate = useNavigate()
  const [sheet, setSheet] = useState(false)
  // edit/create both run through the step wizard (/create), prefilled for edits;
  // drafts (no dates) go through the upgrade flow so dates can be added
  const editTrip = (t: Trip) => { setSheet(false); navigate(t.start_date ? `/create?edit=${t.id}` : `/create?upgrade=${t.id}`) }

  return (
    <>
      {variant === 'sidebar' ? (
        <button onClick={() => setSheet(true)} className="card w-full text-left p-3 hover:bg-surface transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium flex items-center gap-1.5 min-w-0">
              <span>{flagOf(trip)}</span>
              <span className="truncate">{trip?.name ?? '—'}</span>
            </span>
            <IconChevronDown size={15} className="text-ink-3 shrink-0" />
          </div>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-ink-3">
            <IconCalendar size={12} />
            <span>{formatDateRange(trip?.start_date ?? null, trip?.end_date ?? null)}</span>
            {trip && <span className="chip !bg-brand-soft !text-brand-dark !py-0.5">{dayCount(trip.start_date, trip.end_date)} วัน</span>}
          </div>
          <div className="mt-2.5">
            <AvatarStack people={travelers.map((t, i) => ({ name: t.nickname, color: ['av1', 'av2', 'av3', 'av4'][i % 4], photo: t.avatar_url, photoFocus: t.avatar_focus }))} size={22} />
          </div>
        </button>
      ) : (
        <button onClick={() => setSheet(true)} className="flex items-center gap-1.5 min-w-0 max-w-full px-2 h-8 rounded-full bg-surface-2 text-[13px] font-medium">
          <span className="shrink-0">{flagOf(trip)}</span>
          <span className="truncate min-w-0">{trip?.name ?? 'เลือกทริป'}</span>
          <IconChevronDown size={14} className="text-ink-3 shrink-0" />
        </button>
      )}

      <Drawer open={sheet} onClose={() => setSheet(false)} title="ทริปของฉัน">
        <div className="space-y-1.5">
          {trips.map((t) => {
            const active = t.id === trip?.id
            return (
              <div key={t.id}
                className="flex items-center gap-2 rounded-lg p-2.5"
                style={{ border: '0.5px solid var(--color-line)', background: active ? 'var(--color-brand-soft)' : 'var(--color-surface)' }}>
                <button onClick={() => { switchTrip(t.id); setSheet(false) }} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                  <span className="text-[20px] shrink-0">{flagOf(t)}</span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium truncate flex items-center gap-1.5">
                      {t.name}{active && <IconCheck size={14} className="text-brand shrink-0" />}
                    </div>
                    <div className="text-[11px] text-ink-3">{formatDateRange(t.start_date, t.end_date) || t.country || '—'}</div>
                  </div>
                </button>
                <button onClick={() => editTrip(t)} className="btn-icon !size-8 !border-0 text-ink-3" aria-label="แก้ไขทริป"><IconPencil size={15} /></button>
                {!active && <IconChevronRight size={15} className="text-ink-3 shrink-0" />}
              </div>
            )
          })}
        </div>
        <button onClick={() => { setSheet(false); navigate('/create') }} className="btn-primary w-full h-10 mt-3 flex items-center justify-center gap-1.5">
          <IconPlus size={16} /> สร้างทริปใหม่
        </button>
      </Drawer>
    </>
  )
}
