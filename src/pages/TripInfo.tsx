import { useState } from 'react'
import {
  IconChevronRight, IconPlaneDeparture, IconPlaneArrival, IconBuilding,
  IconMapPin, IconUserPlus,
} from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { Avatar } from '@/components/Avatar'
import { TravelerDrawer } from '@/components/TravelerDrawer'
import { openMap } from '@/lib/maps'
import { formatShortThai } from '@/lib/format'
import type { Flight, Traveler } from '@/lib/database.types'

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2.5 mt-6 first:mt-0">
      <h2 className="text-[13px] font-medium text-ink-2">{children}</h2>
      {action}
    </div>
  )
}

function FlightCard({ f }: { f: Flight }) {
  const Icon = f.direction === 'return' ? IconPlaneArrival : IconPlaneDeparture
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] text-ink-2">
          <Icon size={16} className="text-brand" />
          <span className="font-medium text-ink">{f.airline}</span>
          <span className="chip">{f.flight_no}</span>
        </div>
        <span className="text-[11px] text-ink-3">{formatShortThai(f.flight_date)}</span>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="text-left">
          <div className="text-[22px] font-medium leading-none">{f.dep_code}</div>
          <div className="text-[11px] text-ink-3 mt-1">{f.dep_name}</div>
          <div className="text-[13px] mt-0.5">{f.dep_time}</div>
        </div>
        <div className="flex-1 px-3 flex flex-col items-center">
          <div className="w-full h-px bg-line relative">
            <span className="absolute -top-1.5 right-0 size-3 rotate-90 text-ink-3">✈</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[22px] font-medium leading-none">{f.arr_code}</div>
          <div className="text-[11px] text-ink-3 mt-1">{f.arr_name}</div>
          <div className="text-[13px] mt-0.5">{f.arr_time}</div>
        </div>
      </div>
      {f.booking_ref && (
        <div className="mt-3 pt-3 text-[12px]" style={{ borderTop: '0.5px solid var(--color-line)' }}>
          <span className="text-ink-3">Booking ref </span>
          <span className="booking-id">{f.booking_ref}</span>
        </div>
      )}
    </div>
  )
}

export default function TripInfo() {
  const { trip, travelers, flights, hotels } = useTrip()
  const [selected, setSelected] = useState<Traveler | null>(null)
  const [dir, setDir] = useState<'outbound' | 'return'>('outbound')

  const dirFlights = flights.filter((f) => (f.direction ?? 'outbound') === dir)

  return (
    <div>
      {/* Travelers */}
      <SectionTitle
        action={<button className="btn-link flex items-center gap-1"><IconUserPlus size={14} /> เพิ่มคน</button>}
      >
        ผู้เดินทาง · {travelers.length} คน
      </SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {travelers.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t)}
            className="card p-3 flex items-center gap-2.5 text-left hover:bg-surface-2/40"
          >
            <Avatar name={t.nickname} size={36} ring={false} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium truncate">{t.nickname}</div>
              <div className="text-[11px] text-ink-3">
                {t.passport_last4 ? `••••${t.passport_last4}` : 'ดูไฟล์ลับ'}
              </div>
            </div>
            <IconChevronRight size={15} className="text-ink-3 shrink-0" />
          </button>
        ))}
      </div>

      {/* Flights */}
      <SectionTitle>ไฟลต์</SectionTitle>
      <div className="inline-flex gap-1 p-0.5 rounded-md bg-surface-2 mb-2.5">
        {(['outbound', 'return'] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDir(d)}
            className={[
              'px-3 h-7 rounded-[6px] text-[12px] font-medium transition-colors',
              dir === d ? 'bg-surface text-ink shadow-sm' : 'text-ink-3',
            ].join(' ')}
          >
            {d === 'outbound' ? 'ขาไป' : 'ขากลับ'}
          </button>
        ))}
      </div>
      <div className="space-y-2.5">
        {dirFlights.length === 0 ? (
          <div className="card p-4 text-[12px] text-ink-3 text-center">ยังไม่มีข้อมูลไฟลต์</div>
        ) : (
          dirFlights.map((f) => <FlightCard key={f.id} f={f} />)
        )}
      </div>

      {/* Hotels */}
      <SectionTitle>ที่พัก</SectionTitle>
      <div className="space-y-2.5">
        {hotels.map((h) => (
          <div key={h.id} className="card p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-md bg-surface-2 grid place-items-center text-ink-2">
                  <IconBuilding size={18} />
                </div>
                <div>
                  <div className="text-[14px] font-medium">{h.name}</div>
                  <div className="text-[11px] text-ink-3">{h.city} · {h.nights} คืน</div>
                </div>
              </div>
              {h.map_url && (
                <button onClick={() => openMap(h.map_url)} className="chip !bg-brand-soft !text-brand-dark"
                  style={{ border: '0.5px solid var(--color-brand-border)' }}>
                  <IconMapPin size={12} /> แผนที่
                </button>
              )}
            </div>
            {h.booking_id && (
              <div className="mt-3 text-[12px]">
                <span className="text-ink-3">Booking ID </span>
                <span className="booking-id">{h.booking_id}</span>
              </div>
            )}
            {h.rooms?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {h.rooms.map((r, i) => (
                  <span key={i} className="chip">{r.name}: {r.members.join(', ')}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        {hotels.length === 0 && (
          <div className="card p-4 text-[12px] text-ink-3 text-center">ยังไม่มีข้อมูลที่พัก</div>
        )}
      </div>

      <TravelerDrawer
        traveler={selected}
        tripId={trip?.id ?? ''}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
