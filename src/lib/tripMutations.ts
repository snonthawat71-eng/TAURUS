import { supabase } from './supabase'
import type { Flight, HotelRoom, Trip } from './database.types'

// Columns added by supabase/extra_columns.sql — the app still works before the
// migration is run by stripping any column the API reports as unknown.
const OPTIONAL_COLS = ['avatar_color', 'seat_class', 'seats', 'status', 'photo_path', 'flag', 'cities', 'currency', 'timezone', 'direction']

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
  cities?: string[] | null
  currency?: string | null
  timezone?: string | null
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

/**
 * Duplicate a trip — copies only the Places & Food/café wishlist into a brand
 * new trip (everything else is re-entered). Returns the new trip id.
 */
export async function duplicateTrip(source: Trip, ownerId: string): Promise<{ id: string; error: string | null }> {
  const id = crypto.randomUUID()
  const created = await insertGraceful('trips', {
    id, owner_id: ownerId, name: `${source.name} (สำเนา)`,
    country: source.country, flag: source.flag, cities: source.cities, currency: source.currency, timezone: source.timezone,
    start_date: null, end_date: null,
  })
  if (created.error) return { id, error: created.error.message }

  const { data: places } = await supabase.from('places').select('*').eq('trip_id', source.id)
  if (places?.length) {
    const rows = places.map((p) => ({
      id: crypto.randomUUID(), trip_id: id, group_type: p.group_type, category: p.category,
      name: p.name, station_line: p.station_line, station_color: p.station_color, station_name: p.station_name,
      routes: p.routes ?? null,
      map_url: p.map_url, note: p.note, in_plan: p.in_plan, photo_path: p.photo_path, photo_focus: p.photo_focus, city: p.city,
    }))
    let res = await supabase.from('places').insert(rows)
    if (res.error && ['photo_path', 'photo_focus', 'city', 'routes'].some((c) => res.error!.message.includes(c))) {
      const stripped = rows.map(({ photo_path: _p, photo_focus: _f, city: _c, routes: _r, ...r }) => { void _p; void _f; void _c; void _r; return r })
      res = await supabase.from('places').insert(stripped)
    }
    if (res.error) return { id, error: res.error.message }
  }
  return { id, error: null }
}

// ---------- Invites (owner-controlled sharing) ----------

export type SharePermission = 'edit' | 'places' | 'view'

export async function addInvite(trip_id: string, email: string, invited_by: string, permission: SharePermission = 'edit') {
  const payload = { trip_id, email: email.trim().toLowerCase(), invited_by, status: 'pending', permission }
  let res = await supabase.from('trip_invites').insert(payload)
  if (res.error && res.error.message.includes('permission')) {
    const { permission: _p, ...rest } = payload; void _p
    res = await supabase.from('trip_invites').insert(rest)
  }
  return res
}
export async function deleteInvite(id: string) {
  return supabase.from('trip_invites').delete().eq('id', id)
}

export async function updateMemberPermission(trip_id: string, user_id: string, permission: SharePermission) {
  return supabase.from('trip_members').update({ permission }).eq('trip_id', trip_id).eq('user_id', user_id)
}

/**
 * Fully revoke a person's access to a trip — removes BOTH their membership
 * (trip_members) and any invite (trip_invites), so a still-pending invite can't
 * re-grant access via accept_my_invites(). Pass a user_id (a joined member) or
 * an email (a pending/accepted invite); the SQL function reconciles the other.
 *
 * Falls back to a best-effort client-side delete when revoke_access.sql hasn't
 * been applied yet (graceful-degradation, like the rest of the app).
 */
export async function revokeAccess(trip_id: string, opts: { user_id?: string; email?: string }) {
  const { error } = await supabase.rpc('revoke_trip_access', {
    p_trip: trip_id,
    p_user: opts.user_id ?? null,
    p_email: opts.email?.trim().toLowerCase() ?? null,
  })
  if (error && /function|does not exist|schema cache|could not find/i.test(error.message)) {
    // Pre-migration fallback: remove what we can directly (won't cross-reconcile
    // member↔invite by email, but still revokes the explicit row).
    if (opts.user_id) await supabase.from('trip_members').delete().eq('trip_id', trip_id).eq('user_id', opts.user_id)
    if (opts.email) await supabase.from('trip_invites').delete().eq('trip_id', trip_id).eq('email', opts.email.trim().toLowerCase())
    return { error: null }
  }
  return { error }
}

// ---------- Profile (the logged-in user) ----------

export async function updateProfile(id: string, fields: { nickname?: string | null; full_name?: string | null; avatar_color?: string | null }) {
  return supabase.from('profiles').update(fields).eq('id', id)
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
