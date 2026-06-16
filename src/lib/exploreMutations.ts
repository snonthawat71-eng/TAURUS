import { supabase } from './supabase'
import type { ExplorePlace, Place, Profile } from './database.types'

export type ExploreInput = Partial<Omit<ExplorePlace, 'id' | 'created_by' | 'created_at'>>

export async function listExplore() {
  return supabase.from('explore_places').select('*').order('created_at', { ascending: false })
}

// `routes` is optional (added later) — strip it on a "column does not exist" error.
const OPTIONAL = ['routes']
function stripUnknown(payload: Record<string, unknown>, msg: string) {
  const copy = { ...payload }; let changed = false
  for (const k of OPTIONAL) if (k in copy && msg.includes(k)) { delete copy[k]; changed = true }
  return changed ? copy : null
}

export async function addExplore(created_by: string, input: ExploreInput) {
  const payload: Record<string, unknown> = { id: crypto.randomUUID(), created_by, ...input }
  let res = await supabase.from('explore_places').insert(payload)
  if (res.error) { const s = stripUnknown(payload, res.error.message); if (s) res = await supabase.from('explore_places').insert(s) }
  return res
}

export async function updateExplore(id: string, input: ExploreInput) {
  const payload: Record<string, unknown> = { ...input }
  let res = await supabase.from('explore_places').update(payload).eq('id', id)
  if (res.error) { const s = stripUnknown(payload, res.error.message); if (s) res = await supabase.from('explore_places').update(s).eq('id', id) }
  return res
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

export interface VoteStat { up: number; down: number; rating: number; count: number }

/** A 0–5 star rating from like/unlike counts (share of likes × 5). */
export function ratingFrom(up: number, down: number): number {
  const total = up + down
  if (!total) return 0
  return Math.round((up / total) * 5 * 10) / 10
}

/** Aggregate votes for every Explore item → Map<explore_id, VoteStat>. */
export async function allVoteStats() {
  const map = new Map<string, VoteStat>()
  const { data } = await supabase.from('explore_votes').select('explore_id,vote')
  for (const r of data ?? []) {
    const s = map.get(r.explore_id) ?? { up: 0, down: 0, rating: 0, count: 0 }
    if (r.vote === 1) s.up++; else if (r.vote === -1) s.down++
    map.set(r.explore_id, s)
  }
  for (const s of map.values()) { s.count = s.up + s.down; s.rating = ratingFrom(s.up, s.down) }
  return map
}

/** Set my vote; sending the same value again clears it (toggle off). */
export async function setVote(exploreId: string, userId: string, vote: 1 | -1, current: number) {
  if (current === vote) {
    return supabase.from('explore_votes').delete().eq('explore_id', exploreId).eq('user_id', userId)
  }
  return supabase.from('explore_votes').upsert({ explore_id: exploreId, user_id: userId, vote }, { onConflict: 'explore_id,user_id' })
}

// ---- Notifications (likes / comments on MY explore items) -----------------

export interface ExploreNotif {
  id: string
  kind: 'like' | 'comment'
  exploreId: string
  placeName: string
  who: string
  whoColor?: string | null
  body?: string
  at: string
}

/**
 * Build the owner's notification feed: every like (👍) and comment left by
 * *other* people on Explore items this user created, newest first. Derived
 * from existing tables (no extra schema) — all rows are readable under RLS.
 */
export async function getExploreNotifs(userId: string): Promise<ExploreNotif[]> {
  const { data: mine } = await supabase.from('explore_places').select('id,name').eq('created_by', userId)
  const items = mine ?? []
  if (!items.length) return []
  const nameById = new Map(items.map((i) => [i.id as string, (i.name as string) ?? '']))
  const ids = items.map((i) => i.id as string)

  const [cRes, vRes] = await Promise.all([
    supabase.from('explore_comments')
      .select('id,explore_id,user_id,author_name,author_color,body,created_at')
      .in('explore_id', ids).neq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('explore_votes')
      .select('explore_id,user_id,created_at')
      .in('explore_id', ids).eq('vote', 1).neq('user_id', userId),
  ])
  const comments = cRes.data ?? []
  const votes = vRes.data ?? []

  // resolve voter display names from profiles (votes don't store a name)
  const voterIds = [...new Set(votes.map((v) => v.user_id).filter(Boolean) as string[])]
  const profById = new Map<string, Profile>()
  if (voterIds.length) {
    const { data: profs } = await supabase.from('profiles').select('*').in('id', voterIds)
    for (const p of (profs ?? []) as Profile[]) profById.set(p.id, p)
  }

  const out: ExploreNotif[] = []
  for (const c of comments) {
    out.push({
      id: `c:${c.id}`, kind: 'comment', exploreId: c.explore_id as string,
      placeName: nameById.get(c.explore_id as string) ?? '', who: c.author_name || 'ใครบางคน',
      whoColor: c.author_color as string | null, body: c.body as string, at: c.created_at as string,
    })
  }
  for (const v of votes) {
    const p = v.user_id ? profById.get(v.user_id as string) : undefined
    out.push({
      id: `v:${v.explore_id}:${v.user_id}`, kind: 'like', exploreId: v.explore_id as string,
      placeName: nameById.get(v.explore_id as string) ?? '',
      who: p?.nickname || p?.full_name || 'ใครบางคน', whoColor: p?.avatar_color ?? null,
      at: (v.created_at as string) ?? new Date(0).toISOString(),
    })
  }
  out.sort((a, b) => (a.at < b.at ? 1 : -1))
  return out
}

/** Shape an Explore pool item as a Place so it can be copied into a trip. */
export function exploreAsPlace(e: ExplorePlace): Place {
  return {
    id: e.id, trip_id: '', group_type: e.group_type, category: e.category, name: e.name,
    station_line: e.station_line, station_color: e.station_color, station_name: e.station_name,
    routes: e.routes ?? null,
    map_url: e.map_url, note: e.note, in_plan: false, photo_path: null, photo_url: e.photo_url,
    city: e.city, created_at: e.created_at,
  }
}
