import { supabase } from './supabase'
import type { ExplorePlace, Place, Profile } from './database.types'

export type ExploreInput = Partial<Omit<ExplorePlace, 'id' | 'created_by' | 'created_at'>>

export async function listExplore() {
  return supabase.from('explore_places').select('*').order('created_at', { ascending: false })
}

/** Only the items the given user shared (for the "manage my places" page). */
export async function listMyExplore(userId: string) {
  return supabase.from('explore_places').select('*').eq('created_by', userId).order('created_at', { ascending: false })
}

// `routes`/`branches` are optional (added later) — strip on a "column does not exist" error.
const OPTIONAL = ['routes', 'branches', 'multi_branch']
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

export async function addComment(
  exploreId: string, userId: string, body: string, authorName: string,
  authorColor?: string | null, parentId?: string | null,
) {
  const payload: Record<string, unknown> = {
    id: crypto.randomUUID(), explore_id: exploreId, user_id: userId,
    author_name: authorName, author_color: authorColor ?? null, body, parent_id: parentId ?? null,
  }
  let res = await supabase.from('explore_comments').insert(payload)
  // `parent_id` is added later (explore.sql) — retry without it if the column is missing
  if (res.error && res.error.message.includes('parent_id')) {
    const { parent_id, ...rest } = payload // eslint-disable-line @typescript-eslint/no-unused-vars
    res = await supabase.from('explore_comments').insert(rest)
  }
  return res
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

// ---- Popularity (clicks + saves + likes + comments → POPULAR) -------------

/** Log a view (click) or save event. Best-effort; ignores errors / missing table. */
export async function logExploreEvent(exploreId: string, userId: string, kind: 'view' | 'save') {
  try { await supabase.from('explore_events').insert({ explore_id: exploreId, user_id: userId, kind }) }
  catch { /* table may not exist yet */ }
}

export interface PopStat { views: number; saves: number; likes: number; comments: number; score: number }

/** Weighted popularity score from the four signals. */
function scoreOf(s: { views: number; saves: number; likes: number; comments: number }): number {
  return s.views + s.saves * 4 + s.likes * 3 + s.comments * 2
}

/** Aggregate every signal per Explore item → Map<explore_id, PopStat>. */
export async function allPopularity(): Promise<Map<string, PopStat>> {
  const map = new Map<string, PopStat>()
  const get = (id: string) => {
    let s = map.get(id)
    if (!s) { s = { views: 0, saves: 0, likes: 0, comments: 0, score: 0 }; map.set(id, s) }
    return s
  }

  const [evRes, voteRes, comRes] = await Promise.all([
    supabase.from('explore_events').select('explore_id,user_id,kind'),
    supabase.from('explore_votes').select('explore_id,vote'),
    supabase.from('explore_comments').select('explore_id'),
  ])

  const savers = new Map<string, Set<string>>() // distinct savers per item
  for (const e of evRes.data ?? []) {
    if (!e.explore_id) continue
    if (e.kind === 'view') get(e.explore_id as string).views++
    else if (e.kind === 'save') {
      const set = savers.get(e.explore_id as string) ?? new Set<string>()
      set.add((e.user_id as string) ?? Math.random().toString()); savers.set(e.explore_id as string, set)
    }
  }
  for (const [id, set] of savers) get(id).saves = set.size
  for (const v of voteRes.data ?? []) if (v.vote === 1 && v.explore_id) get(v.explore_id as string).likes++
  for (const c of comRes.data ?? []) if (c.explore_id) get(c.explore_id as string).comments++

  for (const s of map.values()) s.score = scoreOf(s)
  return map
}

/** Which items rank as POPULAR — score ≥ 60% of the top score, with a floor. */
export function popularSet(stats: Map<string, PopStat>): Set<string> {
  const entries = [...stats.entries()].filter(([, s]) => s.score > 0)
  if (!entries.length) return new Set()
  const max = Math.max(...entries.map(([, s]) => s.score))
  const cutoff = Math.max(3, max * 0.6)
  return new Set(entries.filter(([, s]) => s.score >= cutoff).map(([id]) => id))
}

/** Shape an Explore pool item as a Place so it can be copied into a trip. */
export function exploreAsPlace(e: ExplorePlace): Place {
  return {
    id: e.id, trip_id: '', group_type: e.group_type, category: e.category, name: e.name,
    station_line: e.station_line, station_color: e.station_color, station_name: e.station_name,
    routes: e.routes ?? null, branches: e.branches ?? null, multi_branch: e.multi_branch ?? null,
    map_url: e.map_url, note: e.note, in_plan: false, photo_path: null, photo_url: e.photo_url,
    city: e.city, created_at: e.created_at,
  }
}
