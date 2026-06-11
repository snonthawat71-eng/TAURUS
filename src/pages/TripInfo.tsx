import { useMemo, useState } from 'react'
import {
  IconPlaneDeparture, IconPlaneArrival, IconMapPin, IconUserPlus, IconPlus,
  IconBed, IconHash, IconCircleCheck,
} from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { Avatar } from '@/components/Avatar'
import { TravelerDrawer, KIND_META } from '@/components/TravelerDrawer'
import { AttachLink } from '@/components/AttachLink'
import { openMap } from '@/lib/maps'
import { getSignedUrl, isSampleFile } from '@/lib/files'
import { flightDuration, formatFlightDate, formatCheckTime } from '@/lib/format'
import type { Flight, Traveler, TravelerFile } from '@/lib/database.types'

const AV = ['av1', 'av2', 'av3', 'av4']

function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2.5 mt-7 first:mt-0">
      <h2 className="text-[13px] font-medium text-ink-2">{title}</h2>
      {action}
    </div>
  )
}

function AMapPill({ url }: { url: string | null }) {
  if (!url) return null
  return (
    <button
      onClick={() => openMap(url)}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-brand-dark shrink-0"
      style={{ border: '0.5px solid var(--color-brand-border)', background: 'var(--color-brand-soft)' }}
    >
      <IconMapPin size={12} /> AMap
    </button>
  )
}

async function viewFile(f: TravelerFile, setBusy: (v: boolean) => void) {
  if (isSampleFile(f.storage_path)) {
    alert('นี่เป็นไฟล์ตัวอย่าง — แตะ "+ เพิ่มไฟล์" เพื่ออัปโหลดไฟล์จริง (QR / Arrival card / Visa) แล้วจะเปิดดูได้')
    return
  }
  setBusy(true)
  const url = await getSignedUrl(f.storage_path)
  setBusy(false)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

function FlightCard({ flights }: { flights: Flight[] }) {
  const [dir, setDir] = useState<'outbound' | 'return'>('outbound')
  const f = flights.find((x) => (x.direction ?? 'outbound') === dir) ?? flights[0]
  const { travelers } = useTrip()
  if (!f) return null
  const Icon = dir === 'return' ? IconPlaneArrival : IconPlaneDeparture

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={16} className="text-brand shrink-0" />
          <span className="text-[13px] font-medium truncate">{f.flight_no} · {f.airline}</span>
          <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium text-brand-dark shrink-0"
            style={{ background: 'var(--color-brand-soft)' }}>
            <IconCircleCheck size={11} /> Confirmed
          </span>
        </div>
        <div className="inline-flex gap-0.5 p-0.5 rounded-md bg-surface-2 shrink-0">
          {(['outbound', 'return'] as const).map((d) => (
            <button key={d} onClick={() => setDir(d)}
              className={['px-2.5 h-6 rounded-[6px] text-[11px] font-medium transition-colors',
                dir === d ? 'bg-surface text-ink shadow-sm' : 'text-ink-3'].join(' ')}>
              {d === 'outbound' ? 'ขาไป' : 'ขากลับ'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div>
          <div className="text-[22px] font-medium leading-none">{f.dep_code}</div>
          <div className="text-[11px] text-ink-3 mt-1.5">{f.dep_name}</div>
          <div className="text-[14px] mt-0.5">{f.dep_time}</div>
        </div>
        <div className="flex-1 px-3 flex flex-col items-center text-ink-3">
          <div className="text-[11px]">{flightDuration(f.dep_time, f.arr_time)}</div>
          <div className="w-full flex items-center gap-1 my-1">
            <span className="size-1.5 rounded-full bg-line-2" />
            <span className="flex-1 h-px bg-line" />
            <IconPlaneDeparture size={13} />
            <span className="flex-1 h-px bg-line" />
            <span className="size-1.5 rounded-full bg-line-2" />
          </div>
          <div className="text-[11px]">direct</div>
        </div>
        <div className="text-right">
          <div className="text-[22px] font-medium leading-none">{f.arr_code}</div>
          <div className="text-[11px] text-ink-3 mt-1.5">{f.arr_name}</div>
          <div className="text-[14px] mt-0.5">{f.arr_time}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 flex-wrap text-[11px]">
        <span className="chip">🗓 {formatFlightDate(f.flight_date)}</span>
        <span className="chip">Economy · {travelers.length} seats</span>
        {f.booking_ref && (
          <span className="inline-flex items-center gap-0.5 booking-id text-[12px]">
            <IconHash size={12} />{f.booking_ref}
          </span>
        )}
      </div>
    </div>
  )
}

export default function TripInfo() {
  const { trip, travelers, travelerFiles, flights, hotels } = useTrip()
  const [selected, setSelected] = useState<Traveler | null>(null)
  const [, setBusy] = useState(false)

  const filesByTraveler = useMemo(() => {
    const m = new Map<string, TravelerFile[]>()
    for (const f of travelerFiles) {
      if (!m.has(f.traveler_id)) m.set(f.traveler_id, [])
      m.get(f.traveler_id)!.push(f)
    }
    return m
  }, [travelerFiles])

  return (
    <div>
      {/* Travelers */}
      <SectionHead
        title="ผู้เดินทาง"
        action={<button className="btn-link flex items-center gap-1"><IconUserPlus size={14} /> เพิ่มคน</button>}
      />
      <div className="grid sm:grid-cols-2 gap-2.5">
        {travelers.map((t, i) => {
          const files = filesByTraveler.get(t.id) ?? []
          return (
            <div key={t.id} className="card p-3.5">
              <div className="flex items-center gap-2.5">
                <Avatar name={t.nickname} color={AV[i % 4]} size={34} ring={false} />
                <div className="min-w-0">
                  <div className="text-[14px] font-medium leading-tight">{t.nickname}</div>
                  {t.full_name && <div className="text-[11px] text-ink-3 truncate">{t.full_name}</div>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {files.map((f) => {
                  const meta = KIND_META[f.kind ?? 'other'] ?? KIND_META.other
                  return (
                    <button key={f.id} onClick={() => viewFile(f, setBusy)} className="chip hover:bg-surface-2">
                      <meta.icon size={12} /> {f.label || meta.label}
                    </button>
                  )
                })}
                <button onClick={() => setSelected(t)} className="chip !text-brand-mid hover:bg-brand-soft">
                  <IconPlus size={12} /> เพิ่มไฟล์
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Flights */}
      <SectionHead
        title="ไฟลต์"
        action={flights[0] && trip ? <AttachLink table="flights" id={flights[0].id} tripId={trip.id} storagePath={flights[0].storage_path} attachLabel="แนบไฟล์จอง" viewLabel="ดูไฟล์จอง" /> : undefined}
      />
      {flights.length === 0 ? (
        <div className="card p-4 text-[12px] text-ink-3 text-center">ยังไม่มีข้อมูลไฟลต์</div>
      ) : (
        <FlightCard flights={flights} />
      )}

      {/* Hotels */}
      <SectionHead
        title="ที่พัก"
        action={<button className="btn-link flex items-center gap-1"><IconPlus size={14} /> เพิ่มที่พัก</button>}
      />
      <div className="space-y-2.5">
        {hotels.map((h) => (
          <div key={h.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[14px] font-medium leading-tight">{h.name}</div>
                <div className="text-[11px] text-ink-3 mt-0.5">{h.city} · {h.nights} คืน</div>
              </div>
              <AMapPill url={h.map_url} />
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3.5">
              <div>
                <div className="text-[10px] text-ink-3">Check-in</div>
                <div className="text-[12px] font-medium mt-0.5">{formatCheckTime(h.checkin)}</div>
              </div>
              <div>
                <div className="text-[10px] text-ink-3">Check-out</div>
                <div className="text-[12px] font-medium mt-0.5">{formatCheckTime(h.checkout)}</div>
              </div>
              <div>
                <div className="text-[10px] text-ink-3">Booking ID</div>
                <div className="text-[12px] booking-id mt-0.5">{h.booking_id}</div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mt-3.5 flex-wrap">
              <div className="flex flex-wrap gap-1.5">
                {h.rooms?.map((r, i) => (
                  <span key={i} className="chip"><IconBed size={12} /> {r.name} · {r.members.join(', ')}</span>
                ))}
              </div>
              {trip && (
                <AttachLink table="hotels" id={h.id} tripId={trip.id} storagePath={h.storage_path} attachLabel="ใบจอง" viewLabel="ดูใบจอง" />
              )}
            </div>
          </div>
        ))}
        {hotels.length === 0 && (
          <div className="card p-4 text-[12px] text-ink-3 text-center">ยังไม่มีข้อมูลที่พัก</div>
        )}
      </div>

      <TravelerDrawer
        traveler={selected}
        tripId={trip?.id ?? ''}
        files={selected ? (filesByTraveler.get(selected.id) ?? []) : []}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
