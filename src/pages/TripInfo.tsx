import { useMemo, useState } from 'react'
import {
  IconPlaneDeparture, IconPlaneArrival, IconMapPin, IconUserPlus, IconPlus,
  IconBed, IconPlane, IconPencil, IconTrash, IconTrain,
} from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar } from '@/components/Avatar'
import { TravelerDrawer, KIND_META } from '@/components/TravelerDrawer'
import { TravelerEditor } from '@/components/TravelerEditor'
import { FlightEditor } from '@/components/FlightEditor'
import { TrainEditor } from '@/components/TrainEditor'
import { HotelEditor } from '@/components/HotelEditor'
import { HotelPhoto } from '@/components/HotelPhoto'
import { BudgetSection } from '@/components/BudgetSection'
import { AttachLink } from '@/components/AttachLink'
import { PopMenu } from '@/components/PopMenu'
import { openMap } from '@/lib/maps'
import { confirmDialog } from '@/lib/confirm'
import { offerUndo } from '@/lib/undo'
import { toast } from '@/lib/toast'
import { getSignedUrl, isSampleFile } from '@/lib/files'
import { flightDuration, formatFlightDate, formatCheckTime } from '@/lib/format'
import { travelerColor, ORDER } from '@/lib/avatars'
import {
  addTraveler, updateTraveler, deleteTraveler,
  addFlight, updateFlight, deleteFlight,
  addTrain, updateTrain, deleteTrain,
  addHotel, updateHotel, deleteHotel, updateProfile,
} from '@/lib/tripMutations'
import type { Flight, Train, FlightDirection, Hotel, Traveler, TravelerFile } from '@/lib/database.types'

type EditState<T> = 'new' | T | null

function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2.5 mt-7 first:mt-0">
      <h2 className="text-[13px] font-medium text-ink-2">{title}</h2>
      {action}
    </div>
  )
}

interface DetailItem { label: string; value: React.ReactNode; booking?: boolean }

// One full-width row of labelled values — columns stretch edge to edge; the first
// hugs the left, the last hugs the right (empty values are dropped).
function DetailRow({ items }: { items: DetailItem[] }) {
  const present = items.filter((it) => it.value != null && it.value !== '')
  if (!present.length) return null
  return (
    <div className="grid gap-x-2" style={{ gridTemplateColumns: `repeat(${present.length}, minmax(0,1fr))` }}>
      {present.map((it, i) => {
        const align = present.length === 1 ? 'text-left'
          : i === 0 ? 'text-left' : i === present.length - 1 ? 'text-right' : 'text-center'
        return (
          <div key={i} className={`min-w-0 ${align}`}>
            <div className="text-[10px] text-ink-3">{it.label}</div>
            <div className={`text-[12px] mt-0.5 truncate ${it.booking ? 'booking-id' : 'font-medium'}`}>{it.value}</div>
          </div>
        )
      })}
    </div>
  )
}

function AMapPill({ url }: { url: string | null }) {
  if (!url) return null
  return (
    <button onClick={() => openMap(url)}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-brand-dark shrink-0"
      style={{ border: '0.5px solid var(--color-brand-border)', background: 'var(--color-brand-soft)' }}>
      <IconMapPin size={12} /> MAP
    </button>
  )
}

async function viewFile(f: TravelerFile) {
  if (isSampleFile(f.storage_path)) {
    toast.info('นี่เป็นไฟล์ตัวอย่าง — แตะ "เพิ่มไฟล์" เพื่ออัปโหลดไฟล์จริง (QR / Arrival card / Visa) แล้วจะเปิดดูได้')
    return
  }
  const url = await getSignedUrl(f.storage_path)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

function FlightCard({ flights, tripId, canEdit, onEdit, onDelete, onAdd }: {
  flights: Flight[]
  tripId: string
  canEdit: boolean
  onEdit: (f: Flight) => void
  onDelete: (f: Flight) => void
  onAdd: (dir: FlightDirection) => void
}) {
  const { travelers } = useTrip()
  const [dir, setDir] = useState<FlightDirection>('outbound')
  // show the flight for the selected direction only — never fall back to the
  // other direction (that let editing the "return" tab overwrite the outbound)
  const f = flights.find((x) => (x.direction ?? 'outbound') === dir)
  const Icon = dir === 'return' ? IconPlaneArrival : IconPlaneDeparture
  const dirLabel = dir === 'return' ? 'ขากลับ' : 'ขาไป'

  const toggle = (
    <div className="relative inline-flex rounded-full bg-surface-2 p-0.5 shrink-0">
      <span className="absolute top-0.5 bottom-0.5 rounded-full bg-brand transition-all duration-200"
        style={{ width: 'calc(50% - 2px)', left: dir === 'outbound' ? '2px' : 'calc(50%)' }} />
      {(['outbound', 'return'] as const).map((d) => (
        <button key={d} onClick={() => setDir(d)}
          className={['relative z-10 px-3.5 h-7 rounded-full text-[12px] font-medium transition-colors', dir === d ? 'text-white' : 'text-ink-3'].join(' ')}>
          {d === 'outbound' ? 'ขาไป' : 'ขากลับ'}
        </button>
      ))}
    </div>
  )

  return (
    <div className="card p-4">
      <div className="flex items-start gap-2">
        <Icon size={16} className="text-brand shrink-0 mt-1" />
        <div className="min-w-0 flex-1 flex items-center gap-2">
          {f?.flight_date && <span className="inline-flex items-center rounded-full text-white text-[13px] font-medium px-2.5 py-0.5 shrink-0" style={{ background: 'var(--color-ink)' }}>{formatFlightDate(f.flight_date)}</span>}
          <div className="text-[13px] font-medium truncate">{f ? `${f.flight_no} · ${f.airline}` : `เที่ยวบิน${dirLabel}`}</div>
        </div>
        {canEdit && f && (
          <PopMenu items={[
            { label: 'แก้ไข', icon: <IconPencil size={15} />, onClick: () => onEdit(f) },
            { label: 'ลบ', icon: <IconTrash size={15} />, onClick: () => onDelete(f), danger: true },
          ]} />
        )}
      </div>

      {!f ? (
        <div className="text-center py-7">
          <p className="text-[12px] text-ink-3">ยังไม่มีเที่ยวบิน{dirLabel}</p>
          {canEdit && (
            <button onClick={() => onAdd(dir)} className="btn-link inline-flex items-center gap-1 mt-2"><IconPlus size={14} /> เพิ่มเที่ยวบิน{dirLabel}</button>
          )}
        </div>
      ) : (
      <>
      {/* route graphic — fixed columns so ขาไป/ขากลับ don't shift */}
      <div className="flex items-start mt-4">
        <div className="w-[88px] shrink-0">
          <div className="text-[22px] font-medium leading-none">{f.dep_code}</div>
          <div className="text-[11px] text-ink-3 mt-1.5 truncate">{f.dep_name}</div>
          <div className="text-[14px] mt-0.5 tabular-nums">{f.dep_time}</div>
        </div>
        <div className="flex-1 flex flex-col items-center pt-1">
          <div className="text-[11px] text-ink-3 tabular-nums">{flightDuration(f.dep_time, f.arr_time, f.dep_tz, f.arr_tz, f.flight_date)}</div>
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

      <div className="mt-4 pt-3" style={{ borderTop: '0.5px solid var(--color-line)' }}>
        <DetailRow items={[
          { label: 'ชั้นโดยสาร', value: f.seat_class || 'Economy' },
          { label: 'ที่นั่ง', value: `${f.seats ?? travelers.length}` },
          { label: 'รหัสจอง', value: f.booking_ref, booking: true },
        ]} />
      </div>
      </>
      )}

      {/* attach (left) + ขาไป/ขากลับ toggle (right) on one line */}
      <div className="flex items-center justify-between gap-2 mt-3.5">
        {f ? <AttachLink table="flights" id={f.id} tripId={tripId} storagePath={f.storage_path} canEdit={canEdit} /> : <span />}
        {toggle}
      </div>
    </div>
  )
}

function TrainCard({ trains, tripId, canEdit, onEdit, onDelete, onAdd }: {
  trains: Train[]
  tripId: string
  canEdit: boolean
  onEdit: (t: Train) => void
  onDelete: (t: Train) => void
  onAdd: (dir: FlightDirection) => void
}) {
  const [dir, setDir] = useState<FlightDirection>('outbound')
  const t = trains.find((x) => (x.direction ?? 'outbound') === dir)
  const dirLabel = dir === 'return' ? 'ขากลับ' : 'ขาไป'

  const toggle = (
    <div className="relative inline-flex rounded-full bg-surface-2 p-0.5 shrink-0">
      <span className="absolute top-0.5 bottom-0.5 rounded-full bg-brand transition-all duration-200"
        style={{ width: 'calc(50% - 2px)', left: dir === 'outbound' ? '2px' : 'calc(50%)' }} />
      {(['outbound', 'return'] as const).map((d) => (
        <button key={d} onClick={() => setDir(d)}
          className={['relative z-10 px-3.5 h-7 rounded-full text-[12px] font-medium transition-colors', dir === d ? 'text-white' : 'text-ink-3'].join(' ')}>
          {d === 'outbound' ? 'ขาไป' : 'ขากลับ'}
        </button>
      ))}
    </div>
  )

  return (
    <div className="card p-4">
      <div className="flex items-start gap-2">
        <IconTrain size={16} className="text-brand shrink-0 mt-1" />
        <div className="min-w-0 flex-1 flex items-center gap-2">
          {t?.travel_date && <span className="inline-flex items-center rounded-full text-white text-[13px] font-medium px-2.5 py-0.5 shrink-0" style={{ background: 'var(--color-ink)' }}>{formatFlightDate(t.travel_date)}</span>}
          <div className="text-[13px] font-medium truncate">{t ? `${t.train_no} · ${t.operator}` : `รถไฟ${dirLabel}`}</div>
        </div>
        {canEdit && t && (
          <PopMenu items={[
            { label: 'แก้ไข', icon: <IconPencil size={15} />, onClick: () => onEdit(t) },
            { label: 'ลบ', icon: <IconTrash size={15} />, onClick: () => onDelete(t), danger: true },
          ]} />
        )}
      </div>

      {!t ? (
        <div className="text-center py-7">
          <p className="text-[12px] text-ink-3">ยังไม่มีรถไฟ{dirLabel}</p>
          {canEdit && (
            <button onClick={() => onAdd(dir)} className="btn-link inline-flex items-center gap-1 mt-2"><IconPlus size={14} /> เพิ่มรถไฟ{dirLabel}</button>
          )}
        </div>
      ) : (
      <>
      <div className="flex items-start mt-4">
        <div className="w-[96px] shrink-0">
          <div className="text-[14px] font-medium leading-tight truncate">{t.dep_name}</div>
          <div className="text-[14px] mt-1 tabular-nums">{t.dep_time}</div>
        </div>
        <div className="flex-1 flex flex-col items-center pt-1">
          <div className="text-[11px] text-ink-3 tabular-nums">{flightDuration(t.dep_time, t.arr_time, t.dep_tz, t.arr_tz, t.travel_date)}</div>
          <div className="w-full flex items-center my-1.5">
            <span className="size-2 rounded-full shrink-0" style={{ background: 'var(--color-brand)' }} />
            <span className="flex-1 h-px bg-line-2" />
            <span className="size-6 rounded-full bg-surface grid place-items-center shrink-0" style={{ border: '0.5px solid var(--color-line)' }}>
              <IconTrain size={13} className="text-brand" />
            </span>
            <span className="flex-1 h-px bg-line-2" />
            <span className="size-2 rounded-full shrink-0 ring-2 bg-surface" style={{ '--tw-ring-color': 'var(--color-brand)' } as React.CSSProperties} />
          </div>
          <div className="text-[11px] text-ink-3">direct</div>
        </div>
        <div className="w-[96px] shrink-0 text-right">
          <div className="text-[14px] font-medium leading-tight truncate">{t.arr_name}</div>
          <div className="text-[14px] mt-1 tabular-nums">{t.arr_time}</div>
        </div>
      </div>

      <div className="mt-4 pt-3 space-y-3" style={{ borderTop: '0.5px solid var(--color-line)' }}>
        <DetailRow items={[
          { label: 'ชั้นโดยสาร', value: t.seat_class },
          { label: 'ประตู', value: t.gate },
          { label: 'ตู้', value: t.car },
        ]} />
        <DetailRow items={[
          { label: 'ที่นั่ง', value: t.seat_no },
          { label: 'รหัสจอง', value: t.booking_ref, booking: true },
        ]} />
      </div>
      </>
      )}

      {/* attach (left) + ขาไป/ขากลับ toggle (right) on one line */}
      <div className="flex items-center justify-between gap-2 mt-3.5">
        {t ? <AttachLink table="trains" id={t.id} tripId={tripId} storagePath={t.storage_path} canEdit={canEdit} /> : <span />}
        {toggle}
      </div>
    </div>
  )
}

export default function TripInfo() {
  const { trip, travelers, travelerFiles, flights, trains, hotels, profile, reload, canEdit } = useTrip()
  const { user } = useAuth()
  const [selected, setSelected] = useState<Traveler | null>(null)
  const [travelerEdit, setTravelerEdit] = useState<EditState<Traveler>>(null)
  const [flightEdit, setFlightEdit] = useState<EditState<Flight>>(null)
  const [newFlightDir, setNewFlightDir] = useState<FlightDirection>('outbound')
  const [trainEdit, setTrainEdit] = useState<EditState<Train>>(null)
  const [newTrainDir, setNewTrainDir] = useState<FlightDirection>('outbound')
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
      <SectionHead title="Travelers • ผู้เดินทาง"
        action={canEdit ? <button onClick={() => setTravelerEdit('new')} className="btn-link flex items-center gap-1"><IconUserPlus size={14} /> เพิ่มคน</button> : undefined} />
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
                {canEdit && (
                  <span onClick={(e) => { e.stopPropagation(); setSelected(t) }} className="chip !text-brand-mid hover:bg-brand-soft cursor-pointer">
                    <IconPlus size={12} /> เพิ่มไฟล์
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Flights */}
      <SectionHead title="Flights • ข้อมูลเที่ยวบิน"
        action={canEdit ? <button onClick={() => { setNewFlightDir(flights.some((f) => (f.direction ?? 'outbound') === 'outbound') ? 'return' : 'outbound'); setFlightEdit('new') }} className="btn-link flex items-center gap-1"><IconPlus size={14} /> เพิ่มเที่ยวบิน</button> : undefined} />
      {flights.length === 0 ? (
        <div className="card p-4 text-[12px] text-ink-3 text-center">ยังไม่มีข้อมูลไฟลต์</div>
      ) : (
        <FlightCard flights={flights} tripId={trip?.id ?? ''} canEdit={canEdit} onEdit={(f) => setFlightEdit(f)}
          onAdd={(d) => { setNewFlightDir(d); setFlightEdit('new') }}
          onDelete={async (f) => { if (await confirmDialog({ message: 'ลบไฟลต์นี้?', danger: true, confirmLabel: 'ลบ' })) { await deleteFlight(f.id); await reload(); offerUndo('ลบไฟลต์แล้ว', [{ table: 'flights', rows: [f] }], reload) } }} />
      )}

      {/* Trains */}
      <SectionHead title="Trains • ข้อมูลรถไฟ"
        action={canEdit ? <button onClick={() => { setNewTrainDir(trains.some((t) => (t.direction ?? 'outbound') === 'outbound') ? 'return' : 'outbound'); setTrainEdit('new') }} className="btn-link flex items-center gap-1"><IconPlus size={14} /> เพิ่มรถไฟ</button> : undefined} />
      {trains.length === 0 ? (
        <div className="card p-4 text-[12px] text-ink-3 text-center">ยังไม่มีข้อมูลรถไฟ</div>
      ) : (
        <TrainCard trains={trains} tripId={trip?.id ?? ''} canEdit={canEdit} onEdit={(t) => setTrainEdit(t)}
          onAdd={(d) => { setNewTrainDir(d); setTrainEdit('new') }}
          onDelete={async (t) => { if (await confirmDialog({ message: 'ลบรถไฟนี้?', danger: true, confirmLabel: 'ลบ' })) { await deleteTrain(t.id); await reload(); offerUndo('ลบรถไฟแล้ว', [{ table: 'trains', rows: [t] }], reload) } }} />
      )}

      {/* Hotels */}
      <SectionHead title="Hotels • ที่พัก"
        action={canEdit ? <button onClick={() => setHotelEdit('new')} className="btn-link flex items-center gap-1"><IconPlus size={14} /> เพิ่มที่พัก</button> : undefined} />
      <div className="space-y-2.5">
        {hotels.map((h) => (
          <div key={h.id} className="card p-4">
            <div className="flex gap-3.5">
              <HotelPhoto photoPath={h.photo_path} name={h.name} size={84} radius={12} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium leading-tight">{h.name}</div>
                    <div className="text-[11px] text-ink-3 mt-0.5">{h.city} · {h.nights} คืน</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <AMapPill url={h.map_url} />
                    {canEdit && (
                      <PopMenu items={[
                        { label: 'แก้ไข', icon: <IconPencil size={15} />, onClick: () => setHotelEdit(h) },
                        { label: 'ลบ', icon: <IconTrash size={15} />, onClick: async () => { if (await confirmDialog({ message: 'ลบที่พักนี้?', danger: true, confirmLabel: 'ลบ' })) { await deleteHotel(h.id); await reload(); offerUndo('ลบที่พักแล้ว', [{ table: 'hotels', rows: [h] }], reload) } }, danger: true },
                      ]} />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
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
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mt-3.5 flex-wrap">
              <div className="flex flex-wrap gap-1.5">
                {h.rooms?.map((r, i) => (
                  <span key={i} className="chip"><IconBed size={12} /> {r.name} · {r.members.join(', ')}</span>
                ))}
              </div>
              {trip && <AttachLink table="hotels" id={h.id} tripId={trip.id} storagePath={h.storage_path} attachLabel="ใบจอง" viewLabel="ดูใบจอง" canEdit={canEdit} />}
            </div>
          </div>
        ))}
        {hotels.length === 0 && <div className="card p-4 text-[12px] text-ink-3 text-center">ยังไม่มีข้อมูลที่พัก</div>}
      </div>

      {/* Budget */}
      <SectionHead title="Budget • ค่าใช้จ่าย" />
      <BudgetSection />

      {/* Overview drawer */}
      <TravelerDrawer
        traveler={selected}
        tripId={trip?.id ?? ''}
        color={selected ? colorOf(selected) : undefined}
        files={selected ? (filesByTraveler.get(selected.id) ?? []) : []}
        open={!!selected}
        canEdit={canEdit}
        onClose={() => setSelected(null)}
        onEdit={canEdit ? () => { if (selected) { setTravelerEdit(selected); setSelected(null) } } : undefined}
      />

      {/* Editors */}
      <TravelerEditor
        open={travelerEdit !== null}
        onClose={() => setTravelerEdit(null)}
        initial={travelerEdit && travelerEdit !== 'new' ? travelerEdit : null}
        defaultColor={travelerEdit && travelerEdit !== 'new' ? colorOf(travelerEdit) : nextColor}
        onSave={async (fields) => {
          if (travelerEdit === 'new' || !travelerEdit) await addTraveler(trip!.id, fields)
          else {
            await updateTraveler(travelerEdit.id, fields)
            // if this traveler is "me", keep my profile name/colour in sync
            if (user && profile?.nickname && travelerEdit.nickname
              && travelerEdit.nickname.trim().toLowerCase() === profile.nickname.trim().toLowerCase()) {
              await updateProfile(user.id, { nickname: fields.nickname, avatar_color: fields.avatar_color })
            }
          }
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
        defaultDirection={newFlightDir}
        prefillFrom={flights.find((f) => (f.direction ?? 'outbound') === 'outbound') ?? null}
        onSwitchDirection={async (dir, current) => {
          // save the leg being edited first, so switching tabs never loses its edits
          if (flightEdit && flightEdit !== 'new') await updateFlight(flightEdit.id, current)
          else if (current.airline || current.flight_no || current.dep_code || current.arr_code || current.flight_date) await addFlight(trip!.id, current)
          await reload()
          // toggle in the editor = jump to that leg's real flight, or an add form for it
          const existing = flights.find((f) => (f.direction ?? 'outbound') === dir)
          if (existing) setFlightEdit(existing)
          else { setNewFlightDir(dir); setFlightEdit('new') }
        }}
        onSave={async (fields) => {
          const isNew = flightEdit === 'new' || !flightEdit
          const savedDir = fields.direction ?? 'outbound'
          const hadReturn = flights.some((f) => (f.direction ?? 'outbound') === 'return')
          if (isNew) await addFlight(trip!.id, fields)
          else await updateFlight(flightEdit.id, fields)
          await reload()
          // After adding a NEW outbound leg (and no return exists yet), offer to
          // add the return right away — swapping the editor to a prefilled return
          // form so the user can keep going without hunting for the add button.
          if (isNew && savedDir === 'outbound' && !hadReturn) {
            const addReturn = await confirmDialog({
              title: 'เพิ่มเที่ยวบินขากลับ?',
              message: 'มีเที่ยวบินขากลับไหม? เพิ่มต่อเลยได้ ระบบเติมข้อมูลจากขาไปให้แล้ว',
              confirmLabel: 'เพิ่มขากลับ',
              cancelLabel: 'ไว้ทีหลัง',
            })
            if (addReturn) {
              setNewFlightDir('return')
              setFlightEdit('new')
              return true // keep the drawer open; it remounts as the return form
            }
          }
        }}
        onDelete={flightEdit && flightEdit !== 'new'
          ? async () => { await deleteFlight(flightEdit.id); await reload() }
          : undefined}
      />
      <TrainEditor
        open={trainEdit !== null}
        onClose={() => setTrainEdit(null)}
        initial={trainEdit && trainEdit !== 'new' ? trainEdit : null}
        defaultDirection={newTrainDir}
        prefillFrom={trains.find((t) => (t.direction ?? 'outbound') === 'outbound') ?? null}
        onSwitchDirection={async (dir, current) => {
          // save the leg being edited first, so switching tabs never loses its edits
          if (trainEdit && trainEdit !== 'new') await updateTrain(trainEdit.id, current)
          else if (current.operator || current.train_no || current.dep_name || current.arr_name || current.travel_date) await addTrain(trip!.id, current)
          await reload()
          const existing = trains.find((t) => (t.direction ?? 'outbound') === dir)
          if (existing) setTrainEdit(existing)
          else { setNewTrainDir(dir); setTrainEdit('new') }
        }}
        onSave={async (fields) => {
          const isNew = trainEdit === 'new' || !trainEdit
          const savedDir = fields.direction ?? 'outbound'
          const hadReturn = trains.some((t) => (t.direction ?? 'outbound') === 'return')
          if (isNew) await addTrain(trip!.id, fields)
          else await updateTrain(trainEdit.id, fields)
          await reload()
          if (isNew && savedDir === 'outbound' && !hadReturn) {
            const addReturn = await confirmDialog({
              title: 'เพิ่มรถไฟขากลับ?',
              message: 'มีรถไฟขากลับไหม? เพิ่มต่อเลยได้ ระบบเติมข้อมูลจากขาไปให้แล้ว',
              confirmLabel: 'เพิ่มขากลับ',
              cancelLabel: 'ไว้ทีหลัง',
            })
            if (addReturn) {
              setNewTrainDir('return')
              setTrainEdit('new')
              return true
            }
          }
        }}
        onDelete={trainEdit && trainEdit !== 'new'
          ? async () => { await deleteTrain(trainEdit.id); await reload() }
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
