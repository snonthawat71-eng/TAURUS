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

// ---- Comments -------------------------------------------------------------

export async function listComments(exploreId: string) {
  return supabase.from('explore_comments').select('*').eq('explore_id', exploreId).order('created_at', { ascending: true })
}

export async function addComment(exploreId: string, userId: string, body: string, authorName: string, authorColor?: string | null) {
  return supabase.from('explore_comments').insert({
    id: crypto.randomUUID(), explore_id: exploreId, user_id: userId,
    author_name: authorName, author_color: authorColor ?? null, body,
  })
}

export async function deleteComment(id: string) {
  return supabase.from('explore_comments').delete().eq('id', id)
}

// ---- Votes (recommend / not recommend) ------------------------------------

/** All votes for an item → { up, down, mine } where mine ∈ {1, -1, 0}. */
export async function getVotes(exploreId: string, userId?: string) {
  const { data } = await supabase.from('explore_votes').select('user_id,vote').eq('explore_id', exploreId)
  const rows = data ?? []
  const up = rows.filter((r) => r.vote === 1).length
  const down = rows.filter((r) => r.vote === -1).length
  const mine = userId ? (rows.find((r) => r.user_id === userId)?.vote ?? 0) : 0
  return { up, down, mine }
}

/** Set my vote; sending the same value again clears it (toggle off). */
export async function setVote(exploreId: string, userId: string, vote: 1 | -1, current: number) {
  if (current === vote) {
    return supabase.from('explore_votes').delete().eq('explore_id', exploreId).eq('user_id', userId)
  }
  return supabase.from('explore_votes').upsert({ explore_id: exploreId, user_id: userId, vote }, { onConflict: 'explore_id,user_id' })
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
