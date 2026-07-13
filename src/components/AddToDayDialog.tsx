import { useEffect, useState } from 'react'
import { IconLoader2, IconCheck, IconMapPin, IconBuildingStore } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { useTrip } from '@/contexts/TripContext'
import { addStop } from '@/lib/mutations'
import { setInPlan } from '@/lib/placeMutations'
import { toast } from '@/lib/toast'
import { formatLongDate } from '@/lib/format'
import type { Place } from '@/lib/database.types'

/**
 * Pick which itinerary day to schedule a place on when adding it to the plan.
 * Choosing a day appends the place as a stop on that day (and flags it in_plan);
 * "ใส่ในแพลนเฉย ๆ" just flags it without scheduling a day.
 * Multi-branch places first ask WHICH branch — the choice is stored in
 * plan_branch so map links point at that branch, not the main location.
 */
export function AddToDayDialog({ place, open, onClose }: {
  place: Place | null
  open: boolean
  onClose: () => void
}) {
  const { trip, days, stops, reload } = useTrip()
  const [busy, setBusy] = useState<string | null>(null)

  const branches = place?.branches ?? []
  const hasOwnLocation = !!(place && (place.map_url || place.station_name || place.station_line))
  // which branch to plan; null = main location. Default: main when it exists,
  // else the first branch (same rule as the detail view).
  const [branchIdx, setBranchIdx] = useState<number | null>(null)
  useEffect(() => {
    if (open) setBranchIdx(branches.length && !hasOwnLocation ? 0 : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, place?.id])

  const selBranch = branchIdx != null ? branches[branchIdx] : null
  const branchNote = selBranch ? ` (${selBranch.label || `สาขา ${branchIdx! + 1}`})` : ''

  async function addToDay(dayId: string, dayNo: number) {
    if (!trip || !place) return
    setBusy(dayId)
    const pos = stops.filter((s) => s.day_id === dayId).length
    await addStop(trip.id, dayId, pos, {
      place_name: place.name, map_url: selBranch?.map_url || place.map_url, note: place.note, link_mode: 'detail',
    })
    await setInPlan(place.id, true, branchIdx)
    await reload()
    setBusy(null)
    toast.success(`เพิ่ม "${place.name}"${branchNote} ลง Day ${dayNo} แล้ว`)
    onClose()
  }

  async function justPlan() {
    if (!place) return
    setBusy('plan')
    await setInPlan(place.id, true, branchIdx)
    await reload()
    setBusy(null)
    onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title="เลือกวันที่จะไป">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[13px] mb-1">
          <IconMapPin size={15} className="text-brand shrink-0" />
          <span className="font-medium truncate">{place?.name}</span>
        </div>

        {/* multi-branch: ask which branch this plan means */}
        {branches.length > 0 && (
          <div className="mb-2">
            <div className="text-[11px] text-ink-3 mb-1.5 flex items-center gap-1">
              <IconBuildingStore size={12} /> ไปสาขาไหน?
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {hasOwnLocation && (
                <button onClick={() => setBranchIdx(null)}
                  className={['chip shrink-0', branchIdx === null ? '!bg-brand-soft !text-brand-dark' : ''].join(' ')}
                  style={branchIdx === null ? { border: '0.5px solid var(--color-brand-border)' } : undefined}>
                  {branchIdx === null && <IconCheck size={12} />} ที่ตั้งหลัก
                </button>
              )}
              {branches.map((b, i) => (
                <button key={i} onClick={() => setBranchIdx(i)}
                  className={['chip shrink-0', branchIdx === i ? '!bg-brand-soft !text-brand-dark' : ''].join(' ')}
                  style={branchIdx === i ? { border: '0.5px solid var(--color-brand-border)' } : undefined}>
                  {branchIdx === i && <IconCheck size={12} />} {b.label || `สาขา ${i + 1}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {days.length === 0 ? (
          <div className="card p-5 text-center text-[12px] text-ink-3">
            ยังไม่มีวันในแผน — เพิ่มวันในหน้า Itinerary ก่อน แล้วค่อยเลือกวันได้
          </div>
        ) : (
          days.map((d, i) => {
            const count = stops.filter((s) => s.day_id === d.id).length
            return (
              <button key={d.id} onClick={() => addToDay(d.id, i + 1)} disabled={!!busy}
                className="w-full flex items-center gap-3 card p-3 text-left enabled:hover:bg-surface-2/40 disabled:opacity-60">
                <span className="chip !bg-brand-soft !text-brand-dark !font-medium shrink-0">Day {i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium truncate">{formatLongDate(d.day_date)}</div>
                  <div className="text-[11px] text-ink-3 truncate">{count} กิจกรรม{d.label ? ` · ${d.label}` : ''}</div>
                </div>
                {busy === d.id
                  ? <IconLoader2 size={16} className="animate-spin text-ink-3 shrink-0" />
                  : <span className="btn-link text-[12px] shrink-0">เพิ่มลงวันนี้</span>}
              </button>
            )
          })
        )}

        <button onClick={justPlan} disabled={!!busy}
          className="w-full flex items-center justify-center gap-1.5 h-10 text-[12px] text-ink-3 hover:text-ink-2 disabled:opacity-60">
          {busy === 'plan' ? <IconLoader2 size={15} className="animate-spin" /> : <IconCheck size={15} />}
          ใส่ในแพลนเฉย ๆ (ยังไม่เลือกวัน)
        </button>
      </div>
    </Drawer>
  )
}
