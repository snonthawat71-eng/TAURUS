import { useEffect, useState } from 'react'
import { IconLoader2, IconCheck, IconMapPin, IconBuildingStore, IconPlus, IconCalendarPlus } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { useTrip } from '@/contexts/TripContext'
import { addStop } from '@/lib/mutations'
import { setPlanBranch } from '@/lib/placeMutations'
import { toast } from '@/lib/toast'
import { formatLongDate } from '@/lib/format'
import { branchesOf, hasOwnLocation as placeHasOwnLocation } from '@/lib/branches'
import type { Place } from '@/lib/database.types'

/**
 * Pick which itinerary day to put a place on. Choosing a day appends it as a
 * stop there, which is also what puts it "in the plan" — there is no separate
 * flag to set and no way to be in the plan without a day.
 *
 * Multi-branch places ask WHICH branch. The choice is stored on the STOP
 * (branch_idx) so one place can sit on several days at different branches, and
 * mirrored to places.plan_branch as the default for next time.
 */
export function AddToDayDialog({ place, open, onClose }: {
  place: Place | null
  open: boolean
  onClose: () => void
}) {
  const { trip, days, stops, reload } = useTrip()
  const [busy, setBusy] = useState<string | null>(null)

  const branches = branchesOf(place)
  const hasOwnLocation = placeHasOwnLocation(place)
  // which branch to plan; null = main location. Default: main when it exists,
  // else the first branch (same rule as the detail view).
  const [branchIdx, setBranchIdx] = useState<number | null>(null)
  useEffect(() => {
    if (!open) return
    // a branch picked earlier (e.g. when saving from Explore) is the default
    if (place?.plan_branch != null && branches[place.plan_branch]) setBranchIdx(place.plan_branch)
    else setBranchIdx(branches.length && !hasOwnLocation ? 0 : null)
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
      // per-VISIT branch: the same place can be scheduled on another day at a
      // different branch without the two overwriting each other
      branch_idx: branchIdx,
    })
    // keep the place-level choice as the DEFAULT for the next visit
    await setPlanBranch(place.id, branchIdx)
    await reload()
    setBusy(null)
    toast.success(`เพิ่ม "${place.name}"${branchNote} ลง Day ${dayNo} แล้ว`)
    onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title="ใส่ลงวัน">
      <div className="space-y-3">
        {/* which place (and branch) we're adding */}
        <div className="flex items-center gap-2 text-[13px]">
          <IconMapPin size={15} className="text-brand shrink-0" />
          <span className="font-medium truncate">{place?.name}</span>
        </div>

        {/* multi-branch: ask which branch this plan means */}
        {branches.length > 0 && (
          <div>
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

        <div className="text-[12px] font-medium text-ink-2 flex items-center gap-1.5">
          <IconCalendarPlus size={14} className="text-brand" /> เลือกวันที่จะไป
        </div>

        {days.length === 0 ? (
          <div className="card p-5 text-center text-[12px] text-ink-3">
            ยังไม่มีวันในแผน — เพิ่มวันในหน้า Itinerary ก่อน แล้วค่อยเลือกวันได้
          </div>
        ) : (
          <div className="space-y-2">
            {days.map((d, i) => {
              const count = stops.filter((s) => s.day_id === d.id).length
              return (
                <button key={d.id} onClick={() => addToDay(d.id, i + 1)} disabled={!!busy}
                  className="w-full flex items-center gap-3 card p-3 text-left enabled:hover:bg-surface-2/40 disabled:opacity-60">
                  <span className="chip !bg-brand-soft !text-brand-dark !font-medium shrink-0">Day {i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate">{formatLongDate(d.day_date)}</div>
                    <div className="text-[11px] text-ink-3 truncate">{count} กิจกรรม{d.label ? ` · ${d.label}` : ''}</div>
                  </div>
                  {busy === d.id ? (
                    <IconLoader2 size={16} className="animate-spin text-ink-3 shrink-0" />
                  ) : (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 h-7 text-[11.5px] font-medium"
                      style={{ background: 'var(--color-brand)', color: '#fff' }}>
                      <IconPlus size={13} /> เพิ่ม
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

      </div>
    </Drawer>
  )
}
