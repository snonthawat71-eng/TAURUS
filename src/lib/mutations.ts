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

// ---- Stops ----

export interface StopInput {
  time?: string | null
  place_name?: string | null
  note?: string | null
  map_url?: string | null
  transit?: Transit | null
}

export async function addStop(trip_id: string, day_id: string, position: number, input: StopInput) {
  return supabase.from('itinerary_stops').insert({
    id: crypto.randomUUID(),
    trip_id,
    day_id,
    position,
    time: input.time ?? null,
    place_name: input.place_name ?? null,
    note: input.note ?? null,
    map_url: input.map_url ?? null,
    transit: input.transit ?? null,
  })
}

export async function updateStop(id: string, fields: StopInput) {
  return supabase.from('itinerary_stops').update(fields).eq('id', id)
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
