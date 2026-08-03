import { Fragment, useEffect, useMemo, useState } from 'react'
import { IconCheck, IconLoader2, IconHeartFilled, IconX } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { copyPlaceToTrip, exploreSavedByTrip, removeManyExploreCopies } from '@/lib/placeMutations'
import { exploreAsPlace, logExploreEvent } from '@/lib/exploreMutations'
import { confirmDialog } from '@/lib/confirm'
import { toast } from '@/lib/toast'
import { countryFlag } from '@/lib/countries'
import { formatDateRange } from '@/lib/format'
import { tripMatchesPlace, isPastTrip, sortTripsForSave, placeTokens, cityOf } from '@/lib/tripPick'
import type { ExplorePlace, Trip } from '@/lib/database.types'

/** "Shenzhen" · "Shenzhen, Beijing" · "Shenzhen, Beijing +2" */
function cityList(places: ExplorePlace[]): string {
  const names = [...new Set(places.map(cityOf).filter(Boolean))]
  if (!names.length) return 'เมืองเดียวกัน'
  return names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '')
}

/**
 * Save a whole shortlist into one trip in a single tap — and take it back out
 * the same way.
 *
 * A country's shortlist spans its cities, and a trip does not: saving Japan's
 * top ten into a Tokyo trip would drop Osaka places into it, which saving one
 * at a time has always refused to do. So each trip takes only the places whose
 * city it actually covers, the row says how many that is before you tap, and
 * the toast says how many were left behind.
 *
 * It asks which trip and nothing else. Days and branches are per-visit
 * decisions, and answering them ten times over is not a bulk action —
 * everything lands in the trip's Location list.
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
  /** per trip: which of these Explore items it already holds */
  const [held, setHeld] = useState<Map<string, Set<string>>>(new Map())

  const ids = useMemo(() => items.map((i) => i.id), [items])

  // which of the places each trip's own cities actually cover — the same test
  // the single-place dialog uses to decide whether a trip may be offered
  const fits = useMemo(() => {
    const m = new Map<string, ExplorePlace[]>()
    for (const t of trips) {
      m.set(t.id, items.filter((i) => {
        const tokens = placeTokens([i])
        return tokens.length === 0 || tripMatchesPlace(t, tokens)
      }))
    }
    return m
  }, [trips, items])

  const shownTrips = useMemo(
    () => sortTripsForSave(trips.filter((t) => (fits.get(t.id)?.length ?? 0) > 0)),
    [trips, fits],
  )
  const firstPastId = shownTrips.find(isPastTrip)?.id

  useEffect(() => {
    if (!open) return
    setBusyId(null); setProgress(0); setHeld(new Map())
    let off = false
    void exploreSavedByTrip(shownTrips.map((t) => t.id), ids).then((m) => { if (!off) setHeld(m) })
    return () => { off = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ids.join(','), shownTrips.map((t) => t.id).join(',')])

  function finish(tripId: string) {
    setBusyId(null)
    onChanged?.()
    if (tripId === currentTrip?.id) void reload()
    onClose()
  }

  async function saveAll(t: Trip) {
    const fit = fits.get(t.id) ?? []
    setBusyId(t.id); setProgress(0)
    const already = held.get(t.id) ?? new Set<string>()
    const todo = fit.filter((i) => !already.has(i.id))

    let ok = 0
    // one at a time: ten parallel inserts buy nothing and make a partial
    // failure impossible to report honestly
    for (const it of todo) {
      const { error } = await copyPlaceToTrip(exploreAsPlace(it), t.id, it.id)
      if (!error) {
        ok++
        if (user) logExploreEvent(it.id, user.id, 'save')
      }
      setProgress((n) => n + 1)
    }

    finish(t.id)
    const dupes = fit.length - todo.length
    const offCity = items.length - fit.length
    const notes = [
      dupes ? `ข้ามที่มีอยู่แล้ว ${dupes} ที่` : '',
      offCity ? `ไม่ได้เซฟ ${offCity} ที่ (คนละเมืองกับทริป)` : '',
    ].filter(Boolean).join(' · ')
    if (!ok && dupes) toast.success(`อยู่ในทริปนี้ครบแล้ว${offCity ? ` · ${offCity} ที่คนละเมือง` : ''}`)
    else if (!ok) toast.error('เซฟไม่สำเร็จ — ลองใหม่อีกครั้ง')
    else toast.success(`เซฟ ${ok} ที่เข้าทริปแล้ว${notes ? ` · ${notes}` : ''}`)
  }

  async function removeAll(t: Trip, n: number) {
    if (!(await confirmDialog({
      message: `เอาทั้ง ${n} ที่ออกจากทริปนี้? ถ้ามีจุดแวะของที่เหล่านี้ใน Itinerary จะถูกลบไปด้วย`,
      danger: true, confirmLabel: 'เอาออกทั้งหมด',
    }))) return
    setBusyId(t.id)
    const fit = fits.get(t.id) ?? []
    const { removed, stopsRemoved } = await removeManyExploreCopies(fit.map((i) => i.id), t.id)
    finish(t.id)
    toast.success(stopsRemoved > 0
      ? `เอาออกแล้ว ${removed} ที่ · ลบจุดแวะใน Itinerary ${stopsRemoved} จุดด้วย`
      : `เอาออกจากทริปแล้ว ${removed} ที่`)
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
            : 'ยังไม่มีทริปของเมืองเหล่านี้ — สร้างทริปก่อนแล้วค่อยเซฟได้'}
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="text-[13.5px] font-semibold mb-2">เซฟไปทริปไหน?</div>
          {shownTrips.map((t) => {
            const fit = fits.get(t.id) ?? []
            const heldHere = held.get(t.id) ?? new Set<string>()
            const n = fit.filter((i) => heldHere.has(i.id)).length
            const full = n >= fit.length
            const partial = fit.length < items.length
            return (
              <Fragment key={t.id}>
                {t.id === firstPastId && (
                  <div className="flex items-center gap-2 pt-2 pb-0.5">
                    <span className="h-px flex-1" style={{ background: 'var(--color-line)' }} />
                    <span className="text-[10.5px] text-ink-3">ทริปที่ผ่านไปแล้ว</span>
                    <span className="h-px flex-1" style={{ background: 'var(--color-line)' }} />
                  </div>
                )}
                <button onClick={() => void (full ? removeAll(t, n) : saveAll(t))} disabled={!!busyId}
                  title={full ? 'แตะเพื่อเอาออกจากทริปนี้ทั้งหมด' : undefined}
                  className={['relative w-full flex items-center gap-2.5 card p-3 text-left enabled:hover:bg-surface-2/40',
                    isPastTrip(t) ? 'opacity-60' : ''].join(' ')}>
                  <span className="text-[20px] shrink-0">{t.flag || countryFlag(t.country)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium truncate">{t.name}</div>
                    <div className="text-[11px] text-ink-3 truncate">
                      {/* the honest bit: this trip only takes the places it
                          covers — and WHICH cities those are, or a Hong Kong
                          trip turning up on China's page looks like a bug */}
                      {partial
                        ? `ตรงกับทริปนี้ ${fit.length} ที่ · ${cityList(fit)}`
                        : formatDateRange(t.start_date, t.end_date) || t.country || '—'}
                    </div>
                  </div>
                  {busyId === t.id
                    ? <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-3 shrink-0 tabular-nums">
                        <IconLoader2 size={15} className="animate-spin" />
                        {full ? '' : `${progress}/${fit.length}`}
                      </span>
                    : full ? (
                      <span className="inline-flex items-center gap-1.5 shrink-0">
                        <span className="chip !bg-brand-soft !text-brand-dark"><IconCheck size={12} /> เซฟครบแล้ว</span>
                        <span className="inline-flex items-center gap-0.5 text-[12px] text-[#D85A30]"><IconX size={12} /> เอาออก</span>
                      </span>
                    ) : (
                      <span className="btn-link text-[12px] shrink-0 inline-flex items-center gap-1">
                        <IconCheck size={13} /> เซฟ {fit.length - n} ที่
                      </span>
                    )}
                </button>
              </Fragment>
            )
          })}
          <p className="text-[11px] text-ink-3 pt-1.5">
            แต่ละทริปจะรับเฉพาะที่ที่อยู่ในเมืองของทริปนั้น และข้ามที่ที่เซฟไว้แล้วให้อัตโนมัติ
          </p>
        </div>
      )}
    </Drawer>
  )
}
