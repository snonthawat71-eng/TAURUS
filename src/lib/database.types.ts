// Hand-written types mirroring planaway_schema.sql.
// Keep these in sync with the SQL if the schema changes.

export type AvatarColor = 'av1' | 'av2' | 'av3' | 'av4' | 'av5' | 'av6' | 'av7' | 'av8' | 'av9' | 'av10'

export interface Profile {
  id: string
  nickname: string | null
  full_name: string | null
  avatar_color: AvatarColor | string | null
  /** optional — present after supabase/avatars.sql; a public profile photo URL */
  avatar_url?: string | null
  /** optional — avatar crop "x y scale" (see src/lib/photoFocus.ts) */
  avatar_focus?: string | null
  /** optional — present after supabase/profile_page.sql; yearly trip goal per
   *  year, e.g. { "2026": 8 } — the target slot count for the travel bar */
  year_goal?: Record<string, number> | null
  /** optional — present after supabase/onboarding.sql; false until a brand-new
   *  signup finishes the first-run profile-setup screen */
  onboarded?: boolean | null
  created_at: string
}

/** One city leg of a multi-city trip. `until` = local datetime the trip moves
 *  on to the next segment ('YYYY-MM-DDTHH:mm'); null on the last segment. */
export interface TripSegment {
  city: string
  flag?: string | null
  currency?: string | null
  tz?: string | null
  until?: string | null
}

export interface Trip {
  id: string
  name: string
  country: string | null
  /** optional — present after the extra_columns migration */
  flag?: string | null
  cities?: string[] | null
  currency?: string | null
  /** optional — present after notifications.sql; IANA tz for stop-time reminders */
  timezone?: string | null
  /** optional — city segments from the create wizard (supabase/invites.sql) */
  segments?: TripSegment[] | null
  start_date: string | null
  end_date: string | null
  owner_id: string
  created_at: string
}

export interface TripMember {
  trip_id: string
  user_id: string
  role: string
  joined_at: string
  /** 'edit' | 'places' | 'view' — added by sharing.sql (optional pre-migration) */
  permission?: string | null
}

export interface Traveler {
  id: string
  trip_id: string
  nickname: string | null
  full_name: string | null
  passport_last4: string | null
  /** optional — only present after the avatar_color migration is run */
  avatar_color?: string | null
  /** optional — present after supabase/avatars.sql; a public profile photo URL */
  avatar_url?: string | null
  /** optional — avatar crop "x y scale" (see src/lib/photoFocus.ts) */
  avatar_focus?: string | null
  /** optional — present after supabase/privacy.sql: the account this card belongs to */
  user_id?: string | null
  /** optional — 'trip' (everyone) | 'private' (card owner + trip owner); default private */
  privacy?: string | null
  /** optional — per-card invite link secret (supabase/invites.sql) */
  invite_token?: string | null
  created_at: string
}

export type TravelerFileKind = 'arrival_card' | 'visa' | 'passport' | 'ticket' | 'boarding_pass' | 'other'

export interface TravelerFile {
  id: string
  traveler_id: string
  trip_id: string
  kind: TravelerFileKind | string | null
  label: string | null
  storage_path: string
  created_at: string
}

export type FlightDirection = 'outbound' | 'return'

export interface Flight {
  id: string
  trip_id: string
  direction: FlightDirection | string | null
  airline: string | null
  flight_no: string | null
  dep_code: string | null
  dep_name: string | null
  dep_time: string | null
  arr_code: string | null
  arr_name: string | null
  arr_time: string | null
  flight_date: string | null
  booking_ref: string | null
  storage_path: string | null
  /** optional — present after the extra_columns migration */
  seat_class?: string | null
  seats?: number | null
  status?: string | null
  /** IANA timezone of the departure / arrival airport — for a correct flight
   *  duration across timezones (optional; added by extra_columns.sql) */
  dep_tz?: string | null
  arr_tz?: string | null
  /** live travel-day status — written by the check-flight-status Edge Function
   *  (optional; added by flight_status.sql). The app only reads these. */
  live_status?: string | null      // ontime | delayed | cancelled | diverted | departed | arrived
  live_delay_min?: number | null
  live_dep_time?: string | null    // revised departure "HH:MM"
  live_arr_time?: string | null
  live_gate?: string | null
  live_terminal?: string | null
  live_checked_at?: string | null
  created_at: string
}

/** Train trips — mirrors Flight (ขาไป/ขากลับ). Requires supabase/trains.sql. */
// Per-passenger train ticket (QR + seat), present after supabase/train_tickets.sql
export interface TrainTicket {
  id: string
  trip_id: string
  train_id: string | null
  traveler_id: string | null
  passenger_name: string | null
  kind: string | null
  note: string | null
  label: string | null
  from_station: string | null
  to_station: string | null
  seat_no: string | null
  car: string | null
  gate: string | null
  iccid?: string | null // eSIM — optional column (train_tickets.sql)
  link?: string | null // eSIM registration URL — optional column (train_tickets.sql)
  qr_path: string | null
  is_main: boolean | null
  used: boolean | null
  position: number
  created_at: string
}

export interface Train {
  id: string
  trip_id: string
  direction: FlightDirection | string | null
  operator: string | null
  train_no: string | null
  dep_code: string | null
  dep_name: string | null
  dep_time: string | null
  arr_code: string | null
  arr_name: string | null
  arr_time: string | null
  travel_date: string | null
  booking_ref: string | null
  storage_path: string | null
  seat_class?: string | null
  seats?: number | null
  /** ประตู / ตู้ที่ / ที่นั่ง — optional, added by the trains migration */
  gate?: string | null
  car?: string | null
  seat_no?: string | null
  dep_tz?: string | null
  arr_tz?: string | null
  created_at: string
}

export interface HotelRoom {
  name: string
  members: string[]
}

export interface Hotel {
  id: string
  trip_id: string
  name: string | null
  city: string | null
  nights: number | null
  map_url: string | null
  booking_id: string | null
  checkin: string | null
  checkout: string | null
  rooms: HotelRoom[]
  storage_path: string | null
  /** optional — present after the extra_columns migration */
  photo_path?: string | null
  created_at: string
}

export interface ItineraryDay {
  id: string
  trip_id: string
  day_date: string | null
  label: string | null
  position: number
  created_at: string
  /** optional — present after the concurrency.sql migration (optimistic lock) */
  version?: number
}

/** Structured transit (metro route) stored in itinerary_stops.transit */
export interface TransitLeg {
  /** how this leg is travelled — 'metro' (default) | 'bus' | 'tram' | 'hsr' | 'car' | 'taxi' | 'boat' | 'plane' */
  mode?: string
  line: string
  color: string
  from: string
  to: string
  direction?: string
  stops?: number
  minutes?: number
  /** which exit to take when getting off this leg */
  exit?: { label: string; note?: string }
  /** walking transfer shown AFTER this leg, before the next */
  transferAfter?: { walkMeters?: number; minutes?: number }
  /** estimated cost of this leg, in the trip's currency */
  fare?: number
}

export interface Transit {
  legs: TransitLeg[]
  exit?: { label: string; note?: string }
}

export interface ItineraryStop {
  id: string
  day_id: string
  trip_id: string
  time: string | null
  place_name: string | null
  map_url: string | null
  note: string | null
  transit: Transit | null
  /** optional — present after the extra_columns migration ('map' | 'detail') */
  link_mode?: string | null
  /** optional — present after extra_columns; user chose not to set a transit route */
  skip_transit?: boolean | null
  /** optional — present after stop_role.sql; null/'main' = แผนหลัก, 'backup' = แผนสำรอง */
  role?: string | null
  /** optional — present after stop_branch.sql; WHICH branch of a multi-branch
   *  place this particular visit goes to (index into the place's `branches`).
   *  null = the place's main location, or "not recorded" for stops created
   *  before the migration (those fall back to places.plan_branch). */
  branch_idx?: number | null
  /** optional — present after itinerary_done.sql; the group checked this stop off */
  done?: boolean | null
  done_at?: string | null
  position: number
  created_at: string
  /** optional — present after the concurrency.sql migration (optimistic lock) */
  version?: number
}

export type PlaceGroup = 'place' | 'food'

export interface Place {
  id: string
  trip_id: string
  group_type: PlaceGroup | string | null
  category: string | null
  name: string | null
  station_line: string | null
  station_color: string | null
  station_name: string | null
  /** optional — present after place_routes.sql (multiple ways to get there) */
  routes?: ExploreRoute[] | null
  /** optional — present after branches.sql (chains with multiple locations) */
  branches?: PlaceBranch[] | null
  /** optional — present after branches.sql; just flags "has many branches" for a
   *  card label, without requiring per-branch detail */
  multi_branch?: boolean | null
  /** optional — present after branches.sql; the name of THIS location when the
   *  place is one of several branches, so the picker can show "สาขาสยาม"
   *  instead of the generic "ที่ตั้งหลัก" */
  branch_label?: string | null
  /** optional — present after plan_branch.sql; which branch was picked when the
   *  place was added to the plan (index into `branches`, null = main location) */
  plan_branch?: number | null
  map_url: string | null
  note: string | null
  in_plan: boolean
  /** optional — present after the extra_columns migration */
  photo_path?: string | null
  photo_url?: string | null
  /** optional — present after photo_focus.sql; how the photo is cropped inside
   *  its frame, stored as "x y scale" (see src/lib/photoFocus.ts) */
  photo_focus?: string | null
  city?: string | null
  /** client-only hint (not a `places` column): the source Explore item's
   *  country, carried so the save dialog can match a place to trips by place. */
  country?: string | null
  /** optional — present after supabase/place_geo.sql; map pin location. Filled
   *  from map_url / geocoding / manual pick (see src/lib/geo.ts) */
  lat?: number | null
  lng?: number | null
  /** optional — present after pinned.sql; coordinate is user-locked (hand-fixed
   *  or an Explore shared pin) → the map trusts lat/lng and won't re-geocode it,
   *  while map_url stays the real navigation link */
  pinned?: boolean | null
  /** optional — present after menu.sql (menu images/PDFs for restaurants) */
  menu_paths?: string[] | null
  /** optional — present after photos.sql; extra photos (2nd–4th) shown only in
   *  the detail view. The 1st photo stays in photo_url/photo_path. */
  photos?: string[] | null
  /** optional — present after extra_columns.sql; the Explore item this place was
   *  copied from (links a saved place back to its community source) */
  source_explore_id?: string | null
  created_at: string
  /** optional — present after the concurrency.sql migration (optimistic lock) */
  version?: number
}

/** One way to reach a place (line + station). Stored in explore_places.routes */
export interface ExploreRoute {
  line: string | null
  color: string | null
  station: string | null
  /** how to travel this route — 'metro' (default) | 'bus' | … (see transitModes) */
  mode?: string
}

/** One branch of a chain (e.g. a café with many locations). Each carries its own
 *  map link and transit station so the detail view can switch between them. */
export interface PlaceBranch {
  label: string | null
  map_url: string | null
  line: string | null
  color: string | null
  station: string | null
}

/** Community pool item (explore_places table) */
export interface ExplorePlace {
  id: string
  group_type: PlaceGroup | string | null
  category: string | null
  name: string | null
  city: string | null
  country: string | null
  station_line: string | null
  station_color: string | null
  station_name: string | null
  /** optional — present after the routes column is added (multiple ways to get there) */
  routes?: ExploreRoute[] | null
  /** optional — present after branches column is added (chains with multiple locations) */
  branches?: PlaceBranch[] | null
  /** optional — flags "has many branches" for a card label (no per-branch detail) */
  multi_branch?: boolean | null
  /** optional — the name of THIS location when the item is one of several
   *  branches (see branches.sql); falls back to "ที่ตั้งหลัก" when empty */
  branch_label?: string | null
  /** optional — menu images/PDFs for restaurants (public URLs) */
  menu_paths?: string[] | null
  map_url: string | null
  /** optional — present after explore_coords.sql; the item's SINGLE resolved
   *  coordinate, so every trip that saves it inherits the same pin (no drift) */
  lat?: number | null
  lng?: number | null
  note: string | null
  photo_url: string | null
  /** optional — present after photo_focus column is added; crop "x y scale" */
  photo_focus?: string | null
  /** optional — present after photos.sql; extra photos (2nd–4th, public URLs)
   *  shown only in the detail view. The 1st photo stays in photo_url. */
  photos?: string[] | null
  created_by: string | null
  created_at: string
}

/** Comment on an Explore pool item (explore_comments table) */
export interface ExploreComment {
  id: string
  explore_id: string
  user_id: string | null
  author_name: string | null
  author_color: string | null
  /** optional — present after supabase/avatars.sql; author's photo + crop */
  author_photo?: string | null
  author_focus?: string | null
  body: string
  /** optional — present after explore.sql adds replies (a comment replying to another) */
  parent_id?: string | null
  created_at: string
}

/** A community suggestion/report on someone else's Explore item
 *  (explore_suggestions table — supabase/explore_suggestions.sql). Owner reviews
 *  then accepts (merged into the item) or dismisses. */
export type SuggestionKind = 'route' | 'branch' | 'edit' | 'report'
export type SuggestionStatus = 'pending' | 'accepted' | 'dismissed'
export interface ExploreSuggestion {
  id: string
  explore_id: string
  user_id: string | null
  author_name: string | null
  author_color: string | null
  /** optional — present after supabase/avatars.sql; author's photo + crop */
  author_photo?: string | null
  author_focus?: string | null
  kind: SuggestionKind
  /** structured data per kind (route/branch fields, edited fields, report reason) */
  payload: Record<string, unknown> | null
  note: string | null
  status: SuggestionStatus
  created_at: string
  resolved_at?: string | null
}

/** Recommend (1) / not-recommend (-1) vote on an Explore item (explore_votes table) */
export interface ExploreVote {
  explore_id: string
  user_id: string
  vote: number
  created_at: string
}

/** A REAL 1–5 star rating on an Explore item (explore_ratings table —
 *  supabase/explore_reviews.sql). One row per user per place; the four
 *  sub-scores are optional and null until the rater fills them in. */
export interface ExploreRating {
  explore_id: string
  user_id: string
  stars: number
  /** รสชาติ / ความน่าสนใจ */
  taste?: number | null
  /** คุ้มราคา */
  worth?: number | null
  /** บรรยากาศ */
  vibe?: number | null
  /** คิว — 5 = ไม่ต้องรอเลย */
  queue?: number | null
  /** optional — the written review */
  body?: string | null
  /** optional — photos attached to the review (public URLs) */
  photos?: string[] | null
  author_name?: string | null
  author_color?: string | null
  author_photo?: string | null
  author_focus?: string | null
  created_at: string
  updated_at?: string | null
}

/** One person's one-tap tag on an Explore item (explore_tags table).
 *  `tag` is a stable key from TAGS in src/lib/exploreReviews.ts. */
export interface ExploreTagVote {
  explore_id: string
  user_id: string
  tag: string
  created_at: string
}

/** A dish someone added to an Explore restaurant (explore_menu_items table) */
export interface ExploreMenuItem {
  id: string
  explore_id: string
  name: string
  created_by: string | null
  created_at: string
}

export interface PlaceInterest {
  place_id: string
  user_id: string
}

export interface Expense {
  id: string
  trip_id: string
  name: string | null
  payer_id: string | null
  total: number | null
  split_user_ids: string[] | null
  receipt_path: string | null
  /** optional — present after expense_extras.sql; spending category id (see expenseMeta) */
  category?: string | null
  /** optional — present after expense_extras.sql; currency code of `total` (null/THB = บาท) */
  currency?: string | null
  /** optional — present after expense_extras.sql; date spent (YYYY-MM-DD) */
  spent_on?: string | null
  created_at: string
  /** optional — present after the concurrency.sql migration (optimistic lock) */
  version?: number
}

/** Trip note / to-do (trip_notes table — supabase/notes.sql). Pulled out from
 *  the right screen edge via the liquid-swipe NotePanel. Private to its owner
 *  by default; `shared` makes it visible to everyone on the trip. */
export type NoteKind = 'note' | 'todo'
export type NoteStatus = 'draft' | 'urgent' | 'done'
export interface TodoItem { id: string; text: string; done: boolean }
export interface TripNote {
  id: string
  trip_id: string
  /** filled by the DB default (auth.uid()) */
  user_id?: string | null
  author_name?: string | null
  author_color?: string | null
  kind: NoteKind
  title?: string | null
  /** note body (kind = 'note') */
  body?: string | null
  /** checklist (kind = 'todo') */
  items?: TodoItem[] | null
  status: NoteStatus
  /** false = private to the owner, true = visible to all trip members */
  shared?: boolean
  /** optional due date+time (absolute ISO timestamp) */
  due_at?: string | null
  /** fire a personal reminder at due_at */
  remind?: boolean
  created_at: string
  updated_at?: string | null
}
