import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  IconCheck, IconLoader2, IconHeartFilled, IconX, IconBuildingStore, IconChevronLeft, IconMapPin,
} from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { copyPlaceToTrip, exploreSavedInTrips, removeExploreCopiesDeep } from '@/lib/placeMutations'
import { confirmDialog } from '@/lib/confirm'
import { addStop } from '@/lib/mutations'
import { logExploreEvent } from '@/lib/exploreMutations'
import { toast } from '@/lib/toast'
import { countryFlag } from '@/lib/countries'
import { formatDateRange, formatLongDate } from '@/lib/format'
import type { ItineraryDay, Place, Trip } from '@/lib/database.types'

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase()

/** The place's location keywords (city + country) and a trip's (country +
 *  every city segment) match when any pair is equal or one contains the other —
 *  lenient enough for "Taipei" vs "New Taipei", strict enough to keep a Japan
 *  place out of a Taiwan trip. */
function tripMatchesPlace(t: Trip, placeTokens: string[]): boolean {
  const tripTokens = [
    t.country, ...(t.cities ?? []),
    ...(t.segments ?? []).flatMap((s) => [s.city, (s as { country?: string | null }).country]),
  ].map(norm).filter(Boolean)
  return placeTokens.some((p) => tripTokens.some((tt) => tt === p || tt.includes(p) || p.includes(tt)))
}

/** Step header — ✓ for done, filled number for current, dashed for upcoming.
 *  Steps that don't apply (no branches / list-only save) are never in the list. */
function Stepper({ steps, cur }: { steps: { key: string; label: string }[]; cur: number }) {
  return (
    <div className="flex items-start mb-4">
      {steps.map((s, i) => (
        <Fragment key={s.key}>
          {i > 0 && <div className="flex-1 h-[2px] mt-[11px] mx-1 rounded-full" style={{ background: i <= cur ? '#16A34A' : 'var(--color-line)' }} />}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <span className="size-6 rounded-full grid place-items-center text-[11px] font-bold"
              style={i < cur
                ? { background: '#ECFDF3', color: '#16A34A', border: '1px solid #bbe7cc' }
                : i === cur
                  ? { background: 'var(--color-brand)', color: '#fff', boxShadow: '0 3px 8px rgba(2,112,251,.3)' }
                  : { background: 'var(--color-surface-2)', color: 'var(--color-ink-3)', border: '1px dashed var(--color-line-2)' }}>
              {i < cur ? <IconCheck size={13} /> : i + 1}
            </span>
            <span className="text-[9px] font-semibold leading-none"
              style={{ color: i === cur ? 'var(--color-brand-mid)' : 'var(--color-ink-3)' }}>{s.label}</span>
          </div>
        </Fragment>
      ))}
    </div>
  )
}

export function SaveToTripDialog({ place, open, sourceExploreId, onClose, onChanged }: {
  place: Place | null
  open: boolean
  sourceExploreId?: string
  onClose: () => void
  onChanged?: () => void
}) {
  const { trips, trip: currentTrip, reload } = useTrip()
  const { user } = useAuth()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  // the answers so far — each unanswered value marks the current step
  const [tripId, setTripId] = useState<string | null>(null)
  const [dayId, setDayId] = useState<string | null | undefined>(undefined) // undefined = not asked yet, null = no day
  const [days, setDays] = useState<ItineraryDay[] | null>(null)

  // any trip the user can reach — owned OR shared in (RLS blocks the write if the
  // share is view-only). Shared members no longer need a trip of their own.
  const myTrips = trips

  // Only offer trips whose city/country matches this place — you can't save a
  // Taipei spot into a Tokyo trip. Trips it's already saved in stay listed so
  // un-saving still works. No location on the place → can't filter, show all.
  const placeTokens = [place?.city, place?.country].map(norm).filter(Boolean)
  const matching = placeTokens.length === 0
    ? myTrips
    : myTrips.filter((t) => tripMatchesPlace(t, placeTokens) || done.has(t.id))

  /** A trip that already ended — hardly anyone saves into one, so it sinks to
   *  the bottom and is shown quietly. Same rule as the home dashboard's
   *  Upcoming/Past split (ends before today = past). */
  const isPast = (t: Trip) => {
    if (!t.start_date) return false // undated trips are still being planned
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return new Date(t.end_date || t.start_date).getTime() < today.getTime()
  }
  // upcoming/current first (soonest first), finished trips last (most recent first)
  const shownTrips = useMemo(() => {
    // undated trips sort last among the live ones (a dated trip coming up is the
    // likelier target), never to the very top
    const key = (t: Trip) => (t.start_date ? new Date(t.start_date).getTime() : Number.POSITIVE_INFINITY)
    const live = matching.filter((t) => !isPast(t)).sort((a, b) => key(a) - key(b))
    const done_ = matching.filter(isPast).sort((a, b) => key(b) - key(a))
    return [...live, ...done_]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matching])
  const firstPastId = shownTrips.find(isPast)?.id

  const branches = place?.branches ?? []
  const hasBranches = branches.length > 0
  const hasOwnLocation = !!(place && (place.map_url || place.station_name || place.station_line))

  useEffect(() => {
    if (!open) return
    setBusyId(null)
    setDone(new Set())
    setTripId(null)
    setDayId(undefined)
    setDays(null)
    if (sourceExploreId) {
      exploreSavedInTrips(sourceExploreId, myTrips.map((t) => t.id)).then((ids) => setDone(new Set(ids)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sourceExploreId])

  // Saving always lands in the trip's Location list — that question is gone.
  // The only follow-up is which day (optional), and a branch when a day was
  // actually picked, because that's the visit the branch belongs to.
  const screen: 'trip' | 'day' | 'branch' =
    !tripId ? 'trip'
      : dayId === undefined ? 'day'
        : 'branch'

  // the stepper only lists steps that actually apply to THIS save
  const steps = [
    { key: 'trip', label: 'ทริป' },
    { key: 'day', label: 'วัน' },
    ...(hasBranches ? [{ key: 'branch', label: 'สาขา' }] : []),
  ]
  const curStep = steps.findIndex((s) => s.key === screen)

  /** Final write: copy the place into the trip, and when a day was picked also
   *  add it as a stop on that day (which is what puts it in the plan). */
  async function finalSave(day: string | null, b: number | null) {
    if (!place || !tripId) return
    setBusyId(tripId)
    await copyPlaceToTrip(place, tripId, sourceExploreId, { planBranch: day ? b : null })
    if (day) {
      const br = b != null ? place.branches?.[b] : null
      const { count } = await supabase.from('itinerary_stops')
        .select('id', { count: 'exact', head: true }).eq('day_id', day)
      await addStop(tripId, day, count ?? 0, {
        place_name: place.name, map_url: br?.map_url || place.map_url,
        branch_idx: b, // per-visit, so other days can use another branch
      })
    }
    if (sourceExploreId && user) logExploreEvent(sourceExploreId, user.id, 'save')
    setDone((prev) => new Set(prev).add(tripId))
    setBusyId(null)
    onChanged?.()
    if (tripId === currentTrip?.id) void reload() // Location/Itinerary ของทริปที่เปิดอยู่เห็นผลทันที
    // done — fold the drawer away and confirm with a toast
    onClose()
    toast.success(day ? 'เซฟแล้ว · ใส่ลงวันให้ด้วย' : 'เซฟลงทริปแล้ว')
  }

  /** Chose a day. `dayId` is set only when a branch question follows it —
   *  setting it unconditionally put the dialog on the branch screen for the
   *  whole write, so a place with no branches flashed a branch step it should
   *  never see. */
  function chooseDay(day: string | null) {
    if (day && hasBranches) { setDayId(day); return }
    void finalSave(day, null)
  }

  /** A trip was chosen → load its days so the next screen can offer them. */
  async function loadDays(id: string) {
    setDays(null)
    const { data } = await supabase.from('itinerary_days')
      .select('*').eq('trip_id', id).order('position')
    setDays((data as ItineraryDay[] | null) ?? [])
  }

  async function tapTrip(id: string) {
    if (!place) return
    if (done.has(id)) {
      // un-save: remove this place's copy from the chosen trip + its itinerary stops
      if (!(await confirmDialog({
        message: `เอา "${place.name}" ออกจากทริปนี้? ถ้ามีจุดแวะของที่นี่ใน Itinerary จะถูกลบไปด้วย`,
        danger: true, confirmLabel: 'เอาออก',
      }))) return
      setBusyId(id)
      let stops = 0
      if (sourceExploreId) stops = (await removeExploreCopiesDeep(sourceExploreId, [id])).stopsRemoved
      setDone((prev) => { const n = new Set(prev); n.delete(id); return n })
      setBusyId(null)
      onChanged?.()
      if (id === currentTrip?.id) void reload() // เอาออกแล้วหน้า Location ต้องหายทันที
      toast.success(stops > 0 ? `เอาออกแล้ว · ลบจุดแวะใน Itinerary ${stops} จุดด้วย` : 'เอาออกจากทริปแล้ว')
      return
    }
    setTripId(id)
    void loadDays(id)
  }

  function back() {
    if (screen === 'branch') { setDayId(undefined); return }
    if (screen === 'day') { setTripId(null); setDays(null) }
  }

  const savingTrip = tripId ? myTrips.find((t) => t.id === tripId) : null
  const busy = !!busyId

  const optionCard = 'w-full flex items-center gap-2.5 card p-3 text-left enabled:hover:bg-surface-2/40'
  const optionIcon = (icon: React.ReactNode) => (
    <span className="size-8 rounded-[8px] grid place-items-center shrink-0"
      style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-mid)' }}>{icon}</span>
  )
  const backBtn = (
    <button onClick={back} disabled={busy}
      className="w-full flex items-center justify-center gap-1 h-10 text-[12px] text-ink-3 hover:text-ink-2">
      <IconChevronLeft size={14} /> กลับ
    </button>
  )

  return (
    <Drawer open={open} onClose={onClose} title="เซฟสถานที่">
      <div className="flex items-center gap-2 mb-3 text-[13px]">
        <IconHeartFilled size={15} className="text-brand" />
        <span className="font-medium truncate">{place?.name}</span>
        {savingTrip && (
          <span className="chip !bg-brand-soft !text-brand-dark shrink-0 ml-auto">
            {savingTrip.flag || countryFlag(savingTrip.country)} {savingTrip.name}
          </span>
        )}
      </div>

      <Stepper steps={steps} cur={curStep} />

      {/* ── ขั้น 1: เซฟไปทริปไหน (เฉพาะทริปที่เมืองตรงกับสถานที่) ── */}
      {screen === 'trip' && (
        shownTrips.length === 0 ? (
          <div className="card p-5 text-center text-[12px] text-ink-3">
            {myTrips.length === 0
              ? 'ยังไม่มีทริปให้เซฟ — สร้างทริป หรือให้เจ้าของแชร์ทริปเข้ามาก่อน'
              : `ยังไม่มีทริปสำหรับ${place?.city ? ` "${place.city}"` : 'เมืองนี้'} — สร้างทริปเมืองนี้ก่อนแล้วค่อยเซฟได้`}
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="text-[13.5px] font-semibold mb-2">เซฟไปทริปไหน?</div>
            {shownTrips.map((t) => {
              const saved = done.has(t.id)
              const removable = saved && !!sourceExploreId // can only un-save explore-sourced copies
              const past = isPast(t)
              return (
                <Fragment key={t.id}>
                {/* finished trips sit below a quiet divider — rarely the target */}
                {t.id === firstPastId && (
                  <div className="flex items-center gap-2 pt-2 pb-0.5">
                    <span className="h-px flex-1" style={{ background: 'var(--color-line)' }} />
                    <span className="text-[10.5px] text-ink-3">ทริปที่ผ่านไปแล้ว</span>
                    <span className="h-px flex-1" style={{ background: 'var(--color-line)' }} />
                  </div>
                )}
                <button onClick={() => tapTrip(t.id)} disabled={busyId === t.id || (saved && !removable)}
                  title={removable ? 'แตะเพื่อเอาออกจากทริปนี้' : undefined}
                  className={['relative w-full flex items-center gap-2.5 card p-3 text-left enabled:hover:bg-surface-2/40',
                    past ? 'opacity-60' : ''].join(' ')}>
                  <span className="text-[20px] shrink-0">{t.flag || countryFlag(t.country)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium truncate">{t.name}</div>
                    <div className="text-[11px] text-ink-3">{formatDateRange(t.start_date, t.end_date) || t.country || '—'}</div>
                  </div>
                  {busyId === t.id ? <IconLoader2 size={16} className="animate-spin text-ink-3" />
                    : saved ? (
                      <span className="inline-flex items-center gap-1.5 shrink-0">
                        <span className="chip !bg-brand-soft !text-brand-dark"><IconCheck size={12} /> เซฟแล้ว</span>
                        {removable && <span className="inline-flex items-center gap-0.5 text-[12px] text-[#D85A30]"><IconX size={12} /> เอาออก</span>}
                      </span>
                    )
                    : <span className="btn-link text-[12px]">เซฟที่นี่</span>}
                  {saved && !removable && <div className="absolute inset-0 rounded-[12px] pointer-events-none" style={{ background: 'rgba(120,118,110,0.16)' }} />}
                </button>
                </Fragment>
              )
            })}
          </div>
        )
      )}

      {/* ── ขั้น 2: ใส่ลงวันเลยมั้ย (ข้ามได้ — เซฟลงทริปอยู่แล้ว) ── */}
      {screen === 'day' && (
        <div className="space-y-1.5">
          <div className="text-[13.5px] font-semibold">ใส่ลงวันเลยมั้ย?</div>
          <p className="text-[11px] text-ink-3 mb-2.5">เลือกวันตอนนี้ก็ได้ ไว้ทีหลังก็ได้</p>

          {/* the plain save is the primary action — most saves are just
              collecting a place, so it leads and looks like the main button */}
          <button onClick={() => chooseDay(null)} disabled={busy}
            className="btn-primary w-full h-12 flex flex-col items-center justify-center leading-tight disabled:opacity-50">
            <span className="text-[14px] font-semibold flex items-center gap-1.5">
              {busy && <IconLoader2 size={15} className="animate-spin" />} เซฟเข้าทริป
            </span>
            <span className="text-[10.5px] font-normal opacity-85">เก็บไว้ในหน้า Location ก่อน</span>
          </button>

          <div className="flex items-center gap-2 py-1.5">
            <span className="h-px flex-1" style={{ background: 'var(--color-line)' }} />
            <span className="text-[11px] text-ink-3">หรือใส่ลงวันเลย</span>
            <span className="h-px flex-1" style={{ background: 'var(--color-line)' }} />
          </div>

          {days == null ? (
            <div className="py-4 grid place-items-center text-ink-3"><IconLoader2 size={18} className="animate-spin" /></div>
          ) : days.length > 0 ? (
            days.map((d, i) => (
              <button key={d.id} onClick={() => chooseDay(d.id)} disabled={busy} className={optionCard}>
                <span className="size-8 rounded-[8px] grid place-items-center shrink-0 text-[13px] font-bold"
                  style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-mid)' }}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium truncate">{d.day_date ? formatLongDate(d.day_date) : `Day ${i + 1}`}</div>
                  {d.label && <div className="text-[11px] text-ink-3 truncate mt-0.5">{d.label}</div>}
                </div>
                {busy ? <IconLoader2 size={16} className="animate-spin text-ink-3" />
                  : <span className="btn-link text-[12px] shrink-0">ใส่วันนี้</span>}
              </button>
            ))
          ) : (
            <div className="card p-4 text-center text-[12px] text-ink-3">
              ทริปนี้ยังไม่มีวันในแผน — เซฟไว้ก่อน แล้วไปเพิ่มวันในหน้า Itinerary
            </div>
          )}
          {backBtn}
        </div>
      )}

      {/* ── ขั้น 3 (เฉพาะร้านหลายสาขา ที่เลือกวันแล้ว): ไปสาขาไหน ── */}
      {screen === 'branch' && (
        <div className="space-y-1.5">
          <div className="text-[13.5px] font-semibold mb-2">ไปสาขาไหน?</div>
          <p className="text-[11px] text-ink-3 -mt-1 mb-1">เลือกสำหรับวันนี้ — วันอื่นเปลี่ยนเป็นสาขาอื่นได้</p>
          {hasOwnLocation && (
            <button onClick={() => void finalSave(dayId ?? null, null)} disabled={busy} className={optionCard}>
              {optionIcon(<IconMapPin size={16} />)}
              <span className="text-[13.5px] font-medium flex-1 min-w-0 truncate">ที่ตั้งหลัก</span>
              <span className="btn-link text-[12px] shrink-0">เลือก</span>
            </button>
          )}
          {branches.map((b, i) => (
            <button key={i} onClick={() => void finalSave(dayId ?? null, i)} disabled={busy} className={optionCard}>
              {optionIcon(<IconBuildingStore size={16} />)}
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium truncate">{b.label || `สาขา ${i + 1}`}</div>
                {(b.line || b.station) && (
                  <div className="flex items-center gap-1.5 text-[11px] text-ink-3 mt-0.5">
                    <span className="size-2 rounded-full shrink-0" style={{ background: b.color ?? '#888780' }} />
                    <span className="truncate">{b.line}{b.station ? ` · ${b.station}` : ''}</span>
                  </div>
                )}
              </div>
              <span className="btn-link text-[12px] shrink-0">เลือก</span>
            </button>
          ))}
          {backBtn}
        </div>
      )}

    </Drawer>
  )
}
