import { supabase } from './supabase'
import { toastDbError } from './toast'
import type { Flight, Train, HotelRoom, Trip } from './database.types'

// Columns added by supabase/extra_columns.sql — the app still works before the
// migration is run by stripping any column the API reports as unknown.
const OPTIONAL_COLS = ['avatar_color', 'avatar_url', 'avatar_focus', 'year_goal', 'onboarded', 'seat_class', 'seats', 'status', 'photo_path', 'flag', 'cities', 'currency', 'timezone', 'direction', 'dep_tz', 'arr_tz', 'gate', 'car', 'seat_no', 'label', 'from_station', 'to_station', 'is_main', 'used', 'kind', 'note', 'iccid', 'link', 'privacy', 'user_id', 'segments']

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
  toastDbError(res.error) // many callers are optimistic fire-and-forget — never fail silently
  return res
}

async function updateGraceful(table: string, id: string, payload: Record<string, unknown>) {
  let res = await supabase.from(table).update(payload).eq('id', id)
  if (res.error) {
    const stripped = stripMentioned(payload, res.error.message)
    if (stripped) res = await supabase.from(table).update(stripped).eq('id', id)
  }
  toastDbError(res.error, !navigator.onLine ? 'บันทึกไม่สำเร็จ — ออฟไลน์อยู่ การแก้ไขนี้ยังไม่ถูกบันทึก' : undefined)
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
  segments?: unknown
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
    // copy the full wishlist including optional columns (photos, branches, menu…)
    // — same set copyPlaceToTrip preserves; a copy shouldn't silently lose data
    const OPTIONAL = ['photo_path', 'photo_url', 'photo_focus', 'photos', 'city', 'routes', 'branches', 'multi_branch', 'menu_paths'] as const
    const rows = places.map((p) => ({
      id: crypto.randomUUID(), trip_id: id, group_type: p.group_type, category: p.category,
      name: p.name, station_line: p.station_line, station_color: p.station_color, station_name: p.station_name,
      map_url: p.map_url, note: p.note, in_plan: false, // a copy has no itinerary yet, so nothing is in its plan
      ...Object.fromEntries(OPTIONAL.map((c) => [c, p[c] ?? null])),
    }))
    let res = await supabase.from('places').insert(rows)
    if (res.error && OPTIONAL.some((c) => res.error!.message.includes(c))) {
      // pre-migration DB → retry without the optional columns
      const stripped = rows.map((r) => { const copy = { ...r } as Record<string, unknown>; for (const c of OPTIONAL) delete copy[c]; return copy })
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

export async function updateProfile(id: string, fields: { nickname?: string | null; full_name?: string | null; avatar_color?: string | null; avatar_url?: string | null; avatar_focus?: string | null; year_goal?: Record<string, number> | null }) {
  let res = await supabase.from('profiles').update(fields).eq('id', id)
  // avatar_url is optional (supabase/avatars.sql) — retry without it if unknown
  if (res.error) {
    const stripped = stripMentioned({ ...fields }, res.error.message)
    if (stripped) res = await supabase.from('profiles').update(stripped).eq('id', id)
  }
  return res
}

/** First-run profile save for a brand-new signup: writes the identity AND flips
 *  `onboarded` so the setup screen never shows again. Upsert because the row may
 *  not exist yet. Degrades if `onboarded`/`avatar_url` aren't migrated. */
export async function completeOnboarding(id: string, fields: { nickname: string; avatar_color: string; avatar_url?: string | null; avatar_focus?: string | null }) {
  const payload: Record<string, unknown> = { id, ...fields, onboarded: true }
  let res = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
  if (res.error) {
    const stripped = stripMentioned({ ...payload }, res.error.message)
    if (stripped) { stripped.id = id; res = await supabase.from('profiles').upsert(stripped, { onConflict: 'id' }) }
  }
  return res
}

// ---------- Travelers ----------

export interface TravelerInput {
  nickname?: string | null
  full_name?: string | null
  avatar_color?: string | null
  avatar_url?: string | null
  avatar_focus?: string | null
  user_id?: string | null
  privacy?: string | null
}
/** "การ์ดนี้คือฉัน" — bind an unclaimed traveler card to the signed-in account. */
export async function claimTraveler(id: string, userId: string) {
  return updateGraceful('travelers', id, { user_id: userId })
}

/**
 * Copy an existing account's identity onto the traveler card it just claimed —
 * joining a trip by invite, or tapping "นี่การ์ดฉัน".
 *
 * Editing your profile already syncs every card you've claimed, but someone who
 * signed up long ago and was then invited never passes through that screen, so
 * their card kept the placeholder the trip owner typed. Only fields the profile
 * actually carries are pushed, and the name only once the profile has been set
 * up for real — a brand-new signup's auto-nickname ("somchai91" off the email)
 * must not replace the "พี่เอ" the owner wrote on the card.
 */
export async function syncProfileToTraveler(
  travelerId: string,
  profile: { nickname?: string | null; full_name?: string | null; avatar_color?: string | null; avatar_url?: string | null; avatar_focus?: string | null; onboarded?: boolean | null } | null,
  override: { avatar_url?: string | null; avatar_focus?: string | null } = {},
) {
  if (!profile) return
  const fields: TravelerInput = {}
  if (profile.onboarded !== false && profile.nickname?.trim()) fields.nickname = profile.nickname.trim()
  if (profile.full_name?.trim()) fields.full_name = profile.full_name.trim()
  if (profile.avatar_color) fields.avatar_color = profile.avatar_color
  const photo = override.avatar_url ?? profile.avatar_url
  if (photo) {
    fields.avatar_url = photo
    fields.avatar_focus = override.avatar_url ? override.avatar_focus ?? null : profile.avatar_focus ?? null
  }
  if (!Object.keys(fields).length) return
  return updateGraceful('travelers', travelerId, { ...fields })
}
export async function setTravelerPrivacy(id: string, privacy: 'trip' | 'private') {
  return updateGraceful('travelers', id, { privacy })
}
export async function addTraveler(trip_id: string, input: TravelerInput, id: string = crypto.randomUUID()) {
  await insertGraceful('travelers', { id, trip_id, ...input })
  return id
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

// ---------- Trains (mirrors flights; requires supabase/trains.sql) ----------

export type TrainInput = Partial<Omit<Train, 'id' | 'trip_id' | 'created_at'>>

export async function addTrain(trip_id: string, input: TrainInput) {
  return insertGraceful('trains', { id: crypto.randomUUID(), trip_id, ...input })
}
export async function updateTrain(id: string, fields: TrainInput) {
  return updateGraceful('trains', id, { ...fields })
}
export async function deleteTrain(id: string) {
  return supabase.from('trains').delete().eq('id', id)
}

// ---------- Train tickets (per-passenger QR + seat) ----------

export interface TrainTicketInput {
  train_id?: string | null
  traveler_id?: string | null
  passenger_name?: string | null
  kind?: string | null
  note?: string | null
  label?: string | null
  from_station?: string | null
  to_station?: string | null
  seat_no?: string | null
  car?: string | null
  gate?: string | null
  iccid?: string | null
  link?: string | null
  qr_path?: string | null
  is_main?: boolean | null
  used?: boolean | null
  position?: number | null
}
export async function addTrainTicket(trip_id: string, input: TrainTicketInput, id: string = crypto.randomUUID()) {
  await insertGraceful('train_tickets', { id, trip_id, ...input })
  return id
}
export async function updateTrainTicket(id: string, input: TrainTicketInput) {
  return updateGraceful('train_tickets', id, { ...input })
}
export async function deleteTrainTicket(id: string) {
  return supabase.from('train_tickets').delete().eq('id', id)
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
