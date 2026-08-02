import { Fragment, useEffect, useMemo, useState } from 'react'
import { IconCheck, IconLoader2, IconHeartFilled } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { copyPlaceToTrip, savedExploreIdsInTrip } from '@/lib/placeMutations'
import { exploreAsPlace, logExploreEvent } from '@/lib/exploreMutations'
import { toast } from '@/lib/toast'
import { countryFlag } from '@/lib/countries'
import { formatDateRange } from '@/lib/format'
import { tripMatchesPlace, isPastTrip, sortTripsForSave, placeTokens } from '@/lib/tripPick'
import type { ExplorePlace } from '@/lib/database.types'

/**
 * Save a whole shortlist into one trip in a single tap.
 *
 * Deliberately shorter than the single-place dialog: it asks which trip and
 * nothing else. Days and branches are per-visit decisions, and answering them
 * ten times over is not a bulk action — everything lands in the trip's Location
 * list, where the itinerary picks it up later.
 */
export function SaveAllToTripDialog({ items, open, onClose, onChanged }: {
  items: ExplorePlace[]
  open: boolean
  onClose: () => void
  onChanged?: () => void
}) {
  const { trips, trip: currentTrip, reload } = useTrip()
  const { user } = useAuth()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => { if (open) { setBusyId(null); setProgress(0) } }, [open])

  // trips whose country/city matches ANY of the places — the shortlist is a
  // whole country, so it should reach every trip inside it
  const tokens = useMemo(() => placeTokens(items), [items])
  const shownTrips = useMemo(() => sortTripsForSave(
    tokens.length ? trips.filter((t) => tripMatchesPlace(t, tokens)) : trips,
  ), [trips, tokens])
  const firstPastId = shownTrips.find(isPastTrip)?.id

  async function saveAll(tripId: string) {
    setBusyId(tripId)
    setProgress(0)
    const already = await savedExploreIdsInTrip(tripId, items.map((i) => i.id))
    const todo = items.filter((i) => !already.has(i.id))

    let ok = 0
    // one at a time: ten parallel inserts buy nothing and make a partial
    // failure impossible to report honestly
    for (const it of todo) {
      const { error } = await copyPlaceToTrip(exploreAsPlace(it), tripId, it.id)
      if (!error) {
        ok++
        if (user) logExploreEvent(it.id, user.id, 'save')
      }
      setProgress((n) => n + 1)
    }

    setBusyId(null)
    onChanged?.()
    if (tripId === currentTrip?.id) void reload()
    onClose()

    const skipped = items.length - todo.length
    if (!ok && skipped) toast.success('อยู่ในทริปนี้ครบแล้ว')
    else if (!ok) toast.error('เซฟไม่สำเร็จ — ลองใหม่อีกครั้ง')
    else toast.success(`เซฟ ${ok} ที่เข้าทริปแล้ว${skipped ? ` · ข้ามที่มีอยู่แล้ว ${skipped} ที่` : ''}`)
  }

  return (
    <Drawer open={open} onClose={onClose} title="เซฟทั้งหมด">
      <div className="flex items-center gap-2 mb-3 text-[13px]">
        <IconHeartFilled size={15} className="text-brand" />
        <span className="font-medium">{items.length} ที่ในรายการนี้</span>
      </div>

      {shownTrips.length === 0 ? (
        <div className="card p-5 text-center text-[12px] text-ink-3">
          {trips.length === 0
            ? 'ยังไม่มีทริปให้เซฟ — สร้างทริป หรือให้เจ้าของแชร์ทริปเข้ามาก่อน'
            : 'ยังไม่มีทริปของประเทศนี้ — สร้างทริปก่อนแล้วค่อยเซฟได้'}
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="text-[13.5px] font-semibold mb-2">เซฟไปทริปไหน?</div>
          {shownTrips.map((t) => (
            <Fragment key={t.id}>
              {t.id === firstPastId && (
                <div className="flex items-center gap-2 pt-2 pb-0.5">
                  <span className="h-px flex-1" style={{ background: 'var(--color-line)' }} />
                  <span className="text-[10.5px] text-ink-3">ทริปที่ผ่านไปแล้ว</span>
                  <span className="h-px flex-1" style={{ background: 'var(--color-line)' }} />
                </div>
              )}
              <button onClick={() => void saveAll(t.id)} disabled={!!busyId}
                className={['relative w-full flex items-center gap-2.5 card p-3 text-left enabled:hover:bg-surface-2/40',
                  isPastTrip(t) ? 'opacity-60' : ''].join(' ')}>
                <span className="text-[20px] shrink-0">{t.flag || countryFlag(t.country)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium truncate">{t.name}</div>
                  <div className="text-[11px] text-ink-3">{formatDateRange(t.start_date, t.end_date) || t.country || '—'}</div>
                </div>
                {busyId === t.id
                  ? <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-3 shrink-0 tabular-nums">
                      <IconLoader2 size={15} className="animate-spin" /> {progress}/{items.length}
                    </span>
                  : <span className="btn-link text-[12px] shrink-0 inline-flex items-center gap-1"><IconCheck size={13} /> เซฟทั้งหมด</span>}
              </button>
            </Fragment>
          ))}
          <p className="text-[11px] text-ink-3 pt-1.5">
            ที่ซ้ำกับที่มีอยู่ในทริปแล้วจะถูกข้ามให้อัตโนมัติ
          </p>
        </div>
      )}
    </Drawer>
  )
}
