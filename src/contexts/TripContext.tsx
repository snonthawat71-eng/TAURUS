import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { seedSampleTrip } from '@/lib/seed'
import { useAuth } from './AuthContext'
import type {
  Expense, Flight, Hotel, ItineraryDay, ItineraryStop, Place, PlaceInterest,
  Profile, Traveler, Trip,
} from '@/lib/database.types'

interface TripData {
  loading: boolean
  error: string | null
  trip: Trip | null
  profile: Profile | null
  travelers: Traveler[]
  flights: Flight[]
  hotels: Hotel[]
  days: ItineraryDay[]
  stops: ItineraryStop[]
  places: Place[]
  interests: PlaceInterest[]
  expenses: Expense[]
  memberProfiles: Profile[]
  reload: () => Promise<void>
}

const TripContext = createContext<TripData | undefined>(undefined)

const empty = {
  trip: null, profile: null, travelers: [], flights: [], hotels: [], days: [],
  stops: [], places: [], interests: [], expenses: [], memberProfiles: [],
}

export function TripProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<Omit<TripData, 'loading' | 'error' | 'reload'>>(empty)

  const load = useCallback(async () => {
    if (!user) return
    setError(null)
    try {
      // Ensure a profile row exists for this user
      await supabase
        .from('profiles')
        .upsert(
          { id: user.id, nickname: user.email?.split('@')[0] ?? 'me', avatar_color: 'av3' },
          { onConflict: 'id', ignoreDuplicates: true },
        )

      // Find a trip the user belongs to; seed the sample one if none yet
      let { data: trips } = await supabase
        .from('trips')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)

      if (!trips || trips.length === 0) {
        await seedSampleTrip(user.id)
        const res = await supabase
          .from('trips').select('*').order('created_at', { ascending: true }).limit(1)
        trips = res.data
      }

      const trip = trips?.[0] ?? null
      if (!trip) {
        setData(empty)
        return
      }
      const trip_id = trip.id

      const [
        profileRes, travelersRes, flightsRes, hotelsRes, daysRes, stopsRes,
        placesRes, expensesRes, membersRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('travelers').select('*').eq('trip_id', trip_id).order('created_at'),
        supabase.from('flights').select('*').eq('trip_id', trip_id).order('flight_date'),
        supabase.from('hotels').select('*').eq('trip_id', trip_id).order('checkin'),
        supabase.from('itinerary_days').select('*').eq('trip_id', trip_id).order('position'),
        supabase.from('itinerary_stops').select('*').eq('trip_id', trip_id).order('position'),
        supabase.from('places').select('*').eq('trip_id', trip_id).order('created_at'),
        supabase.from('expenses').select('*').eq('trip_id', trip_id).order('created_at'),
        supabase.from('trip_members').select('user_id').eq('trip_id', trip_id),
      ])

      const places = (placesRes.data ?? []) as Place[]
      const placeIds = places.map((p) => p.id)
      const interestsRes = placeIds.length
        ? await supabase.from('place_interest').select('*').in('place_id', placeIds)
        : { data: [] as PlaceInterest[] }

      const memberIds = (membersRes.data ?? []).map((m) => m.user_id)
      const memberProfilesRes = memberIds.length
        ? await supabase.from('profiles').select('*').in('id', memberIds)
        : { data: [] as Profile[] }

      setData({
        trip,
        profile: (profileRes.data as Profile) ?? null,
        travelers: travelersRes.data ?? [],
        flights: flightsRes.data ?? [],
        hotels: (hotelsRes.data ?? []) as Hotel[],
        days: daysRes.data ?? [],
        stops: (stopsRes.data ?? []) as ItineraryStop[],
        places,
        interests: (interestsRes.data ?? []) as PlaceInterest[],
        expenses: (expensesRes.data ?? []) as Expense[],
        memberProfiles: (memberProfilesRes.data ?? []) as Profile[],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ')
    }
  }, [user])

  useEffect(() => {
    let active = true
    setLoading(true)
    load().finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [load])

  return (
    <TripContext.Provider value={{ loading, error, ...data, reload: load }}>
      {children}
    </TripContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTrip() {
  const ctx = useContext(TripContext)
  if (!ctx) throw new Error('useTrip must be used within TripProvider')
  return ctx
}
