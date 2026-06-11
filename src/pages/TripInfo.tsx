import { useMemo, useState } from 'react'
import {
  IconPlaneDeparture, IconPlaneArrival, IconMapPin, IconUserPlus, IconPlus,
  IconBed, IconHash, IconPlane, IconPencil, IconTrash,
} from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { Avatar } from '@/components/Avatar'
import { TravelerDrawer, KIND_META } from '@/components/TravelerDrawer'
import { TravelerEditor } from '@/components/TravelerEditor'
import { FlightEditor } from '@/components/FlightEditor'
import { HotelEditor } from '@/components/HotelEditor'
import { HotelPhoto } from '@/components/HotelPhoto'
import { AttachLink } from '@/components/AttachLink'
import { PopMenu } from '@/components/PopMenu'
import { openMap } from '@/lib/maps'
import { getSignedUrl, isSampleFile } from '@/lib/files'
import { flightDuration, formatFlightDate, formatCheckTime } from '@/lib/format'
import { travelerColor, ORDER } from '@/lib/avatars'
import {
  addTraveler, updateTraveler, deleteTraveler,
  addFlight, updateFlight, deleteFlight,
  addHotel, updateHotel, deleteHotel,
} from '@/lib/tripMutations'
import type { Flight, Hotel, Traveler, TravelerFile } from '@/lib/database.types'

type EditState<T> = 'new' | T | null

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
    <button onClick={() => openMap(url)}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-brand-dark shrink-0"
      style={{ border: '0.5px solid var(--color-brand-border)', background: 'var(--color-brand-soft)' }}>
      <IconMapPin size={12} /> AMap
    </button>
  )
}

async function viewFile(f: TravelerFile) {
  if (isSampleFile(f.storage_path)) {
    alert('นี่เป็นไฟล์ตัวอย่าง — แตะ "เพิ่มไฟล์" เพื่ออัปโหลดไฟล์จริง (QR / Arrival card / Visa) แล้วจะเปิดดูได้')
    return
  }
  const url = await getSignedUrl(f.storage_path)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  Confirmed: { bg: 'var(--color-brand-soft)', fg: 'var(--color-brand-dark)' },
  Pending: { bg: '#FDF1DF', fg: '#9A6212' },
  Cancelled: { bg: '#F6E8E3', fg: '#A23E1C' },
}

function FlightCard({ flights, tripId, onEdit, onDelete }: {
  flights: Flight[]
  tripId: string
  onEdit: (f: Flight) => void
  onDelete: (f: Flight) => void
}) {
  const { travelers } = useTrip()
  const [dir, setDir] = useState<'outbound' | 'return'>('outbound')
  const f = flights.find((x) => (x.direction ?? 'outbound') === dir) ?? flights[0]
  if (!f) return null
  const Icon = dir === 'return' ? IconPlaneArrival : IconPlaneDeparture
  const status = f.status || 'Confirmed'
  const stStyle = STATUS_STYLE[status] ?? STATUS_STYLE.Confirmed

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={16} className="text-brand shrink-0" />
          <span className="text-[13px] font-medium truncate">{f.flight_no} · {f.airline}</span>
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0"
            style={{ background: stStyle.bg, color: stStyle.fg }}>
            {status}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* segmented toggle */}
          <div className="relative inline-flex rounded-full bg-surface-2 p-0.5">
            <span className="absolute top-0.5 bottom-0.5 rounded-full bg-brand transition-all duration-200"
              style={{ width: 'calc(50% - 2px)', left: dir === 'outbound' ? '2px' : 'calc(50%)' }} />
            {(['outbound', 'return'] as const).map((d) => (
              <button key={d} onClick={() => setDir(d)}
                className={['relative z-10 px-3 h-6 rounded-full text-[11px] font-medium transition-colors', dir === d ? 'text-white' : 'text-ink-3'].join(' ')}>
                {d === 'outbound' ? 'ขาไป' : 'ขากลับ'}
              </button>
            ))}
          </div>
          <PopMenu items={[
            { label: 'แก้ไข', icon: <IconPencil size={15} />, onClick: () => onEdit(f) },
            { label: 'ลบ', icon: <IconTrash size={15} />, onClick: () => onDelete(f), danger: true },
          ]} />
        </div>
      </div>

      {/* route graphic — fixed columns so ขาไป/ขากลับ don't shift */}
      <div className="flex items-start mt-4">
        <div className="w-[88px] shrink-0">
          <div className="text-[22px] font-medium leading-none">{f.dep_code}</div>
          <div className="text-[11px] text-ink-3 mt-1.5 truncate">{f.dep_name}</div>
          <div className="text-[14px] mt-0.5 tabular-nums">{f.dep_time}</div>
        </div>
        <div className="flex-1 flex flex-col items-center pt-1">
          <div className="text-[11px] text-ink-3 tabular-nums">{flightDuration(f.dep_time, f.arr_time)}</div>
          <div className="w-full flex items-center my-1.5">
            <span className="size-2 rounded-full shrink-0" style={{ background: 'var(--color-brand)' }} />
            <span className="flex-1 h-px bg-line-2" />
            <span className="size-6 rounded-full bg-surface grid place-items-center shrink-0" style={{ border: '0.5px solid var(--color-line)' }}>
              <IconPlane size={13} className="text-brand" />
            </span>
            <span className="flex-1 h-px bg-line-2" />
            <span className="size-2 rounded-full shrink-0 ring-2 bg-surface" style={{ '--tw-ring-color': 'var(--color-brand)' } as React.CSSProperties} />
          </div>
          <div className="text-[11px] text-ink-3">direct</div>
        </div>
        <div className="w-[88px] shrink-0 text-right">
          <div className="text-[22px] font-medium leading-none">{f.arr_code}</div>
          <div className="text-[11px] text-ink-3 mt-1.5 truncate">{f.arr_name}</div>
          <div className="text-[14px] mt-0.5 tabular-nums">{f.arr_time}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 flex-wrap text-[11px]" style={{ borderTop: '0.5px solid var(--color-line)', paddingTop: 12 }}>
        <span className="chip">🗓 {formatFlightDate(f.flight_date)}</span>
        <span className="chip">{f.seat_class || 'Economy'} · {f.seats ?? travelers.length} seats</span>
        {f.booking_ref && (
          <span className="inline-flex items-center gap-0.5 booking-id text-[12px]"><IconHash size={12} />{f.booking_ref}</span>
        )}
        <span className="ml-auto"><AttachLink table="flights" id={f.id} tripId={tripId} storagePath={f.storage_path} /></span>
      </div>
    </div>
  )
}

export default function TripInfo() {
  const { trip, travelers, travelerFiles, flights, hotels, reload } = useTrip()
  const [selected, setSelected] = useState<Traveler | null>(null)
  const [travelerEdit, setTravelerEdit] = useState<EditState<Traveler>>(null)
  const [flightEdit, setFlightEdit] = useState<EditState<Flight>>(null)
  const [hotelEdit, setHotelEdit] = useState<EditState<Hotel>>(null)

  const filesByTraveler = useMemo(() => {
    const m = new Map<string, TravelerFile[]>()
    for (const f of travelerFiles) {
      if (!m.has(f.traveler_id)) m.set(f.traveler_id, [])
      m.get(f.traveler_id)!.push(f)
    }
    return m
  }, [travelerFiles])

  const colorOf = (t: Traveler) => travelerColor(t, travelers.findIndex((x) => x.id === t.id))
  const nextColor = ORDER[travelers.length % ORDER.length]

  return (
    <div>
      {/* Travelers */}
      <SectionHead title="ผู้เดินทาง"
        action={<button onClick={() => setTravelerEdit('new')} className="btn-link flex items-center gap-1"><IconUserPlus size={14} /> เพิ่มคน</button>} />
      <div className="grid sm:grid-cols-2 gap-2.5">
        {travelers.map((t, i) => {
          const files = filesByTraveler.get(t.id) ?? []
          return (
            <button key={t.id} onClick={() => setSelected(t)} className="card p-3.5 text-left hover:bg-surface-2/30">
              <div className="flex items-center gap-2.5">
                <Avatar name={t.nickname} color={travelerColor(t, i)} size={34} ring={false} />
                <div className="min-w-0">
                  <div className="text-[14px] font-medium leading-tight">{t.nickname}</div>
                  {t.full_name && <div className="text-[11px] text-ink-3 truncate">{t.full_name}</div>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {files.map((f) => {
                  const meta = KIND_META[f.kind ?? 'other'] ?? KIND_META.other
                  return (
                    <span key={f.id} onClick={(e) => { e.stopPropagation(); viewFile(f) }} className="chip hover:bg-surface-2 cursor-pointer">
                      <meta.icon size={12} /> {f.label || meta.label}
                    </span>
                  )
                })}
                <span onClick={(e) => { e.stopPropagation(); setSelected(t) }} className="chip !text-brand-mid hover:bg-brand-soft cursor-pointer">
                  <IconPlus size={12} /> เพิ่มไฟล์
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Flights */}
      <SectionHead title="ไฟลต์"
        action={<button onClick={() => setFlightEdit('new')} className="btn-link flex items-center gap-1"><IconPlus size={14} /> เพิ่มไฟลต์</button>} />
      {flights.length === 0 ? (
        <div className="card p-4 text-[12px] text-ink-3 text-center">ยังไม่มีข้อมูลไฟลต์</div>
      ) : (
        <FlightCard flights={flights} tripId={trip?.id ?? ''} onEdit={(f) => setFlightEdit(f)}
          onDelete={async (f) => { if (confirm('ลบไฟลต์นี้?')) { await deleteFlight(f.id); await reload() } }} />
      )}

      {/* Hotels */}
      <SectionHead title="ที่พัก"
        action={<button onClick={() => setHotelEdit('new')} className="btn-link flex items-center gap-1"><IconPlus size={14} /> เพิ่มที่พัก</button>} />
      <div className="space-y-2.5">
        {hotels.map((h) => (
          <div key={h.id} className="card p-4">
            <div className="flex items-start gap-3">
              <HotelPhoto photoPath={h.photo_path} name={h.name} size={56} />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium leading-tight">{h.name}</div>
                <div className="text-[11px] text-ink-3 mt-0.5">{h.city} · {h.nights} คืน</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <AMapPill url={h.map_url} />
                <PopMenu items={[
                  { label: 'แก้ไข', icon: <IconPencil size={15} />, onClick: () => setHotelEdit(h) },
                  { label: 'ลบ', icon: <IconTrash size={15} />, onClick: async () => { if (confirm('ลบที่พักนี้?')) { await deleteHotel(h.id); await reload() } }, danger: true },
                ]} />
              </div>
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
              {trip && <AttachLink table="hotels" id={h.id} tripId={trip.id} storagePath={h.storage_path} attachLabel="ใบจอง" viewLabel="ดูใบจอง" />}
            </div>
          </div>
        ))}
        {hotels.length === 0 && <div className="card p-4 text-[12px] text-ink-3 text-center">ยังไม่มีข้อมูลที่พัก</div>}
      </div>

      {/* Overview drawer */}
      <TravelerDrawer
        traveler={selected}
        tripId={trip?.id ?? ''}
        color={selected ? colorOf(selected) : undefined}
        files={selected ? (filesByTraveler.get(selected.id) ?? []) : []}
        open={!!selected}
        onClose={() => setSelected(null)}
        onEdit={() => { if (selected) { setTravelerEdit(selected); setSelected(null) } }}
      />

      {/* Editors */}
      <TravelerEditor
        open={travelerEdit !== null}
        onClose={() => setTravelerEdit(null)}
        initial={travelerEdit && travelerEdit !== 'new' ? travelerEdit : null}
        defaultColor={travelerEdit && travelerEdit !== 'new' ? colorOf(travelerEdit) : nextColor}
        onSave={async (fields) => {
          if (travelerEdit === 'new' || !travelerEdit) await addTraveler(trip!.id, fields)
          else await updateTraveler(travelerEdit.id, fields)
          await reload()
        }}
        onDelete={travelerEdit && travelerEdit !== 'new'
          ? async () => { await deleteTraveler(travelerEdit.id); await reload() }
          : undefined}
      />
      <FlightEditor
        open={flightEdit !== null}
        onClose={() => setFlightEdit(null)}
        initial={flightEdit && flightEdit !== 'new' ? flightEdit : null}
        onSave={async (fields) => {
          if (flightEdit === 'new' || !flightEdit) await addFlight(trip!.id, fields)
          else await updateFlight(flightEdit.id, fields)
          await reload()
        }}
        onDelete={flightEdit && flightEdit !== 'new'
          ? async () => { await deleteFlight(flightEdit.id); await reload() }
          : undefined}
      />
      <HotelEditor
        open={hotelEdit !== null}
        onClose={() => setHotelEdit(null)}
        initial={hotelEdit && hotelEdit !== 'new' ? hotelEdit : null}
        tripId={trip?.id ?? ''}
        onSave={async (fields) => {
          if (hotelEdit === 'new' || !hotelEdit) await addHotel(trip!.id, fields)
          else await updateHotel(hotelEdit.id, fields)
          await reload()
        }}
        onDelete={hotelEdit && hotelEdit !== 'new'
          ? async () => { await deleteHotel(hotelEdit.id); await reload() }
          : undefined}
      />
    </div>
  )
}
