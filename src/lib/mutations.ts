import { supabase } from './supabase'
import type { ItineraryStop, Transit } from './database.types'

// ---- Days ----

export async function addDay(trip_id: string, position: number, day_date: string | null) {
  return supabase.from('itinerary_days').insert({
    id: crypto.randomUUID(),
    trip_id,
    position,
    day_date,
    label: 'วันใหม่',
  })
}

export async function updateDay(id: string, fields: { label?: string; day_date?: string | null }) {
  return supabase.from('itinerary_days').update(fields).eq('id', id)
}

export async function deleteDay(id: string) {
  return supabase.from('itinerary_days').delete().eq('id', id)
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
}

// link_mode column is optional (added by extra_columns.sql); strip it if absent
export async function addStop(trip_id: string, day_id: string, position: number, input: StopInput) {
  const payload: Record<string, unknown> = {
    id: crypto.randomUUID(), trip_id, day_id, position,
    time: input.time ?? null, place_name: input.place_name ?? null,
    note: input.note ?? null, map_url: input.map_url ?? null,
    transit: input.transit ?? null, link_mode: input.link_mode ?? null,
  }
  let res = await supabase.from('itinerary_stops').insert(payload)
  if (res.error && res.error.message.includes('link_mode')) {
    const { link_mode: _omit, ...rest } = payload
    void _omit
    res = await supabase.from('itinerary_stops').insert(rest)
  }
  return res
}

export async function updateStop(id: string, fields: StopInput) {
  const payload: Record<string, unknown> = { ...fields }
  let res = await supabase.from('itinerary_stops').update(payload).eq('id', id)
  if (res.error && res.error.message.includes('link_mode')) {
    const { link_mode: _omit, ...rest } = payload
    void _omit
    res = await supabase.from('itinerary_stops').update(rest).eq('id', id)
  }
  return res
}

export async function deleteStop(id: string) {
  return supabase.from('itinerary_stops').delete().eq('id', id)
}

/** Persist a new order by writing each stop's position. */
export async function persistStopOrder(stops: ItineraryStop[]) {
  await Promise.all(
    stops.map((s, i) =>
      supabase.from('itinerary_stops').update({ position: i }).eq('id', s.id),
    ),
  )
}
