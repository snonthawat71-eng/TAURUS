import { useEffect, useMemo, useState } from 'react'
import {
  IconPlaneDeparture, IconPlaneArrival, IconMapPin, IconUserPlus, IconPlus,
  IconBed, IconPlane, IconPencil, IconTrash, IconTrain, IconQrcode, IconChevronDown,
  IconLock, IconUsers, IconUserCheck,
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
import { TravelerQr } from '@/components/TravelerQr'
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
  addTraveler, updateTraveler, deleteTraveler, claimTraveler, setTravelerPrivacy,
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

// "now" in a timezone as a sortable 'YYYY-MM-DDTHH:mm' string (the trip's tz, set
// at creation) so leg date+time compare in the same frame regardless of device tz.
function nowInTz(tz: string | null | undefined): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date())
    const g = (t: string) => parts.find((x) => x.type === t)?.value ?? ''
    return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`
  } catch {
    return new Date().toISOString().slice(0, 16)
  }
}

// Auto-pick the leg to show by the trip's clock (nowStr = now in trip tz): outbound
// until it ends, then return until it ends, then reset to outbound. A single leg /
// no return always shows outbound.
function autoLegDir<T>(legs: T[], nowStr: string, get: (l: T) => { dir: string; date: string | null; dep: string | null; arr: string | null }): FlightDirection {
  const rows = legs.map(get)
  const out = rows.find((x) => (x.dir || 'outbound') === 'outbound')
  const ret = rows.find((x) => (x.dir || 'outbound') === 'return')
  if (!ret) return 'outbound'
  if (!out) return 'return'
  const end = (x: { date: string | null; dep: string | null; arr: string | null }) => {
    if (!x.date) return null
    let date = x.date
    // arrival clock earlier than departure = an overnight leg landing the NEXT day
    if (x.arr && x.dep && x.arr < x.dep) {
      const d = new Date(`${x.date}T00:00:00Z`)
      if (!isNaN(d.getTime())) date = new Date(d.getTime() + 86400000).toISOString().slice(0, 10)
    }
    return `${date}T${x.arr || x.dep || '23:59'}`
  }
  const outEnd = end(out)
  // outbound has no date → can't tell it's over; keep showing the outbound
  if (outEnd == null || nowStr < outEnd) return 'outbound'
  const retEnd = end(ret)
  if (retEnd != null && nowStr >= retEnd) return 'outbound' // return is over → reset
  return 'return'
}

function FlightCard({ flights, tripId, canEdit, onEdit, onDelete, onAdd }: {
  flights: Flight[]
  tripId: string
  canEdit: boolean
  onEdit: (f: Flight) => void
  onDelete: (f: Flight) => void
  onAdd: (dir: FlightDirection) => void
}) {
  const { travelers, trip } = useTrip()
  // default leg follows the trip's clock (ข้อ 1); a manual toggle overrides until collapse
  const autoDir = useMemo(() => autoLegDir(flights, nowInTz(trip?.timezone), (f) => ({ dir: f.direction ?? 'outbound', date: f.flight_date, dep: f.dep_time, arr: f.arr_time })), [flights, trip?.timezone])
  const [manualDir, setManualDir] = useState<FlightDirection | null>(null)
  const [open, setOpen] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  const dir = manualDir ?? autoDir
  const f = flights.find((x) => (x.direction ?? 'outbound') === dir)
  const Icon = dir === 'return' ? IconPlaneArrival : IconPlaneDeparture
  const dirLabel = dir === 'return' ? 'ขากลับ' : 'ขาไป'
  // airline logo from the flight number's IATA prefix (e.g. FM848 → FM);
  // falls back to the plane icon when unknown or the CDN has no image
  const airlineCode = (f?.flight_no ?? '').trim().toUpperCase().match(/^([A-Z0-9]{2})\s*[A-Z0-9]*\d/)?.[1] ?? null
  const logoUrl = airlineCode ? `https://images.kiwi.com/airlines/64/${airlineCode}.png` : null
  useEffect(() => { setLogoFailed(false) }, [logoUrl])

  const chevron = f && (
    <button onClick={() => setOpen((o) => { const n = !o; if (!n) setManualDir(null); return n })}
      className="!size-[22px] grid place-items-center rounded-md text-white/90 hover:bg-white/15 shrink-0" aria-label={open ? 'พับ' : 'เปิด'} aria-expanded={open}>
      <IconChevronDown size={15} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
    </button>
  )
  const menu = canEdit && f && (
    <PopMenu size={22} buttonClassName="!bg-transparent !text-white hover:!bg-white/15" items={[
      { label: 'แก้ไข', icon: <IconPencil size={15} />, onClick: () => onEdit(f) },
      { label: 'ลบ', icon: <IconTrash size={15} />, onClick: () => onDelete(f), danger: true },
    ]} />
  )

  // ---- no flight for this leg ----
  if (!f) {
    return (
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-brand shrink-0" />
          <div className="text-[13px] font-medium flex-1 truncate">เที่ยวบิน{dirLabel}</div>
        </div>
        <div className="text-center py-7">
          <p className="text-[12px] text-ink-3">ยังไม่มีเที่ยวบิน{dirLabel}</p>
          {canEdit && (
            <button onClick={() => onAdd(dir)} className="btn-link inline-flex items-center gap-1 mt-2"><IconPlus size={14} /> เพิ่มเที่ยวบิน{dirLabel}</button>
          )}
        </div>
      </div>
    )
  }

  // Live status (filled in by /api/check-flights + AeroDataBox). The checker
  // only polls near departure (6h before … landing), so "recently checked"
  // is exactly when the status is meaningful — an early-morning flight then
  // shows live info the evening before too, not just on the travel date.
  const liveFresh = !!f.live_checked_at &&
    Date.now() - new Date(f.live_checked_at).getTime() < 24 * 3600_000
  const LIVE_EN: Record<string, string> = {
    ontime: 'On time', delayed: `Delayed +${f.live_delay_min ?? '?'} min`, cancelled: 'Cancelled',
    diverted: 'Diverted', departed: 'Departed', arrived: 'Arrived',
  }
  const live = liveFresh && f.live_status && LIVE_EN[f.live_status]
    ? {
        label: LIVE_EN[f.live_status],
        color: f.live_status === 'cancelled' || f.live_status === 'diverted' ? '#C23B3B'
          : f.live_status === 'delayed' ? '#D97706' : '#1D9E75',
      }
    : null
  // delayed → new time full-size, struck-through scheduled time small underneath
  const stackClock = (sched: string | null, liveT: string | null, cls: string) =>
    live && f.live_status === 'delayed' && liveT && sched && liveT !== sched
      ? <>
          <div className={`${cls} tabular-nums`}>{liveT}</div>
          <div className="text-[10.5px] tabular-nums line-through opacity-45 leading-tight">{sched}</div>
        </>
      : <div className={`${cls} tabular-nums`}>{sched}</div>
  const statusPill = live && (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white whitespace-nowrap"
      style={{ background: live.color }}>
      {live.label}
    </span>
  )

  // slim strip on top (itinerary-style, nested rounded corners): date + live status + controls
  const strip = (
    <div className="relative -mb-3 pt-1 pb-4 px-3.5 rounded-t-[14px] flex items-center justify-between gap-2 text-white" style={{ background: live?.color ?? 'var(--color-brand)' }}>
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon size={14} className="shrink-0 text-white/90" />
        <span className="text-[12px] font-medium tracking-wide truncate">{f.flight_date ? formatFlightDate(f.flight_date) : `เที่ยวบิน${dirLabel}`}</span>
        {open && (f.flight_no || f.airline) && <span className="text-[11px] text-white/70 truncate">· {[f.flight_no, f.airline].filter(Boolean).join(' · ')}</span>}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">{menu}{chevron}</div>
    </div>
  )

  // ---- collapsed: condensed image-style summary under the strip ----
  if (!open) {
    return (
      <div className="relative flex flex-col">
        {strip}
        <div className="card relative p-4">
          {/* fixed-width side columns (not flex-1) so a long name is FORCED to wrap
              onto its 2 reserved lines instead of stretching out on one long line */}
          <div className="flex items-start gap-2">
            <div className="w-[104px] shrink-0">
              <div className="text-[26px] font-medium leading-none">{f.dep_code}</div>
              <div className="text-[11px] text-ink-3 mt-1.5 line-clamp-2 break-words min-h-[33px]">{f.dep_name}</div>
              {stackClock(f.dep_time, f.live_dep_time ?? null, 'text-[15px] mt-1')}
            </div>
            {/* centre: airline logo → flight no → live-status pill.
                The logo block reserves the same height as the side columns'
                code+name block (26+6+33 = 65px), so the pill lands exactly on
                the times' row below it. */}
            <div className="flex-1 min-w-0 flex flex-col items-center">
              <div className="min-h-[65px] flex flex-col items-center justify-center gap-1">
                {logoUrl && !logoFailed
                  ? <img src={logoUrl} alt={f.airline ?? 'airline'} onError={() => setLogoFailed(true)}
                      className="size-9 rounded-full object-contain bg-white hairline shrink-0" />
                  : <span className="size-9 rounded-full bg-surface-2 grid place-items-center shrink-0"><Icon size={18} className="text-brand" /></span>}
                {f.flight_no && <div className="text-[11px] font-medium text-ink-2 truncate max-w-full">{f.flight_no}</div>}
              </div>
              {live && <div className="mt-1">{statusPill}</div>}
            </div>
            <div className="w-[104px] shrink-0 text-right">
              <div className="text-[26px] font-medium leading-none">{f.arr_code}</div>
              <div className="text-[11px] text-ink-3 mt-1.5 line-clamp-2 break-words min-h-[33px]">{f.arr_name}</div>
              {stackClock(f.arr_time, f.live_arr_time ?? null, 'text-[15px] mt-1')}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---- expanded: full details under the strip ----
  const toggle = (
    <div className="relative inline-flex rounded-full bg-surface-2 p-0.5 shrink-0">
      <span className="absolute top-0.5 bottom-0.5 rounded-full bg-brand transition-all duration-200"
        style={{ width: 'calc(50% - 2px)', left: dir === 'outbound' ? '2px' : 'calc(50%)' }} />
      {(['outbound', 'return'] as const).map((d) => (
        <button key={d} onClick={() => setManualDir(d)}
          className={['relative z-10 px-3.5 h-7 rounded-full text-[12px] font-medium transition-colors', dir === d ? 'text-white' : 'text-ink-3'].join(' ')}>
          {d === 'outbound' ? 'ขาไป' : 'ขากลับ'}
        </button>
      ))}
    </div>
  )
  return (
    <div className="relative flex flex-col">
      {strip}
      <div className="card relative p-4">
      <div className="flex items-start mt-1">
        <div className="w-[88px] shrink-0">
          <div className="text-[22px] font-medium leading-none">{f.dep_code}</div>
          <div className="text-[11px] text-ink-3 mt-1.5 line-clamp-2 break-words min-h-[33px]">{f.dep_name}</div>
          {stackClock(f.dep_time, f.live_dep_time ?? null, 'text-[14px] mt-0.5')}
        </div>
        {/* centre: duration + path fill the same height as the side columns'
            code+name block (22+6+33 = 61px); the status pill (or "direct")
            then lands level with the times row, same rhythm as collapsed. */}
        <div className="flex-1 min-w-0 flex flex-col items-center px-1">
          <div className="w-full min-h-[61px] flex flex-col items-center justify-center">
            <div className="text-[11px] text-ink-3 tabular-nums">{flightDuration(f.dep_time, f.arr_time, f.dep_tz, f.arr_tz, f.flight_date)}</div>
            <div className="w-full flex items-center mt-1.5">
              <span className="size-2 rounded-full shrink-0" style={{ background: 'var(--color-brand)' }} />
              <span className="flex-1 h-px bg-line-2" />
              <span className="size-6 rounded-full bg-surface grid place-items-center shrink-0" style={{ border: '0.5px solid var(--color-line)' }}>
                <IconPlane size={13} className="text-brand" />
              </span>
              <span className="flex-1 h-px bg-line-2" />
              <span className="size-2 rounded-full shrink-0 ring-2 bg-surface" style={{ '--tw-ring-color': 'var(--color-brand)' } as React.CSSProperties} />
            </div>
          </div>
          <div className="mt-0.5">
            {live ? statusPill : <div className="text-[11px] text-ink-3">direct</div>}
          </div>
        </div>
        <div className="w-[88px] shrink-0 text-right">
          <div className="text-[22px] font-medium leading-none">{f.arr_code}</div>
          <div className="text-[11px] text-ink-3 mt-1.5 line-clamp-2 break-words min-h-[33px]">{f.arr_name}</div>
          {stackClock(f.arr_time, f.live_arr_time ?? null, 'text-[14px] mt-0.5')}
        </div>
      </div>

      <div className="mt-4 pt-3" style={{ borderTop: '0.5px solid var(--color-line)' }}>
        <DetailRow items={[
          { label: 'ชั้นโดยสาร', value: f.seat_class || 'Economy' },
          { label: 'ที่นั่ง', value: `${f.seats ?? travelers.length}` },
          { label: 'รหัสจอง', value: f.booking_ref, booking: true },
        ]} />
      </div>
      <div className="flex items-center justify-between gap-2 mt-3.5">
        <AttachLink table="flights" id={f.id} tripId={tripId} storagePath={f.storage_path} canEdit={canEdit} />
        {toggle}
      </div>
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
  const { trip } = useTrip()
  const autoDir = useMemo(() => autoLegDir(trains, nowInTz(trip?.timezone), (t) => ({ dir: t.direction ?? 'outbound', date: t.travel_date, dep: t.dep_time, arr: t.arr_time })), [trains, trip?.timezone])
  const [manualDir, setManualDir] = useState<FlightDirection | null>(null)
  const [open, setOpen] = useState(false)
  const dir = manualDir ?? autoDir
  const t = trains.find((x) => (x.direction ?? 'outbound') === dir)
  const dirLabel = dir === 'return' ? 'ขากลับ' : 'ขาไป'

  const chevron = t && (
    <button onClick={() => setOpen((o) => { const n = !o; if (!n) setManualDir(null); return n })}
      className="!size-[22px] grid place-items-center rounded-md text-white/90 hover:bg-white/15 shrink-0" aria-label={open ? 'พับ' : 'เปิด'} aria-expanded={open}>
      <IconChevronDown size={15} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
    </button>
  )
  const menu = canEdit && t && (
    <PopMenu size={22} buttonClassName="!bg-transparent !text-white hover:!bg-white/15" items={[
      { label: 'แก้ไข', icon: <IconPencil size={15} />, onClick: () => onEdit(t) },
      { label: 'ลบ', icon: <IconTrash size={15} />, onClick: () => onDelete(t), danger: true },
    ]} />
  )

  // ---- no train for this leg ----
  if (!t) {
    return (
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <IconTrain size={16} className="text-brand shrink-0" />
          <div className="text-[13px] font-medium flex-1 truncate">รถไฟ{dirLabel}</div>
        </div>
        <div className="text-center py-7">
          <p className="text-[12px] text-ink-3">ยังไม่มีรถไฟ{dirLabel}</p>
          {canEdit && (
            <button onClick={() => onAdd(dir)} className="btn-link inline-flex items-center gap-1 mt-2"><IconPlus size={14} /> เพิ่มรถไฟ{dirLabel}</button>
          )}
        </div>
      </div>
    )
  }

  // slim blue strip on top (itinerary-style, nested rounded corners): date + controls
  const strip = (
    <div className="relative -mb-3 pt-1 pb-4 px-3.5 rounded-t-[14px] flex items-center justify-between gap-2 text-white" style={{ background: 'var(--color-brand)' }}>
      <div className="flex items-center gap-1.5 min-w-0">
        <IconTrain size={14} className="shrink-0 text-white/90" />
        <span className="text-[12px] font-medium tracking-wide truncate">{t.travel_date ? formatFlightDate(t.travel_date) : `รถไฟ${dirLabel}`}</span>
        {open && (t.train_no || t.operator) && <span className="text-[11px] text-white/70 truncate">· {[t.train_no, t.operator].filter(Boolean).join(' · ')}</span>}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">{menu}{chevron}</div>
    </div>
  )

  // ---- collapsed: condensed image-style summary under the strip ----
  if (!open) {
    return (
      <div className="relative flex flex-col">
        {strip}
        <div className="card relative p-4">
          {/* fixed-width side columns (not flex-1) so a long station name is FORCED
              to wrap onto its 2 reserved lines instead of stretching on one line */}
          <div className="flex items-start gap-2">
            <div className="w-[124px] shrink-0">
              <div className="text-[16px] font-medium leading-tight line-clamp-2 break-words min-h-[40px]">{t.dep_name}</div>
              <div className="text-[15px] mt-1.5 tabular-nums">{t.dep_time}</div>
            </div>
            <div className="flex-1 flex justify-center pt-1.5"><IconTrain size={20} className="text-brand" /></div>
            <div className="w-[124px] shrink-0 text-right">
              <div className="text-[16px] font-medium leading-tight line-clamp-2 break-words min-h-[40px]">{t.arr_name}</div>
              <div className="text-[15px] mt-1.5 tabular-nums">{t.arr_time}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---- expanded: full details under the strip ----
  const toggle = (
    <div className="relative inline-flex rounded-full bg-surface-2 p-0.5 shrink-0">
      <span className="absolute top-0.5 bottom-0.5 rounded-full bg-brand transition-all duration-200"
        style={{ width: 'calc(50% - 2px)', left: dir === 'outbound' ? '2px' : 'calc(50%)' }} />
      {(['outbound', 'return'] as const).map((d) => (
        <button key={d} onClick={() => setManualDir(d)}
          className={['relative z-10 px-3.5 h-7 rounded-full text-[12px] font-medium transition-colors', dir === d ? 'text-white' : 'text-ink-3'].join(' ')}>
          {d === 'outbound' ? 'ขาไป' : 'ขากลับ'}
        </button>
      ))}
    </div>
  )
  return (
    <div className="relative flex flex-col">
      {strip}
      <div className="card relative p-4">
      <div className="flex items-start mt-1">
        <div className="w-[96px] shrink-0">
          <div className="text-[14px] font-medium leading-tight line-clamp-2 break-words min-h-[35px]">{t.dep_name}</div>
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
          <div className="text-[14px] font-medium leading-tight line-clamp-2 break-words min-h-[35px]">{t.arr_name}</div>
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
      <div className="flex items-center justify-between gap-2 mt-3.5">
        <AttachLink table="trains" id={t.id} tripId={tripId} storagePath={t.storage_path} canEdit={canEdit} />
        {toggle}
      </div>
      </div>
    </div>
  )
}

export default function TripInfo() {
  const { trip, travelers, travelerFiles, flights, trains, trainTickets, hotels, profile, reload, patch, canEdit } = useTrip()
  const { user } = useAuth()
  const [selected, setSelected] = useState<Traveler | null>(null)
  const [qrFor, setQrFor] = useState<Traveler | null>(null)
  const [othersOpen, setOthersOpen] = useState(false)
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

  // "Me" = the card I claimed (user_id), falling back to a profile-name match
  const myName = profile?.nickname?.trim().toLowerCase()
  const meTraveler = travelers.find((t) => t.user_id && t.user_id === user?.id)
    ?? (myName ? travelers.find((t) => t.nickname?.trim().toLowerCase() === myName) : undefined)
  const otherTravelers = travelers.filter((t) => t !== meTraveler)

  // ── privacy (supabase/privacy.sql): who may open this card's documents/QRs.
  // Unclaimed cards behave like before; the TRIP OWNER always sees everything.
  const isTripOwner = !!trip && !!user && trip.owner_id === user.id
  const iClaimed = travelers.some((t) => t.user_id === user?.id)
  const canSeePrivate = (t: Traveler) =>
    (t.privacy ?? 'private') === 'trip' || !t.user_id || t.user_id === user?.id || isTripOwner

  async function claimCard(t: Traveler) {
    if (!user) return
    if (!(await confirmDialog({ message: `ตั้งการ์ด "${t.nickname ?? 'ผู้เดินทาง'}" เป็นของฉัน? เอกสาร/QR ของการ์ดนี้จะถูกตั้งเป็นส่วนตัว (คุณ + เจ้าของทริป) และคุณเปลี่ยนระดับได้ทีหลัง`, confirmLabel: 'ใช่ นี่การ์ดฉัน' }))) return
    patch((d) => ({ travelers: d.travelers.map((x) => (x.id === t.id ? { ...x, user_id: user.id } : x)) }))
    await claimTraveler(t.id, user.id)
    reload()
  }
  async function togglePrivacy(t: Traveler) {
    const next = (t.privacy ?? 'private') === 'trip' ? 'private' : 'trip'
    patch((d) => ({ travelers: d.travelers.map((x) => (x.id === t.id ? { ...x, privacy: next } : x)) }))
    await setTravelerPrivacy(t.id, next)
    toast.success(next === 'trip'
      ? 'เปิดให้ทุกคนในทริปเห็นเอกสาร/QR ของการ์ดนี้'
      : 'ตั้งเป็นส่วนตัวแล้ว — เห็นเฉพาะเจ้าของการ์ดกับเจ้าของทริป')
  }

  const travelerRow = (t: Traveler, isMe: boolean) => {
    const i = travelers.indexOf(t)
    const files = filesByTraveler.get(t.id) ?? []
    const visible = canSeePrivate(t)
    const isMineCard = !!user && t.user_id === user.id
    // Count only QRs with real content — a freshly-added blank ticket (created but
    // nothing filled/uploaded yet) shouldn't bump the tile's count.
    const myTickets = trainTickets.filter((tk) => tk.traveler_id === t.id
      && (tk.qr_path || tk.label || tk.note || tk.from_station || tk.to_station || tk.seat_no || tk.car || tk.gate))
    const usedTickets = myTickets.filter((tk) => tk.used).length
    return (
      <div key={t.id} className="flex gap-2.5 items-stretch">
        <button onClick={() => visible ? setSelected(t) : toast.info(`เอกสารของ "${t.nickname ?? 'การ์ดนี้'}" เป็นส่วนตัว`)}
          className="card p-3.5 text-left hover:bg-surface-2/30 flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <Avatar name={t.nickname} color={travelerColor(t, i)} size={34} ring={false} />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium leading-tight flex items-center gap-1.5">
                <span className="truncate">{t.nickname}</span>
                {isMe && <span className="inline-flex items-center rounded-full bg-brand-soft text-brand-dark text-[10px] font-semibold px-1.5 py-0.5 shrink-0">Me</span>}
              </div>
              {t.full_name && <div className="text-[11px] text-ink-3 truncate">{t.full_name}</div>}
            </div>
            {/* ownership/privacy controls live up here — separate from the document pills below */}
            {!t.user_id && !!user && !iClaimed && (
              <span role="button" tabIndex={0}
                onClick={(e) => { e.stopPropagation(); claimCard(t) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); claimCard(t) } }}
                className="chip !text-brand-mid hover:bg-brand-soft cursor-pointer shrink-0">
                <IconUserCheck size={12} /> การ์ดนี้คือฉัน
              </span>
            )}
            {(isMineCard || (isTripOwner && !!t.user_id)) && (
              <span role="button" tabIndex={0}
                onClick={(e) => { e.stopPropagation(); togglePrivacy(t) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); togglePrivacy(t) } }}
                className="chip hover:bg-surface-2 cursor-pointer shrink-0">
                {(t.privacy ?? 'private') === 'trip' ? <><IconUsers size={12} /> ทุกคนเห็น</> : <><IconLock size={12} /> ส่วนตัว</>}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {!visible ? (
              <span className="chip !text-ink-3"><IconLock size={12} /> เอกสารส่วนตัว — เฉพาะเจ้าของ</span>
            ) : (
              <>
                {files.map((f) => {
                  const meta = KIND_META[f.kind ?? 'other'] ?? KIND_META.other
                  return (
                    <span key={f.id} role="button" tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); viewFile(f) }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); viewFile(f) } }}
                      className="chip hover:bg-surface-2 cursor-pointer">
                      <meta.icon size={12} /> {f.label || meta.label}
                    </span>
                  )
                })}
                {canEdit && (
                  <span role="button" tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setSelected(t) }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setSelected(t) } }}
                    className="chip !text-brand-mid hover:bg-brand-soft cursor-pointer">
                    <IconPlus size={12} /> เพิ่มไฟล์
                  </span>
                )}
              </>
            )}
          </div>
        </button>

        {/* Quick QR — icon tile; hidden entirely on cards you may not open */}
        {visible && (myTickets.length > 0 || canEdit) && (
          <button onClick={() => setQrFor(t)}
            className="card w-[116px] shrink-0 flex flex-col items-center justify-center gap-1.5 hover:bg-surface-2/30 transition-colors">
            <div className="relative">
              <div className="size-9 rounded-full bg-brand-soft grid place-items-center text-brand"><IconQrcode size={20} /></div>
              {myTickets.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full grid place-items-center text-[10px] font-bold text-white tabular-nums"
                  style={{ background: 'var(--color-brand)' }}>{myTickets.length}</span>
              )}
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] font-semibold tracking-wide leading-none">Quick QR</span>
              {myTickets.length > 0 && (
                <span className="text-[10px] text-ink-3 tabular-nums leading-none">ใช้แล้ว {usedTickets}</span>
              )}
            </div>
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Travelers */}
      <SectionHead title="Travelers • ผู้เดินทาง"
        action={canEdit ? <button onClick={() => setTravelerEdit('new')} className="btn-link flex items-center gap-1"><IconUserPlus size={14} /> เพิ่มคน</button> : undefined} />
      <div className="space-y-2.5">
        {meTraveler && travelerRow(meTraveler, true)}
        {otherTravelers.length > 0 && (meTraveler ? (
          othersOpen ? (
            <>
              {otherTravelers.map((t) => travelerRow(t, false))}
              <button onClick={() => setOthersOpen(false)}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-[12px] font-medium text-ink-3 hover:text-ink-2">
                พับเก็บ <IconChevronDown size={15} className="rotate-180" />
              </button>
            </>
          ) : (
            // peek: a faint preview of the next traveler hints there are more
            <div role="button" tabIndex={0} onClick={() => setOthersOpen(true)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOthersOpen(true)}
              className="relative block w-full overflow-hidden rounded-[12px] cursor-pointer"
              style={{ height: 66 }} aria-label={`แสดงผู้เดินทางอีก ${otherTravelers.length} คน`}>
              <div className="opacity-55 pointer-events-none">{travelerRow(otherTravelers[0], false)}</div>
              <div className="absolute inset-x-0 bottom-0 h-11 flex items-end justify-center pb-1"
                style={{ background: 'linear-gradient(to bottom, transparent, var(--color-canvas))' }}>
                <span className="text-[12px] font-semibold text-brand inline-flex items-center gap-1">อีก {otherTravelers.length} คน <IconChevronDown size={14} /></span>
              </div>
            </div>
          )
        ) : otherTravelers.map((t) => travelerRow(t, false)))}
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

                {/* ใบจอง (left, aligned with Check-in) + MAP (right) */}
                {(canEdit || h.storage_path || h.map_url) && (
                  <div className="flex items-center justify-between gap-2 mt-3">
                    <div className="min-w-0">
                      {trip && <AttachLink table="hotels" id={h.id} tripId={trip.id} storagePath={h.storage_path} attachLabel="ใบจอง" viewLabel="ดูใบจอง" canEdit={canEdit} />}
                    </div>
                    <AMapPill url={h.map_url} />
                  </div>
                )}
              </div>
            </div>

            {h.rooms && h.rooms.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3.5">
                {h.rooms.map((r, i) => (
                  <span key={i} className="chip"><IconBed size={12} /> {r.name} · {r.members.join(', ')}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        {hotels.length === 0 && <div className="card p-4 text-[12px] text-ink-3 text-center">ยังไม่มีข้อมูลที่พัก</div>}
      </div>

      {/* Budget */}
      <SectionHead title="Budget • ค่าใช้จ่าย" />
      <BudgetSection />

      <TravelerQr
        open={!!qrFor}
        onClose={() => setQrFor(null)}
        traveler={qrFor}
        name={qrFor?.nickname ?? 'ผู้โดยสาร'}
        tickets={trainTickets.filter((tk) => tk.traveler_id === qrFor?.id)}
        tripId={trip?.id ?? ''}
        canEdit={canEdit}
        patchTickets={(fn) => patch((d) => ({ trainTickets: fn(d.trainTickets) }))}
      />

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
