import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { initOfflineSync, looksOffline } from '@/lib/offlineQueue'
import { checkPlanReminders } from '@/lib/planReminders'
import { useAuth } from './AuthContext'
import type {
  Expense, Flight, Train, TrainTicket, Hotel, ItineraryDay, ItineraryStop, Place, PlaceInterest,
  Profile, Traveler, TravelerFile, Trip, TripMember,
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
  trains: Train[]
  trainTickets: TrainTicket[]
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
  /** Optimistically patch local state for instant UI; the real write + a
   *  background reload (or realtime) reconcile afterwards. */
  patch: (updater: (prev: TripState) => Partial<TripState>) => void
}

type TripState = Omit<TripData, 'loading' | 'error' | 'reload' | 'trips' | 'currentTripId' | 'switchTrip' | 'canEdit' | 'patch'>

const TripContext = createContext<TripData | undefined>(undefined)

const empty = {
  trip: null, profile: null, travelers: [], travelerFiles: [], flights: [], trains: [], trainTickets: [], hotels: [], days: [],
  stops: [], places: [], interests: [], expenses: [], memberProfiles: [], myPermission: 'owner' as const,
}

const STORAGE_KEY = 'trip:currentId'

// ---- offline snapshot: last successful load, kept per trip in localStorage so
// the app still opens with data when there is no connection ----
const SNAP_TRIPS = 'taurus:snap:trips'
const snapKey = (tripId: string) => `taurus:snap:trip:${tripId}`
function readJSON<T>(key: string): T | null {
  try { const s = localStorage.getItem(key); return s ? (JSON.parse(s) as T) : null } catch { return null }
}
function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota/blocked — snapshot is best-effort */ }
}

export function TripProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trips, setTrips] = useState<Trip[]>([])
  const [currentTripId, setCurrentTripId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  )
  // Always-current mirror of currentTripId. `load` reads this instead of the
  // state value it closed over, so a `reload()` fired right after switchTrip()
  // (e.g. from the create-trip wizard) targets the trip that is now current —
  // not the stale one captured when the callback was created.
  const currentTripIdRef = useRef(currentTripId)
  useEffect(() => { currentTripIdRef.current = currentTripId }, [currentTripId])
  const [data, setData] = useState<TripState>(empty)
  // user id we've already run the one-time bootstrap (profile upsert + invites) for
  const bootstrappedFor = useRef<string | null>(null)

  const switchTrip = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id)
    // Update the ref synchronously (the [currentTripId] effect only runs after
    // the next commit) so a reload() called in the same tick — as the create
    // wizard does right after switching — already targets the new trip.
    currentTripIdRef.current = id
    setCurrentTripId(id)
  }, [])

  const patch = useCallback((updater: (prev: TripState) => Partial<TripState>) => {
    setData((prev) => ({ ...prev, ...updater(prev) }))
  }, [])

  // Restore the last saved snapshot (current trip, else the first cached one).
  // Returns true when there was data to show.
  const offlineToasted = useRef(false)
  const hydrateOffline = useCallback((): boolean => {
    const cachedTrips = readJSON<Trip[]>(SNAP_TRIPS)
    if (cachedTrips?.length) setTrips(cachedTrips)
    const id = currentTripIdRef.current ?? cachedTrips?.[0]?.id ?? null
    const snap = id ? readJSON<TripState>(snapKey(id)) : null
    if (!snap) return false
    setData(snap)
    setError(null)
    if (!offlineToasted.current) {
      offlineToasted.current = true
      toast.info('ออฟไลน์อยู่ — แสดงข้อมูลล่าสุดที่บันทึกไว้ในเครื่อง')
    }
    return true
  }, [])

  const load = useCallback(async () => {
    if (!user) return
    setError(null)
    // No connection → straight to the snapshot (the network path would only
    // fail slowly; writes are queued separately by the offline queue).
    if (!navigator.onLine) {
      if (!hydrateOffline()) setError('ออฟไลน์อยู่ และยังไม่มีข้อมูลทริปที่บันทึกไว้ในเครื่องนี้')
      return
    }
    try {
      // One-time-per-session bootstrap: ensure a profile row exists and accept any
      // pending invites. These don't change between reloads, so skipping them on
      // every refresh removes two sequential round-trips from each button press.
      if (bootstrappedFor.current !== user.id) {
        const profUpsert = await supabase
          .from('profiles')
          .upsert(
            { id: user.id, nickname: user.email?.split('@')[0] ?? 'me', avatar_color: 'av3' },
            { onConflict: 'id', ignoreDuplicates: true },
          )
        if (profUpsert.error) throw new Error(`[โปรไฟล์] ${profUpsert.error.message}`)
        // No-op if the accept_my_invites() function hasn't been added yet.
        await supabase.rpc('accept_my_invites')
        bootstrappedFor.current = user.id
      }

      // All of the current trip's data in one parallel batch (1 round-trip).
      const fetchTripData = (trip_id: string) => Promise.all([
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
        // optional — table only exists after supabase/trains.sql; errors are tolerated
        supabase.from('trains').select('*').eq('trip_id', trip_id).order('travel_date'),
        // optional — table only exists after supabase/train_tickets.sql; tolerated
        supabase.from('train_tickets').select('*').eq('trip_id', trip_id).order('position'),
      ])

      // Fetch the trips list and (when we already know the current trip — i.e. on
      // every reload, not just the first load) its data concurrently, so a button
      // press doesn't wait for the trips list before the trip data even starts.
      const knownId = currentTripIdRef.current
      const tripsP = supabase.from('trips').select('*').order('created_at', { ascending: true })
      const batchP = knownId ? fetchTripData(knownId) : null

      const tripsRes = await tripsP
      if (tripsRes.error) throw new Error(`[อ่านทริป] ${tripsRes.error.message}`)
      const allTrips = tripsRes.data ?? []
      setTrips(allTrips)

      writeJSON(SNAP_TRIPS, allTrips)

      // Pick the current trip (saved, else first). No trip yet → empty state.
      const current = allTrips.find((t) => t.id === currentTripIdRef.current) ?? allTrips[0]
      if (!current) { setData(empty); return }
      if (current.id !== currentTripIdRef.current) {
        localStorage.setItem(STORAGE_KEY, current.id)
        setCurrentTripId(current.id)
      }

      // Reuse the concurrent batch if it was for the trip we resolved to; otherwise
      // (first load, or the saved id was stale) fetch for the real current trip.
      const [
        profileRes, travelersRes, travelerFilesRes, flightsRes, hotelsRes, daysRes, stopsRes,
        placesRes, expensesRes, membersRes, trainsRes, trainTicketsRes,
      ] = (batchP && current.id === knownId) ? await batchP : await fetchTripData(current.id)

      // Supabase returns failures as an `error` value (not a thrown exception),
      // so check each one — otherwise a failed query silently shows an empty list.
      const failures: [string, { message: string } | null][] = [
        ['โปรไฟล์', profileRes.error], ['ผู้เดินทาง', travelersRes.error],
        ['ไฟล์ผู้เดินทาง', travelerFilesRes.error], ['เที่ยวบิน', flightsRes.error],
        ['ที่พัก', hotelsRes.error], ['วันเดินทาง', daysRes.error],
        ['จุดแวะ', stopsRes.error], ['สถานที่', placesRes.error],
        ['ค่าใช้จ่าย', expensesRes.error], ['สมาชิก', membersRes.error],
      ]
      const failed = failures.find(([, err]) => err)
      if (failed) throw new Error(`[${failed[0]}] ${failed[1]!.message}`)

      // Interests (by place) and member profiles (by member) both depend on the
      // batch above — fetch them together in a single second round-trip.
      const places = (placesRes.data ?? []) as Place[]
      const placeIds = places.map((p) => p.id)
      const members = (membersRes.data ?? []) as Pick<TripMember, 'user_id' | 'permission'>[]
      const memberIds = members.map((m) => m.user_id)
      const [interestsRes, memberProfilesRes] = await Promise.all([
        placeIds.length
          ? supabase.from('place_interest').select('*').in('place_id', placeIds)
          : Promise.resolve({ data: [] as PlaceInterest[], error: null }),
        memberIds.length
          ? supabase.from('profiles').select('*').in('id', memberIds)
          : Promise.resolve({ data: [] as Profile[], error: null }),
      ])
      if (interestsRes.error) throw new Error(`[ความสนใจ] ${interestsRes.error.message}`)
      if (memberProfilesRes.error) throw new Error(`[สมาชิก] ${memberProfilesRes.error.message}`)

      const myPermission: 'owner' | 'edit' | 'places' | 'view' =
        current.owner_id === user.id
          ? 'owner'
          : (() => {
              const p = members.find((m) => m.user_id === user.id)?.permission
              return (p === 'places' || p === 'view') ? p : 'edit'
            })()

      const next: TripState = {
        trip: current,
        myPermission,
        profile: (profileRes.data as Profile) ?? null,
        travelers: travelersRes.data ?? [],
        travelerFiles: (travelerFilesRes.data ?? []) as TravelerFile[],
        flights: flightsRes.data ?? [],
        // trains table is optional (migration may not be run yet) — tolerate its error
        trains: (trainsRes.error ? [] : trainsRes.data ?? []) as Train[],
        // train_tickets table is optional too — tolerate its error
        trainTickets: (trainTicketsRes.error ? [] : trainTicketsRes.data ?? []) as TrainTicket[],
        hotels: (hotelsRes.data ?? []) as Hotel[],
        days: daysRes.data ?? [],
        stops: (stopsRes.data ?? []) as ItineraryStop[],
        places,
        interests: (interestsRes.data ?? []) as PlaceInterest[],
        expenses: (expensesRes.data ?? []) as Expense[],
        memberProfiles: (memberProfilesRes.data ?? []) as Profile[],
      }
      setData(next)
      writeJSON(snapKey(current.id), next) // offline snapshot
      offlineToasted.current = false       // next offline period may toast again
    } catch (e) {
      // Mid-request drop (or a flaky connection navigator.onLine missed) —
      // fall back to the snapshot instead of an error screen.
      if (looksOffline(e) && hydrateOffline()) return
      console.error('TripContext load failed:', e)
      const msg = e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ'
      setError(msg)
      toast.error(`โหลดข้อมูลไม่สำเร็จ: ${msg}`)
    }
  }, [user?.id, currentTripId, hydrateOffline])

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
    for (const table of ['itinerary_days', 'itinerary_stops', 'places', 'expenses', 'travelers', 'flights']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `trip_id=eq.${currentTripId}` }, bump)
    }
    channel.subscribe()
    return () => { clearTimeout(timer); supabase.removeChannel(channel) }
  }, [currentTripId, load])

  // Personal plan reminders — on-device, per user (see lib/planReminders.ts).
  // Runs while the app is open; each due stop fires once per device per day.
  useEffect(() => {
    const run = () => checkPlanReminders(user?.id, data.trip, data.days, data.stops)
    const first = setTimeout(run, 2500) // shortly after data settles
    const timer = setInterval(run, 30_000)
    return () => { clearTimeout(first); clearInterval(timer) }
  }, [user?.id, data.trip, data.days, data.stops])

  // Replay any offline writes on reconnect (and once on mount), then refresh.
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load }, [load])
  useEffect(() => initOfflineSync(() => loadRef.current()), [])

  return (
    <TripContext.Provider value={{ loading, error, trips, currentTripId, switchTrip, reload: load, patch, ...data, canEdit: data.myPermission === 'owner' || data.myPermission === 'edit' }}>
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
