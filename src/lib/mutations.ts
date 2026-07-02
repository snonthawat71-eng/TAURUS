import { supabase } from './supabase'
import { updateWithVersion } from './concurrency'
import { runOrQueue } from './offlineQueue'
import { toastDbError } from './toast'
import type { ItineraryStop, Transit } from './database.types'

/** Surface a write failure (these paths are often fire-and-forget in the UI —
 *  without this a failed write reverts silently on the next realtime reload). */
async function surfaced<T extends { error: unknown }>(p: PromiseLike<T>): Promise<T> {
  const res = await p
  toastDbError(res.error)
  return res
}

// ---- Days ----

export async function addDay(trip_id: string, position: number, day_date: string | null, id: string = crypto.randomUUID()) {
  const payload = { id, trip_id, position, day_date, label: 'วันใหม่' }
  return surfaced(runOrQueue(() => supabase.from('itinerary_days').insert(payload), { kind: 'insert', table: 'itinerary_days', payload }))
}

export async function updateDay(id: string, fields: { label?: string; day_date?: string | null }, expectedVersion?: number) {
  return updateWithVersion('itinerary_days', id, { ...fields }, expectedVersion)
}

export async function deleteDay(id: string) {
  return surfaced(runOrQueue(() => supabase.from('itinerary_days').delete().eq('id', id), { kind: 'delete', table: 'itinerary_days', id }))
}

/** Persist a new day order by writing each day's position. */
export async function persistDayOrder(days: { id: string }[]) {
  const results = await Promise.all(
    days.map((d, i) => supabase.from('itinerary_days').update({ position: i }).eq('id', d.id)),
  )
  toastDbError(results.find((r) => r.error)?.error)
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
  done?: boolean | null
  done_at?: string | null
}

// link_mode column is optional (added by extra_columns.sql); strip it if absent
export async function addStop(trip_id: string, day_id: string, position: number, input: StopInput, id: string = crypto.randomUUID()) {
  const payload: Record<string, unknown> = {
    id, trip_id, day_id, position,
    time: input.time ?? null, place_name: input.place_name ?? null,
    note: input.note ?? null, map_url: input.map_url ?? null,
    transit: input.transit ?? null, link_mode: input.link_mode ?? null,
  }
  return surfaced(runOrQueue(async () => {
    let res = await supabase.from('itinerary_stops').insert(payload)
    if (res.error && res.error.message.includes('link_mode')) {
      const { link_mode: _omit, ...rest } = payload
      void _omit
      res = await supabase.from('itinerary_stops').insert(rest)
    }
    return res
  }, { kind: 'insert', table: 'itinerary_stops', payload }))
}

export async function updateStop(id: string, fields: StopInput, expectedVersion?: number) {
  return updateWithVersion('itinerary_stops', id, { ...fields }, expectedVersion, (p, msg) => {
    // optional columns may not exist yet — strip the whole group the error names and
    // retry (done/done_at ship together, so drop both at once)
    const groups: string[][] = [['link_mode'], ['skip_transit'], ['done', 'done_at']]
    const g = groups.find((cols) => cols.some((c) => msg.includes(c) && c in p))
    if (g) { const rest = { ...p }; for (const c of g) delete rest[c]; return rest }
    return null
  })
}

/** Toggle a stop's shared check-in. Deliberately NO version guard: a fast
 *  double-tap must always persist the latest state — a version conflict would
 *  silently drop the write and the next realtime reload would flip it back. */
export async function setStopDone(id: string, done: boolean, done_at: string | null) {
  return surfaced(supabase.from('itinerary_stops').update({ done, done_at }).eq('id', id))
}

export async function deleteStop(id: string) {
  return surfaced(runOrQueue(() => supabase.from('itinerary_stops').delete().eq('id', id), { kind: 'delete', table: 'itinerary_stops', id }))
}

/** Persist a new order by writing each stop's position (and day_id, so a stop can
 *  move to another day). Each stop carries its own `position`/`day_id`; falls back
 *  to the array index when position is absent. Deliberately does NOT touch `time`
 *  — reordering never changes times, and writing them back here would clobber a
 *  teammate's concurrent time edit (last-writer-wins). */
export async function persistStopOrder(stops: ItineraryStop[]) {
  const results = await Promise.all(
    stops.map((s, i) =>
      supabase.from('itinerary_stops')
        .update({ position: s.position ?? i, day_id: s.day_id })
        .eq('id', s.id),
    ),
  )
  toastDbError(results.find((r) => r.error)?.error)
}
