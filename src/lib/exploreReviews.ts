/**
 * Explore reviews — real 1–5 star ratings, per-aspect sub-scores, one-tap tags
 * and "what should I order" menu voting.
 *
 * Backed by supabase/explore_reviews.sql. Like every other optional migration
 * in this repo the client degrades gracefully: if the tables aren't there yet
 * every read returns empty and `reviewsReady()` flips to false so the UI can
 * show the "run the SQL" hint instead of silently doing nothing.
 *
 * Why this exists: the star rating shown before this file was NOT a rating at
 * all — it was `up / (up + down) × 5` over the 👍/👎 votes, so a place with 3
 * likes and 0 dislikes displayed a perfect 5.0 without a single person ever
 * giving it a star. `explore_ratings` holds what people actually rated.
 */
import { supabase } from './supabase'
import type { ExploreRating, ExploreMenuItem } from './database.types'

// ── migration probe ─────────────────────────────────────────────────────────
// One failed read is enough to know the SQL hasn't been run; keep it in module
// state so every component asks the DB at most once before showing the hint.
let ready: boolean | null = null

/** False only once a query has proven explore_reviews.sql hasn't been run. */
export function reviewsReady() { return ready !== false }

function probe(error: { message?: string } | null): boolean {
  if (!error) { ready = true; return true }
  const m = error.message ?? ''
  // PostgREST reports a missing table as "relation ... does not exist" / 404
  if (/does not exist|schema cache|Not Found/i.test(m)) ready = false
  return false
}

// ── tag catalog ─────────────────────────────────────────────────────────────
// The DB stores the KEY, never the Thai label, so wording can change later
// without rewriting rows. Tags are ordered most-useful-first — the picker shows
// them in this order.

export interface TagDef {
  key: string
  label: string
  /** which kinds of place this tag makes sense for */
  groups: ('food' | 'place')[]
}

export const TAGS: TagDef[] = [
  { key: 'mustgo', label: 'ห้ามพลาด', groups: ['food', 'place'] },
  { key: 'queue', label: 'ต้องต่อคิว', groups: ['food', 'place'] },
  { key: 'photogenic', label: 'ถ่ายรูปสวย', groups: ['food', 'place'] },
  { key: 'cheap', label: 'ราคาน่ารัก', groups: ['food', 'place'] },
  { key: 'booking', label: 'ต้องจองล่วงหน้า', groups: ['food', 'place'] },
  { key: 'nearstation', label: 'ใกล้สถานี', groups: ['food', 'place'] },
  // food only
  { key: 'spicy', label: 'เผ็ดจัด', groups: ['food'] },
  { key: 'bigportion', label: 'พอร์ชั่นใหญ่', groups: ['food'] },
  { key: 'fewseats', label: 'ที่นั่งน้อย', groups: ['food'] },
  { key: 'englishmenu', label: 'มีเมนูอังกฤษ', groups: ['food'] },
  { key: 'veggie', label: 'มีเมนูเจ/มังสวิรัติ', groups: ['food'] },
  { key: 'lateopen', label: 'เปิดดึก', groups: ['food'] },
  { key: 'cashonly', label: 'รับเงินสดอย่างเดียว', groups: ['food'] },
  // place only
  { key: 'freeentry', label: 'เข้าฟรี', groups: ['place'] },
  { key: 'walklot', label: 'เดินเยอะ', groups: ['place'] },
  { key: 'kidfriendly', label: 'ไปกับเด็กได้', groups: ['place'] },
  { key: 'crowded', label: 'คนเยอะ', groups: ['place'] },
  { key: 'halfday', label: 'ใช้เวลาครึ่งวัน', groups: ['place'] },
  { key: 'rainok', label: 'ฝนตกก็เที่ยวได้', groups: ['place'] },
  { key: 'nightview', label: 'วิวกลางคืนสวย', groups: ['place'] },
]

const TAG_BY_KEY = new Map(TAGS.map((t) => [t.key, t]))

/** A tag someone voted that isn't in the catalog any more still needs a label. */
export function tagDef(key: string): TagDef {
  return TAG_BY_KEY.get(key) ?? { key, label: key, groups: ['food', 'place'] }
}

export const isFood = (groupType: string | null | undefined) => groupType === 'food'

export function tagsFor(groupType: string | null | undefined): TagDef[] {
  const g = isFood(groupType) ? 'food' : 'place'
  return TAGS.filter((t) => t.groups.includes(g))
}

// ── sub-score (aspect) catalog ──────────────────────────────────────────────
// Same four DB columns for both groups; only the wording changes, because
// "รสชาติ" makes no sense for a temple and "ความน่าสนใจ" makes none for ramen.

export type AspectKey = 'taste' | 'worth' | 'vibe' | 'queue'

export interface AspectDef { key: AspectKey; label: string; hint?: string }

export function aspectsFor(groupType: string | null | undefined): AspectDef[] {
  const food = isFood(groupType)
  return [
    { key: 'taste', label: food ? 'รสชาติ' : 'ความน่าสนใจ' },
    { key: 'worth', label: 'คุ้มราคา' },
    { key: 'vibe', label: 'บรรยากาศ' },
    { key: 'queue', label: 'คิว', hint: '5 ดาว = แทบไม่ต้องรอ' },
  ]
}

// ── aggregation ─────────────────────────────────────────────────────────────

export interface RatingStat {
  /** mean of `stars`, 1 decimal; 0 when nobody has rated */
  avg: number
  count: number
  /** how many gave 1★…5★ — index 0 = 1 star */
  dist: [number, number, number, number, number]
  /** mean per aspect (0 = nobody scored that aspect) */
  aspects: Record<AspectKey, { avg: number; count: number }>
}

export const emptyStat = (): RatingStat => ({
  avg: 0, count: 0, dist: [0, 0, 0, 0, 0],
  aspects: { taste: { avg: 0, count: 0 }, worth: { avg: 0, count: 0 }, vibe: { avg: 0, count: 0 }, queue: { avg: 0, count: 0 } },
})

const round1 = (n: number) => Math.round(n * 10) / 10

export function summarise(rows: ExploreRating[]): RatingStat {
  const s = emptyStat()
  if (!rows.length) return s
  let total = 0
  const acc: Record<AspectKey, { sum: number; n: number }> = {
    taste: { sum: 0, n: 0 }, worth: { sum: 0, n: 0 }, vibe: { sum: 0, n: 0 }, queue: { sum: 0, n: 0 },
  }
  for (const r of rows) {
    const stars = Math.min(5, Math.max(1, Math.round(r.stars)))
    total += stars
    s.dist[stars - 1]++
    for (const k of ['taste', 'worth', 'vibe', 'queue'] as AspectKey[]) {
      const v = r[k]
      if (typeof v === 'number' && v >= 1) { acc[k].sum += v; acc[k].n++ }
    }
  }
  s.count = rows.length
  s.avg = round1(total / rows.length)
  for (const k of ['taste', 'worth', 'vibe', 'queue'] as AspectKey[]) {
    s.aspects[k] = { avg: acc[k].n ? round1(acc[k].sum / acc[k].n) : 0, count: acc[k].n }
  }
  return s
}

// ── ratings ─────────────────────────────────────────────────────────────────

export interface ReviewData {
  rows: ExploreRating[]
  stat: RatingStat
  mine: ExploreRating | null
}

export async function getReviews(exploreId: string, userId?: string): Promise<ReviewData> {
  const { data, error } = await supabase.from('explore_ratings').select('*')
    .eq('explore_id', exploreId).order('updated_at', { ascending: false })
  if (error) { probe(error); return { rows: [], stat: emptyStat(), mine: null } }
  probe(null)
  const rows = (data ?? []) as ExploreRating[]
  return { rows, stat: summarise(rows), mine: (userId && rows.find((r) => r.user_id === userId)) || null }
}

export interface RatingAuthor {
  name?: string | null
  color?: string | null
  photo?: string | null
  focus?: string | null
}

export type RatingPatch = { stars?: number } & Partial<Record<AspectKey, number | null>>

/**
 * Write my rating for a place. Sends only what changed on top of what's already
 * stored, so tapping a sub-score never wipes the overall stars (and vice versa).
 *
 * The overall stars ALSO drive the legacy 👍/👎 row: 4–5★ counts as a
 * recommendation, 1–2★ as a not-recommendation, 3★ clears it. That keeps the
 * POPULAR ranking and the owner's like notifications working off one action
 * instead of asking for a thumb and a star separately.
 */
export async function setRating(
  exploreId: string, userId: string, current: ExploreRating | null,
  patch: RatingPatch, author: RatingAuthor = {},
) {
  const stars = patch.stars ?? current?.stars
  if (!stars) return { error: { message: 'no stars' } }
  const row: Record<string, unknown> = {
    explore_id: exploreId, user_id: userId, stars,
    taste: 'taste' in patch ? patch.taste : current?.taste ?? null,
    worth: 'worth' in patch ? patch.worth : current?.worth ?? null,
    vibe: 'vibe' in patch ? patch.vibe : current?.vibe ?? null,
    queue: 'queue' in patch ? patch.queue : current?.queue ?? null,
    author_name: author.name ?? current?.author_name ?? null,
    author_color: author.color ?? current?.author_color ?? null,
    author_photo: author.photo ?? current?.author_photo ?? null,
    author_focus: author.focus ?? current?.author_focus ?? null,
    updated_at: new Date().toISOString(),
  }
  const res = await supabase.from('explore_ratings').upsert(row, { onConflict: 'explore_id,user_id' })
  if (res.error) { probe(res.error); return res }
  probe(null)
  await syncVote(exploreId, userId, stars)
  return res
}

/** Mirror an overall star score onto the legacy recommend/not-recommend vote. */
async function syncVote(exploreId: string, userId: string, stars: number) {
  try {
    if (stars === 3) {
      await supabase.from('explore_votes').delete().eq('explore_id', exploreId).eq('user_id', userId)
    } else {
      await supabase.from('explore_votes')
        .upsert({ explore_id: exploreId, user_id: userId, vote: stars >= 4 ? 1 : -1 }, { onConflict: 'explore_id,user_id' })
    }
  } catch { /* votes are a secondary signal — never block the rating on them */ }
}

export async function clearRating(exploreId: string, userId: string) {
  const res = await supabase.from('explore_ratings').delete().eq('explore_id', exploreId).eq('user_id', userId)
  await supabase.from('explore_votes').delete().eq('explore_id', exploreId).eq('user_id', userId)
  return res
}

/** Overall rating per Explore item, for the list cards. Empty map when the
 *  migration hasn't been run. */
export async function allRatingStats(): Promise<Map<string, { avg: number; count: number }>> {
  const out = new Map<string, { avg: number; count: number }>()
  const { data, error } = await supabase.from('explore_ratings').select('explore_id,stars')
  if (error) { probe(error); return out }
  probe(null)
  const acc = new Map<string, { sum: number; n: number }>()
  for (const r of data ?? []) {
    const id = r.explore_id as string
    const a = acc.get(id) ?? { sum: 0, n: 0 }
    a.sum += r.stars as number; a.n++
    acc.set(id, a)
  }
  for (const [id, a] of acc) out.set(id, { avg: round1(a.sum / a.n), count: a.n })
  return out
}

// ── tags ────────────────────────────────────────────────────────────────────

export interface TagData {
  /** tag key → how many people tapped it, highest first */
  counts: { key: string; n: number }[]
  mine: Set<string>
}

export async function getTags(exploreId: string, userId?: string): Promise<TagData> {
  const { data, error } = await supabase.from('explore_tags').select('tag,user_id').eq('explore_id', exploreId)
  if (error) { probe(error); return { counts: [], mine: new Set() } }
  probe(null)
  const n = new Map<string, number>()
  const mine = new Set<string>()
  for (const r of data ?? []) {
    const tag = r.tag as string
    n.set(tag, (n.get(tag) ?? 0) + 1)
    if (userId && r.user_id === userId) mine.add(tag)
  }
  const counts = [...n.entries()].map(([key, count]) => ({ key, n: count }))
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key))
  return { counts, mine }
}

export async function toggleTag(exploreId: string, userId: string, tag: string, on: boolean) {
  if (on) {
    return supabase.from('explore_tags').upsert({ explore_id: exploreId, user_id: userId, tag }, { onConflict: 'explore_id,user_id,tag' })
  }
  return supabase.from('explore_tags').delete().eq('explore_id', exploreId).eq('user_id', userId).eq('tag', tag)
}

/** Top tags for a place in one shot, for compact card/summary use. */
export async function topTags(exploreId: string, limit = 3) {
  return (await getTags(exploreId)).counts.slice(0, limit)
}

// ── menu voting ─────────────────────────────────────────────────────────────

export interface MenuRow extends ExploreMenuItem {
  votes: number
  mine: boolean
}

/** Dishes for a restaurant, most-voted first. */
export async function getMenu(exploreId: string, userId?: string): Promise<MenuRow[]> {
  const { data, error } = await supabase.from('explore_menu_items').select('*')
    .eq('explore_id', exploreId).order('created_at', { ascending: true })
  if (error) { probe(error); return [] }
  probe(null)
  const items = (data ?? []) as ExploreMenuItem[]
  if (!items.length) return []
  const { data: vs } = await supabase.from('explore_menu_votes').select('item_id,user_id')
    .in('item_id', items.map((i) => i.id))
  const n = new Map<string, number>()
  const mine = new Set<string>()
  for (const v of vs ?? []) {
    const id = v.item_id as string
    n.set(id, (n.get(id) ?? 0) + 1)
    if (userId && v.user_id === userId) mine.add(id)
  }
  return items
    .map((i) => ({ ...i, votes: n.get(i.id) ?? 0, mine: mine.has(i.id) }))
    .sort((a, b) => b.votes - a.votes || (a.created_at ?? '').localeCompare(b.created_at ?? ''))
}

/** Add a dish. Adding one counts as voting for it — nobody adds a dish they
 *  don't recommend, and it saves a second tap. */
export async function addMenuItem(exploreId: string, userId: string, name: string) {
  const clean = name.trim()
  if (!clean) return { error: { message: 'empty' } }
  const id = crypto.randomUUID()
  const res = await supabase.from('explore_menu_items').insert({ id, explore_id: exploreId, name: clean, created_by: userId })
  if (res.error) {
    probe(res.error)
    // already there (unique index) — just put my vote on the existing row
    if (/duplicate key|unique/i.test(res.error.message)) {
      const { data } = await supabase.from('explore_menu_items').select('id')
        .eq('explore_id', exploreId).ilike('name', clean).maybeSingle()
      if (data?.id) { await toggleMenuVote(data.id as string, userId, true); return { error: null } }
    }
    return res
  }
  probe(null)
  await toggleMenuVote(id, userId, true)
  return res
}

export async function deleteMenuItem(id: string) {
  return supabase.from('explore_menu_items').delete().eq('id', id)
}

export async function toggleMenuVote(itemId: string, userId: string, on: boolean) {
  if (on) return supabase.from('explore_menu_votes').upsert({ item_id: itemId, user_id: userId }, { onConflict: 'item_id,user_id' })
  return supabase.from('explore_menu_votes').delete().eq('item_id', itemId).eq('user_id', userId)
}

// ── "your review helped N people" ───────────────────────────────────────────

/**
 * How many *other* people opened or saved this place after I reviewed it —
 * the closest honest proxy for "my review was useful" we can build from the
 * data already collected (explore_events, supabase/explore_popular.sql).
 * Returns 0 when the events table isn't there.
 */
export async function helpedCount(exploreId: string, sinceIso: string, myUserId: string): Promise<number> {
  const { data, error } = await supabase.from('explore_events')
    .select('user_id').eq('explore_id', exploreId).gt('created_at', sinceIso)
  if (error) return 0
  const people = new Set<string>()
  for (const r of data ?? []) {
    const u = r.user_id as string | null
    if (u && u !== myUserId) people.add(u)
  }
  return people.size
}
