// Hand-written types mirroring planaway_schema.sql.
// Keep these in sync with the SQL if the schema changes.

export type AvatarColor = 'av1' | 'av2' | 'av3' | 'av4'

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
  created_at: string
}

export type TravelerFileKind = 'arrival_card' | 'visa' | 'passport' | 'ticket' | 'other'

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
  created_at: string
}

export interface ItineraryDay {
  id: string
  trip_id: string
  day_date: string | null
  label: string | null
  position: number
  created_at: string
}

/** Structured transit (metro route) stored in itinerary_stops.transit */
export interface TransitLeg {
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
  position: number
  created_at: string
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
  map_url: string | null
  note: string | null
  in_plan: boolean
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
}
