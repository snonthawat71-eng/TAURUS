import { useEffect, useState } from 'react'
import type { Trip, TripSegment } from './database.types'

// Multi-city trips (option B): the trip carries ordered `segments`, each with a
// handover datetime (`until`, local time 'YYYY-MM-DDTHH:mm'). Everything that
// shows "the trip's" city/currency/timezone/flag should follow the segment
// that is active RIGHT NOW — e.g. Hongkong until 4 Jul 11:00, then Shenzhen:
// at 11:00 the cover card, FX rate and reminder clock all flip to Shenzhen.

type TripLike = Pick<Trip, 'segments' | 'timezone' | 'currency' | 'flag' | 'cities'> | null | undefined

/** Wall-clock 'YYYY-MM-DDTHH:mm' in a timezone (device tz when absent/broken). */
function nowStrInTz(tz?: string | null): string {
  try {
    const p: Record<string, string> = {}
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || undefined, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date())
    for (const x of parts) p[x.type] = x.value
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
  } catch {
    return new Date().toISOString().slice(0, 16)
  }
}

/** The segment the trip is in right now (each `until` read in that segment's
 *  own timezone). No segments → null (caller falls back to the trip fields). */
export function activeSegment(trip: TripLike): TripSegment | null {
  const segs = trip?.segments
  if (!Array.isArray(segs) || segs.length === 0) return null
  for (const s of segs) {
    if (!s) continue
    if (!s.until) return s
    if (nowStrInTz(s.tz ?? trip?.timezone) < s.until) return s
  }
  return segs[segs.length - 1]
}

// Effective trip identity — active segment first, trip-level fields as fallback.
export const tripCurrency = (trip: TripLike): string | null => activeSegment(trip)?.currency ?? trip?.currency ?? null
export const tripTz = (trip: TripLike): string | null => activeSegment(trip)?.tz ?? trip?.timezone ?? null
export const tripFlag = (trip: TripLike): string | null => activeSegment(trip)?.flag ?? trip?.flag ?? null
export const tripActiveCity = (trip: TripLike): string | null => activeSegment(trip)?.city ?? null

/** activeSegment that re-evaluates every minute, so an on-screen card/chip
 *  flips by itself the moment the handover time passes. */
export function useActiveSegment(trip: TripLike): TripSegment | null {
  const [, setTick] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(iv)
  }, [])
  return activeSegment(trip)
}
