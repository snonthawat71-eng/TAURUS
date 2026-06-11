import { supabase } from './supabase'
import type { Flight, HotelRoom } from './database.types'

// Columns added by supabase/extra_columns.sql — the app still works before the
// migration is run by stripping any column the API reports as unknown.
const OPTIONAL_COLS = ['avatar_color', 'seat_class', 'seats', 'status', 'photo_path', 'flag']

function stripMentioned(payload: Record<string, unknown>, msg: string) {
  const copy = { ...payload }
  let changed = false
  for (const k of OPTIONAL_COLS) {
    if (k in copy && msg.includes(k)) {
      delete copy[k]
      changed = true
    }
  }
  return changed ? copy : null
}

async function insertGraceful(table: string, payload: Record<string, unknown>) {
  let res = await supabase.from(table).insert(payload)
  if (res.error) {
    const stripped = stripMentioned(payload, res.error.message)
    if (stripped) res = await supabase.from(table).insert(stripped)
  }
  return res
}

async function updateGraceful(table: string, id: string, payload: Record<string, unknown>) {
  let res = await supabase.from(table).update(payload).eq('id', id)
  if (res.error) {
    const stripped = stripMentioned(payload, res.error.message)
    if (stripped) res = await supabase.from(table).update(stripped).eq('id', id)
  }
  return res
}

// ---------- Trips ----------

export interface TripInput {
  name?: string | null
  country?: string | null
  flag?: string | null
  start_date?: string | null
  end_date?: string | null
}

export async function createTrip(owner_id: string, input: TripInput) {
  const id = crypto.randomUUID()
  const res = await insertGraceful('trips', { id, owner_id, name: input.name || 'ทริปใหม่', ...input })
  return { id, error: res.error }
}
export async function updateTrip(id: string, fields: TripInput) {
  return updateGraceful('trips', id, { ...fields })
}
export async function deleteTrip(id: string) {
  return supabase.from('trips').delete().eq('id', id)
}

// ---------- Invites (owner-controlled sharing) ----------

export async function addInvite(trip_id: string, email: string, invited_by: string) {
  return supabase.from('trip_invites').insert({ trip_id, email: email.trim().toLowerCase(), invited_by, status: 'pending' })
}
export async function deleteInvite(id: string) {
  return supabase.from('trip_invites').delete().eq('id', id)
}

// ---------- Travelers ----------

export interface TravelerInput {
  nickname?: string | null
  full_name?: string | null
  avatar_color?: string | null
}
export async function addTraveler(trip_id: string, input: TravelerInput) {
  return insertGraceful('travelers', { id: crypto.randomUUID(), trip_id, ...input })
}
export async function updateTraveler(id: string, fields: TravelerInput) {
  return updateGraceful('travelers', id, { ...fields })
}
export async function deleteTraveler(id: string) {
  return supabase.from('travelers').delete().eq('id', id)
}

// ---------- Flights ----------

export type FlightInput = Partial<Omit<Flight, 'id' | 'trip_id' | 'created_at'>>

export async function addFlight(trip_id: string, input: FlightInput) {
  return insertGraceful('flights', { id: crypto.randomUUID(), trip_id, ...input })
}
export async function updateFlight(id: string, fields: FlightInput) {
  return updateGraceful('flights', id, { ...fields })
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
  photo_path?: string | null
}
export async function addHotel(trip_id: string, input: HotelInput) {
  return insertGraceful('hotels', { id: crypto.randomUUID(), trip_id, ...input })
}
export async function updateHotel(id: string, fields: HotelInput) {
  return updateGraceful('hotels', id, { ...fields })
}
export async function deleteHotel(id: string) {
  return supabase.from('hotels').delete().eq('id', id)
}
