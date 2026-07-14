import { useEffect, useState } from 'react'
import {
  IconCheck, IconLoader2, IconHeartFilled, IconX, IconBuildingStore, IconChevronLeft, IconMapPin,
  IconBookmark, IconClipboardCheck, IconCalendarPlus,
} from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { copyPlaceToTrip, exploreSavedInTrips, removeExploreCopies } from '@/lib/placeMutations'
import { addStop } from '@/lib/mutations'
import { logExploreEvent } from '@/lib/exploreMutations'
import { countryFlag } from '@/lib/countries'
import { formatDateRange, formatLongDate } from '@/lib/format'
import type { ItineraryDay, Place } from '@/lib/database.types'

export function SaveToTripDialog({ place, open, sourceExploreId, onClose, onChanged }: {
  place: Place | null
  open: boolean
  sourceExploreId?: string
  onClose: () => void
  onChanged?: () => void
}) {
  const { trips } = useTrip()
  const { user } = useAuth()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  // multi-branch step: the trip that was tapped, waiting for a branch choice
  const [pendingTrip, setPendingTrip] = useState<string | null>(null)
  // list-or-plan step: trip (+ branch) chosen, waiting for how to save
  const [pendingSave, setPendingSave] = useState<{ tripId: string; branch: number | null } | null>(null)
  // day step: user chose "ใส่ลงวันเลย" — the target trip's days, fetched on demand
  const [days, setDays] = useState<ItineraryDay[] | null>(null)

  // any trip the user can reach — owned OR shared in (RLS blocks the write if the
  // share is view-only). Shared members no longer need a trip of their own.
  const myTrips = trips

  const branches = place?.branches ?? []
  const hasOwnLocation = !!(place && (place.map_url || place.station_name || place.station_line))

  useEffect(() => {
    if (!open) return
    setBusyId(null)
    setDone(new Set())
    setPendingTrip(null)
    setPendingSave(null)
    setDays(null)
    if (sourceExploreId) {
      exploreSavedInTrips(sourceExploreId, myTrips.map((t) => t.id)).then((ids) => setDone(new Set(ids)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sourceExploreId])

  /** Final write. mode: 'list' = just saved (Location page), 'plan' = also
   *  ticked ในแพลน, 'day' = ในแพลน + an itinerary stop in the chosen day. */
  async function finalSave(mode: 'list' | 'plan' | 'day', dayId?: string) {
    if (!place || !pendingSave) return
    const { tripId, branch } = pendingSave
    setBusyId(tripId)
    await copyPlaceToTrip(place, tripId, sourceExploreId, { inPlan: mode !== 'list', planBranch: branch })
    if (mode === 'day' && dayId) {
      const b = branch != null ? place.branches?.[branch] : null
      const { count } = await supabase.from('itinerary_stops')
        .select('id', { count: 'exact', head: true }).eq('day_id', dayId)
      await addStop(tripId, dayId, count ?? 0, { place_name: place.name, map_url: b?.map_url || place.map_url })
    }
    if (sourceExploreId && user) logExploreEvent(sourceExploreId, user.id, 'save')
    setDone((prev) => new Set(prev).add(tripId))
    setBusyId(null)
    setPendingTrip(null)
    setPendingSave(null)
    setDays(null)
    onChanged?.()
  }

  /** "ใส่ลงวันเลย" → fetch the target trip's days, then show the day list. */
  async function openDayPick() {
    if (!pendingSave) return
    const { data } = await supabase.from('itinerary_days')
      .select('*').eq('trip_id', pendingSave.tripId).order('position')
    setDays((data as ItineraryDay[] | null) ?? [])
  }

  async function toggle(tripId: string) {
    if (!place) return
    if (done.has(tripId)) {
      // un-save: remove this place's copy from the chosen trip (explore-sourced only)
      setBusyId(tripId)
      if (sourceExploreId) await removeExploreCopies(sourceExploreId, [tripId])
      setDone((prev) => { const n = new Set(prev); n.delete(tripId); return n })
      setBusyId(null)
      onChanged?.()
      return
    }
    // multi-branch: ask WHICH branch first; otherwise straight to list-or-plan
    if (branches.length > 0) setPendingTrip(tripId)
    else setPendingSave({ tripId, branch: null })
  }

  const pending = pendingTrip ? myTrips.find((t) => t.id === pendingTrip) : null
  const savingTrip = pendingSave ? myTrips.find((t) => t.id === pendingSave.tripId) : null
  const headerTrip = savingTrip ?? pending
  const busy = !!busyId

  const title = days != null ? 'ใส่ลงวันไหน?'
    : pendingSave ? 'เซฟแบบไหน?'
      : pending ? 'ไปสาขาไหน?'
        : 'เซฟสถานที่ไปทริปไหน'

  const optionCard = 'w-full flex items-center gap-2.5 card p-3 text-left enabled:hover:bg-surface-2/40'
  const optionIcon = (icon: React.ReactNode) => (
    <span className="size-8 rounded-[8px] grid place-items-center shrink-0"
      style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-mid)' }}>{icon}</span>
  )

  return (
    <Drawer open={open} onClose={onClose} title={title}>
      <div className="flex items-center gap-2 mb-3 text-[13px]">
        <IconHeartFilled size={15} className="text-brand" />
        <span className="font-medium truncate">{place?.name}</span>
        {headerTrip && (
          <span className="chip !bg-brand-soft !text-brand-dark shrink-0 ml-auto">
            {headerTrip.flag || countryFlag(headerTrip.country)} {headerTrip.name}
          </span>
        )}
      </div>

      {/* step 4 — pick the day (เซฟลงแพลน + ใส่ลงวันเลย) */}
      {days != null && pendingSave ? (
        <div className="space-y-1.5">
          {days.length === 0 ? (
            <div className="card p-5 text-center">
              <p className="text-[12.5px] text-ink-2">ทริปนี้ยังไม่มีวันในแผน</p>
              <button onClick={() => finalSave('plan')} disabled={busy} className="btn-primary h-9 px-4 mt-3 text-[12.5px]">
                ใส่ในแพลนไว้ก่อน — ไปเพิ่มวันทีหลัง
              </button>
            </div>
          ) : days.map((d, i) => (
            <button key={d.id} onClick={() => finalSave('day', d.id)} disabled={busy} className={optionCard}>
              <span className="size-8 rounded-[8px] grid place-items-center shrink-0 text-[13px] font-bold"
                style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-mid)' }}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium truncate">{d.day_date ? formatLongDate(d.day_date) : `Day ${i + 1}`}</div>
                {d.label && <div className="text-[11px] text-ink-3 truncate mt-0.5">{d.label}</div>}
              </div>
              {busy ? <IconLoader2 size={16} className="animate-spin text-ink-3" />
                : <span className="btn-link text-[12px] shrink-0">ใส่วันนี้</span>}
            </button>
          ))}
          <button onClick={() => setDays(null)} disabled={busy}
            className="w-full flex items-center justify-center gap-1 h-10 text-[12px] text-ink-3 hover:text-ink-2">
            <IconChevronLeft size={14} /> กลับ
          </button>
        </div>
      ) : pendingSave ? (
        /* step 3 — list or plan */
        <div className="space-y-1.5">
          <button onClick={() => finalSave('list')} disabled={busy} className={optionCard}>
            {optionIcon(<IconBookmark size={16} />)}
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium">เซฟลงลิสต์</div>
              <div className="text-[11px] text-ink-3 mt-0.5">เก็บไว้ในหน้า Location ก่อน ยังไม่เข้าแพลน</div>
            </div>
            {busy && <IconLoader2 size={16} className="animate-spin text-ink-3" />}
          </button>
          <button onClick={() => finalSave('plan')} disabled={busy} className={optionCard}>
            {optionIcon(<IconClipboardCheck size={16} />)}
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium">เซฟลงแพลน — ไว้ก่อน ยังไม่เลือกวัน</div>
              <div className="text-[11px] text-ink-3 mt-0.5">ติ๊ก "ในแพลน" ให้เลย แล้วค่อยจัดลงวันทีหลัง</div>
            </div>
            {busy && <IconLoader2 size={16} className="animate-spin text-ink-3" />}
          </button>
          <button onClick={openDayPick} disabled={busy} className={optionCard}>
            {optionIcon(<IconCalendarPlus size={16} />)}
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium">เซฟลงแพลน — ใส่ลงวันเลย</div>
              <div className="text-[11px] text-ink-3 mt-0.5">ติ๊ก "ในแพลน" + เพิ่มเป็นจุดแวะในวันที่เลือก</div>
            </div>
          </button>
          <button onClick={() => { setPendingSave(null); if (branches.length > 0) setPendingTrip(pendingSave.tripId) }} disabled={busy}
            className="w-full flex items-center justify-center gap-1 h-10 text-[12px] text-ink-3 hover:text-ink-2">
            <IconChevronLeft size={14} /> กลับ
          </button>
        </div>
      ) : pending ? (
        /* step 2 — pick the branch this trip will go to */
        <div className="space-y-1.5">
          {hasOwnLocation && (
            <button onClick={() => { setPendingSave({ tripId: pending.id, branch: null }); setPendingTrip(null) }} disabled={busy}
              className={optionCard}>
              {optionIcon(<IconMapPin size={16} />)}
              <span className="text-[13.5px] font-medium flex-1 min-w-0 truncate">ที่ตั้งหลัก</span>
              <span className="btn-link text-[12px] shrink-0">เลือกสาขานี้</span>
            </button>
          )}
          {branches.map((b, i) => (
            <button key={i} onClick={() => { setPendingSave({ tripId: pending.id, branch: i }); setPendingTrip(null) }} disabled={busy}
              className={optionCard}>
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
              <span className="btn-link text-[12px] shrink-0">เลือกสาขานี้</span>
            </button>
          ))}
          <button onClick={() => setPendingTrip(null)} disabled={busy}
            className="w-full flex items-center justify-center gap-1 h-10 text-[12px] text-ink-3 hover:text-ink-2">
            <IconChevronLeft size={14} /> กลับไปเลือกทริป
          </button>
        </div>
      ) : myTrips.length === 0 ? (
        <div className="card p-5 text-center text-[12px] text-ink-3">
          ยังไม่มีทริปให้เซฟ — สร้างทริป หรือให้เจ้าของแชร์ทริปเข้ามาก่อน
        </div>
      ) : (
        <div className="space-y-1.5">
          {myTrips.map((t) => {
            const saved = done.has(t.id)
            const removable = saved && !!sourceExploreId // can only un-save explore-sourced copies
            return (
              <button key={t.id} onClick={() => toggle(t.id)} disabled={busyId === t.id || (saved && !removable)}
                title={removable ? 'แตะเพื่อเอาออกจากทริปนี้' : undefined}
                className="relative w-full flex items-center gap-2.5 card p-3 text-left enabled:hover:bg-surface-2/40">
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
            )
          })}
        </div>
      )}
    </Drawer>
  )
}
