import { supabase } from './supabase'
import type { Place } from './database.types'

export type PlaceInput = Partial<Omit<Place, 'id' | 'trip_id' | 'created_at'>>

export async function addPlace(trip_id: string, input: PlaceInput) {
  return supabase.from('places').insert({ id: crypto.randomUUID(), trip_id, in_plan: false, ...input })
}

export async function updatePlace(id: string, fields: PlaceInput) {
  return supabase.from('places').update(fields).eq('id', id)
}

export async function deletePlace(id: string) {
  return supabase.from('places').delete().eq('id', id)
}

export async function setInPlan(id: string, in_plan: boolean) {
  return supabase.from('places').update({ in_plan }).eq('id', id)
}

/** Toggle the current user's "want to go" interest for a place. */
export async function toggleInterest(place_id: string, user_id: string, currentlyInterested: boolean) {
  if (currentlyInterested) {
    return supabase.from('place_interest').delete().eq('place_id', place_id).eq('user_id', user_id)
  }
  return supabase.from('place_interest').insert({ place_id, user_id })
}
