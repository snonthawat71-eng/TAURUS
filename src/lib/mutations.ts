import { supabase } from './supabase'
import { updateWithVersion } from './concurrency'
import { runOrQueue } from './offlineQueue'
import type { ItineraryStop, Transit } from './database.types'

// ---- Days ----

export async function addDay(trip_id: string, position: number, day_date: string | null) {
  const payload = { id: crypto.randomUUID(), trip_id, position, day_date, label: 'วันใหม่' }
  return runOrQueue(() => supabase.from('itinerary_days').insert(payload), { kind: 'insert', table: 'itinerary_days', payload })
}

export async function updateDay(id: string, fields: { label?: string; day_date?: string | null }, expectedVersion?: number) {
  return updateWithVersion('itinerary_days', id, { ...fields }, expectedVersion)
}

export async function deleteDay(id: string) {
  return runOrQueue(() => supabase.from('itinerary_days').delete().eq('id', id), { kind: 'delete', table: 'itinerary_days', id })
}

/** Persist a new day order by writing each day's position. */
export async function persistDayOrder(days: { id: string }[]) {
  await Promise.all(
    days.map((d, i) => supabase.from('itinerary_days').update({ position: i }).eq('id', d.id)),
  )
}

// ---- Stops ----

export interface StopInput {
  time?: string | null
  place_name?: string | null
  note?: string | null
  map_url?: string | null
  transit?: Transit | null
  link_mode?: string | null
  skip_transit?: boolean | null
}

// link_mode column is optional (added by extra_columns.sql); strip it if absent
export async function addStop(trip_id: string, day_id: string, position: number, input: StopInput) {
  const payload: Record<string, unknown> = {
    id: crypto.randomUUID(), trip_id, day_id, position,
    time: input.time ?? null, place_name: input.place_name ?? null,
    note: input.note ?? null, map_url: input.map_url ?? null,
    transit: input.transit ?? null, link_mode: input.link_mode ?? null,
  }
  return runOrQueue(async () => {
    let res = await supabase.from('itinerary_stops').insert(payload)
    if (res.error && res.error.message.includes('link_mode')) {
      const { link_mode: _omit, ...rest } = payload
      void _omit
      res = await supabase.from('itinerary_stops').insert(rest)
    }
    return res
  }, { kind: 'insert', table: 'itinerary_stops', payload })
}

export async function updateStop(id: string, fields: StopInput, expectedVersion?: number) {
  return updateWithVersion('itinerary_stops', id, { ...fields }, expectedVersion, (p, msg) => {
    // optional columns may not exist yet — strip whichever the error names and retry
    const col = (['link_mode', 'skip_transit'] as const).find((c) => msg.includes(c) && c in p)
    if (col) { const { [col]: _omit, ...rest } = p; void _omit; return rest }
    return null
  })
}

export async function deleteStop(id: string) {
  return runOrQueue(() => supabase.from('itinerary_stops').delete().eq('id', id), { kind: 'delete', table: 'itinerary_stops', id })
}

/** Persist a new order by writing each stop's position. The `time` travels with
 *  the slot (position), not the activity — so reordering keeps times in order. */
export async function persistStopOrder(stops: ItineraryStop[]) {
  await Promise.all(
    stops.map((s, i) =>
      supabase.from('itinerary_stops').update({ position: i, time: s.time ?? null }).eq('id', s.id),
    ),
  )
}
