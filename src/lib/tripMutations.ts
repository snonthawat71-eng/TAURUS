import { supabase } from './supabase'
import type { Flight, HotelRoom } from './database.types'

// ---------- Travelers ----------

export interface TravelerInput {
  nickname?: string | null
  full_name?: string | null
  avatar_color?: string | null
}

/** Returns true if a PostgREST error is "column avatar_color does not exist". */
function isMissingAvatarCol(err: { message?: string } | null) {
  return !!err?.message && /avatar_color/i.test(err.message) && /column|schema/i.test(err.message)
}

export async function addTraveler(trip_id: string, input: TravelerInput) {
  const full = { id: crypto.randomUUID(), trip_id, ...input }
  let res = await supabase.from('travelers').insert(full)
  if (res.error && isMissingAvatarCol(res.error)) {
    const { avatar_color: _omit, ...rest } = full
    void _omit
    res = await supabase.from('travelers').insert(rest)
  }
  return res
}

export async function updateTraveler(id: string, fields: TravelerInput) {
  let res = await supabase.from('travelers').update(fields).eq('id', id)
  if (res.error && isMissingAvatarCol(res.error)) {
    const { avatar_color: _omit, ...rest } = fields
    void _omit
    res = await supabase.from('travelers').update(rest).eq('id', id)
  }
  return res
}

export async function deleteTraveler(id: string) {
  return supabase.from('travelers').delete().eq('id', id)
}

// ---------- Flights ----------

export type FlightInput = Partial<Omit<Flight, 'id' | 'trip_id' | 'created_at'>>

export async function addFlight(trip_id: string, input: FlightInput) {
  return supabase.from('flights').insert({ id: crypto.randomUUID(), trip_id, ...input })
}
export async function updateFlight(id: string, fields: FlightInput) {
  return supabase.from('flights').update(fields).eq('id', id)
}
export async function deleteFlight(id: string) {
  return supabase.from('flights').delete().eq('id', id)
}

// ---------- Hotels ----------

export interface HotelInput {
  name?: string | null
  city?: string | null
  nights?: number | null
  map_url?: string | null
  booking_id?: string | null
  checkin?: string | null
  checkout?: string | null
  rooms?: HotelRoom[]
}

export async function addHotel(trip_id: string, input: HotelInput) {
  return supabase.from('hotels').insert({ id: crypto.randomUUID(), trip_id, ...input })
}
export async function updateHotel(id: string, fields: HotelInput) {
  return supabase.from('hotels').update(fields).eq('id', id)
}
export async function deleteHotel(id: string) {
  return supabase.from('hotels').delete().eq('id', id)
}
