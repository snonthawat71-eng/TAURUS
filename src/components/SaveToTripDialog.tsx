import { useEffect, useState } from 'react'
import { IconCheck, IconLoader2, IconHeartFilled, IconX, IconBuildingStore, IconChevronLeft, IconMapPin } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { copyPlaceToTrip, exploreSavedInTrips, removeExploreCopies } from '@/lib/placeMutations'
import { logExploreEvent } from '@/lib/exploreMutations'
import { countryFlag } from '@/lib/countries'
import { formatDateRange } from '@/lib/format'
import type { Place } from '@/lib/database.types'

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
  // multi-branch step 2: the trip that was tapped, waiting for a branch choice
  const [pendingTrip, setPendingTrip] = useState<string | null>(null)

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
    if (sourceExploreId) {
      exploreSavedInTrips(sourceExploreId, myTrips.map((t) => t.id)).then((ids) => setDone(new Set(ids)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sourceExploreId])

  async function saveTo(tripId: string, planBranch: number | null) {
    if (!place) return
    setBusyId(tripId)
    await copyPlaceToTrip(place, tripId, sourceExploreId, { planBranch })
    if (sourceExploreId && user) logExploreEvent(sourceExploreId, user.id, 'save')
    setDone((prev) => new Set(prev).add(tripId))
    setBusyId(null)
    setPendingTrip(null)
    onChanged?.()
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
    // multi-branch: ask WHICH branch before saving (step 2 in the same drawer)
    if (branches.length > 0) { setPendingTrip(tripId); return }
    await saveTo(tripId, null)
  }

  const pending = pendingTrip ? myTrips.find((t) => t.id === pendingTrip) : null

  return (
    <Drawer open={open} onClose={onClose} title={pending ? 'ไปสาขาไหน?' : 'เซฟสถานที่ไปทริปไหน'}>
      <div className="flex items-center gap-2 mb-3 text-[13px]">
        <IconHeartFilled size={15} className="text-brand" />
        <span className="font-medium truncate">{place?.name}</span>
        {pending && (
          <span className="chip !bg-brand-soft !text-brand-dark shrink-0 ml-auto">
            {pending.flag || countryFlag(pending.country)} {pending.name}
          </span>
        )}
      </div>

      {/* step 2 — pick the branch this trip will go to */}
      {pending ? (
        <div className="space-y-1.5">
          {hasOwnLocation && (
            <button onClick={() => saveTo(pending.id, null)} disabled={!!busyId}
              className="w-full flex items-center gap-2.5 card p-3 text-left enabled:hover:bg-surface-2/40">
              <span className="size-8 rounded-[8px] grid place-items-center shrink-0"
                style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-mid)' }}><IconMapPin size={16} /></span>
              <span className="text-[13.5px] font-medium flex-1 min-w-0 truncate">ที่ตั้งหลัก</span>
              {busyId === pending.id ? <IconLoader2 size={16} className="animate-spin text-ink-3" />
                : <span className="btn-link text-[12px] shrink-0">เซฟสาขานี้</span>}
            </button>
          )}
          {branches.map((b, i) => (
            <button key={i} onClick={() => saveTo(pending.id, i)} disabled={!!busyId}
              className="w-full flex items-center gap-2.5 card p-3 text-left enabled:hover:bg-surface-2/40">
              <span className="size-8 rounded-[8px] grid place-items-center shrink-0"
                style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-mid)' }}><IconBuildingStore size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium truncate">{b.label || `สาขา ${i + 1}`}</div>
                {(b.line || b.station) && (
                  <div className="flex items-center gap-1.5 text-[11px] text-ink-3 mt-0.5">
                    <span className="size-2 rounded-full shrink-0" style={{ background: b.color ?? '#888780' }} />
                    <span className="truncate">{b.line}{b.station ? ` · ${b.station}` : ''}</span>
                  </div>
                )}
              </div>
              {busyId === pending.id ? <IconLoader2 size={16} className="animate-spin text-ink-3" />
                : <span className="btn-link text-[12px] shrink-0">เซฟสาขานี้</span>}
            </button>
          ))}
          <button onClick={() => setPendingTrip(null)} disabled={!!busyId}
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
