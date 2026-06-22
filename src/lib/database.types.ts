// Hand-written types mirroring planaway_schema.sql.
// Keep these in sync with the SQL if the schema changes.

export type AvatarColor = 'av1' | 'av2' | 'av3' | 'av4' | 'av5' | 'av6' | 'av7' | 'av8' | 'av9' | 'av10'

export interface Profile {
  id: string
  nickname: string | null
  full_name: string | null
  avatar_color: AvatarColor | string | null
  created_at: string
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
}

export interface Traveler {
  id: string
  trip_id: string
  nickname: string | null
  full_name: string | null
  passport_last4: string | null
  /** optional — only present after the avatar_color migration is run */
  avatar_color?: string | null
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
  /** walking transfer shown AFTER this leg, before the next */
  transferAfter?: { walkMeters?: number; minutes?: number }
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
  /** optional — present after menu.sql (menu images/PDFs for restaurants) */
  menu_paths?: string[] | null
  /** optional — present after photos.sql; extra photos (2nd–4th) shown only in
   *  the detail view. The 1st photo stays in photo_url/photo_path. */
  photos?: string[] | null
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
  /** optional — menu images/PDFs for restaurants (public URLs) */
  menu_paths?: string[] | null
  map_url: string | null
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
  body: string
  /** optional — present after explore.sql adds replies (a comment replying to another) */
  parent_id?: string | null
  created_at: string
}

/** Recommend (1) / not-recommend (-1) vote on an Explore item (explore_votes table) */
export interface ExploreVote {
  explore_id: string
  user_id: string
  vote: number
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
  created_at: string
  /** optional — present after the concurrency.sql migration (optimistic lock) */
  version?: number
}
