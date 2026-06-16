import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { useAuth } from './AuthContext'
import type {
  Expense, Flight, Hotel, ItineraryDay, ItineraryStop, Place, PlaceInterest,
  Profile, Traveler, TravelerFile, Trip,
} from '@/lib/database.types'

interface TripData {
  loading: boolean
  error: string | null
  trips: Trip[]
  trip: Trip | null
  currentTripId: string | null
  switchTrip: (id: string) => void
  profile: Profile | null
  travelers: Traveler[]
  travelerFiles: TravelerFile[]
  flights: Flight[]
  hotels: Hotel[]
  days: ItineraryDay[]
  stops: ItineraryStop[]
  places: Place[]
  interests: PlaceInterest[]
  expenses: Expense[]
  memberProfiles: Profile[]
  myPermission: 'owner' | 'edit' | 'places' | 'view'
  canEdit: boolean
  reload: () => Promise<void>
}

const TripContext = createContext<TripData | undefined>(undefined)

const empty = {
  trip: null, profile: null, travelers: [], travelerFiles: [], flights: [], hotels: [], days: [],
  stops: [], places: [], interests: [], expenses: [], memberProfiles: [], myPermission: 'owner' as const,
}

const STORAGE_KEY = 'trip:currentId'

export function TripProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trips, setTrips] = useState<Trip[]>([])
  const [currentTripId, setCurrentTripId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  )
  const [data, setData] = useState<Omit<TripData, 'loading' | 'error' | 'reload' | 'trips' | 'currentTripId' | 'switchTrip' | 'canEdit'>>(empty)

  const switchTrip = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id)
    setCurrentTripId(id)
  }, [])

  const load = useCallback(async () => {
    if (!user) return
    setError(null)
    try {
      // Ensure a profile row exists for this user
      const profUpsert = await supabase
        .from('profiles')
        .upsert(
          { id: user.id, nickname: user.email?.split('@')[0] ?? 'me', avatar_color: 'av3' },
          { onConflict: 'id', ignoreDuplicates: true },
        )
      if (profUpsert.error) throw new Error(`[โปรไฟล์] ${profUpsert.error.message}`)

      // Accept any pending invites addressed to this user's email (owner-controlled
      // sharing). No-op if the accept_my_invites() function hasn't been added yet.
      await supabase.rpc('accept_my_invites') // no-op if the function isn't added yet

      // Fetch all trips the user belongs to (new users start with none)
      const tripsRes = await supabase.from('trips').select('*').order('created_at', { ascending: true })
      if (tripsRes.error) throw new Error(`[อ่านทริป] ${tripsRes.error.message}`)
      const allTrips = tripsRes.data ?? []
      setTrips(allTrips)

      // Pick the current trip (saved, else first). No trip yet → empty state.
      const current = allTrips.find((t) => t.id === currentTripId) ?? allTrips[0]
      if (!current) { setData(empty); return }
      if (current.id !== currentTripId) {
        localStorage.setItem(STORAGE_KEY, current.id)
        setCurrentTripId(current.id)
      }
      const trip_id = current.id

      const [
        profileRes, travelersRes, travelerFilesRes, flightsRes, hotelsRes, daysRes, stopsRes,
        placesRes, expensesRes, membersRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('travelers').select('*').eq('trip_id', trip_id).order('created_at'),
        supabase.from('traveler_files').select('*').eq('trip_id', trip_id).order('created_at'),
        supabase.from('flights').select('*').eq('trip_id', trip_id).order('flight_date'),
        supabase.from('hotels').select('*').eq('trip_id', trip_id).order('checkin'),
        supabase.from('itinerary_days').select('*').eq('trip_id', trip_id).order('position'),
        supabase.from('itinerary_stops').select('*').eq('trip_id', trip_id).order('position'),
        supabase.from('places').select('*').eq('trip_id', trip_id).order('created_at'),
        supabase.from('expenses').select('*').eq('trip_id', trip_id).order('created_at'),
        supabase.from('trip_members').select('user_id,permission').eq('trip_id', trip_id),
      ])

      const places = (placesRes.data ?? []) as Place[]
      const placeIds = places.map((p) => p.id)
      const interestsRes = placeIds.length
        ? await supabase.from('place_interest').select('*').in('place_id', placeIds)
        : { data: [] as PlaceInterest[] }

      const members = (membersRes.data ?? []) as { user_id: string; permission?: string | null }[]
      const memberIds = members.map((m) => m.user_id)
      const memberProfilesRes = memberIds.length
        ? await supabase.from('profiles').select('*').in('id', memberIds)
        : { data: [] as Profile[] }

      const myPermission: 'owner' | 'edit' | 'places' | 'view' =
        current.owner_id === user.id
          ? 'owner'
          : (() => {
              const p = members.find((m) => m.user_id === user.id)?.permission
              return (p === 'places' || p === 'view') ? p : 'edit'
            })()

      setData({
        trip: current,
        myPermission,
        profile: (profileRes.data as Profile) ?? null,
        travelers: travelersRes.data ?? [],
        travelerFiles: (travelerFilesRes.data ?? []) as TravelerFile[],
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
      console.error('TripContext load failed:', e)
      const msg = e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ'
      setError(msg)
      toast.error(`โหลดข้อมูลไม่สำเร็จ: ${msg}`)
    }
  }, [user?.id, currentTripId])

  useEffect(() => {
    let active = true
    setLoading(true)
    load().finally(() => active && setLoading(false))
    return () => { active = false }
  }, [load])

  // Realtime: refresh when a teammate edits the current trip (tables enabled in
  // the schema's supabase_realtime publication). Debounced to collapse bursts.
  useEffect(() => {
    if (!currentTripId || !isSupabaseConfigured) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const bump = () => { clearTimeout(timer); timer = setTimeout(() => { load() }, 500) }
    const channel = supabase.channel(`trip-${currentTripId}`)
    for (const table of ['itinerary_days', 'itinerary_stops', 'places', 'expenses', 'travelers']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `trip_id=eq.${currentTripId}` }, bump)
    }
    channel.subscribe()
    return () => { clearTimeout(timer); supabase.removeChannel(channel) }
  }, [currentTripId, load])

  return (
    <TripContext.Provider value={{ loading, error, trips, currentTripId, switchTrip, reload: load, ...data, canEdit: data.myPermission === 'owner' || data.myPermission === 'edit' }}>
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
