import { supabase } from './supabase'
import type { ExplorePlace, Place } from './database.types'

export type ExploreInput = Partial<Omit<ExplorePlace, 'id' | 'created_by' | 'created_at'>>

export async function listExplore() {
  return supabase.from('explore_places').select('*').order('created_at', { ascending: false })
}

export async function addExplore(created_by: string, input: ExploreInput) {
  return supabase.from('explore_places').insert({ id: crypto.randomUUID(), created_by, ...input })
}

export async function deleteExplore(id: string) {
  return supabase.from('explore_places').delete().eq('id', id)
}

/** Shape an Explore pool item as a Place so it can be copied into a trip. */
export function exploreAsPlace(e: ExplorePlace): Place {
  return {
    id: e.id, trip_id: '', group_type: e.group_type, category: e.category, name: e.name,
    station_line: e.station_line, station_color: e.station_color, station_name: e.station_name,
    map_url: e.map_url, note: e.note, in_plan: false, photo_path: null, photo_url: e.photo_url,
    city: e.city, created_at: e.created_at,
  }
}
