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

export const ASPECT_KEYS: AspectKey[] = ['taste', 'worth', 'vibe', 'queue']

export interface AspectDef { key: AspectKey; label: string; hint: string }

export function aspectsFor(groupType: string | null | undefined): AspectDef[] {
  const food = isFood(groupType)
  return [
    { key: 'taste', label: food ? 'รสชาติ' : 'ความน่าสนใจ', hint: food ? 'อร่อยแค่ไหน' : 'น่าไปแค่ไหน' },
    { key: 'worth', label: 'คุ้มราคา', hint: 'จ่ายเท่านี้คุ้มไหม' },
    { key: 'vibe', label: 'บรรยากาศ', hint: food ? 'ร้านนั่งสบายไหม' : 'ที่นี่บรรยากาศดีไหม' },
    { key: 'queue', label: 'คิว', hint: '5 ดาว = แทบไม่ต้องรอ' },
  ]
}

/**
 * The overall score is NOT something anyone taps — it's the mean of the four
 * aspects, to 2 decimals. Handing people a separate overall control let them
 * give 5★ overall while marking every aspect terrible; deriving it makes that
 * contradiction impossible to express. 0 = not enough aspects scored yet.
 */
export function overallOf(a: Partial<Record<AspectKey, number | null>>): number {
  const vals = ASPECT_KEYS.map((k) => a[k]).filter((v): v is number => typeof v === 'number' && v >= 1)
  if (!vals.length) return 0
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100
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
    // `stars` is a computed mean, so it's fractional — average the raw value
    // but bucket the histogram by the nearest whole star
    const raw = Math.min(5, Math.max(1, Number(r.stars) || 0))
    total += raw
    s.dist[Math.round(raw) - 1]++
    for (const k of ASPECT_KEYS) {
      const v = r[k]
      if (typeof v === 'number' && v >= 1) { acc[k].sum += v; acc[k].n++ }
    }
  }
  s.count = rows.length
  s.avg = round1(total / rows.length)
  for (const k of ASPECT_KEYS) {
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

/** What the review form holds while it's being filled in. */
export interface ReviewDraft {
  taste: number | null
  worth: number | null
  vibe: number | null
  queue: number | null
  tags: string[]
}

export const emptyDraft = (): ReviewDraft => ({ taste: null, worth: null, vibe: null, queue: null, tags: [] })

/** Seed the form from what I submitted last time (or blank for a new review). */
export function draftFrom(mine: ExploreRating | null, myTags: Iterable<string>): ReviewDraft {
  return {
    taste: mine?.taste ?? null,
    worth: mine?.worth ?? null,
    vibe: mine?.vibe ?? null,
    queue: mine?.queue ?? null,
    tags: [...myTags],
  }
}

/** A review only counts once every aspect has a score — that's what makes the
 *  computed overall comparable between places. */
export const draftComplete = (d: ReviewDraft) => ASPECT_KEYS.every((k) => !!d[k])

/**
 * Submit the whole review in one go: the four aspects, the derived overall and
 * my tag selection. Nothing here writes as you tap — the form commits once,
 * which is why tags moved inside it.
 *
 * The overall ALSO drives the legacy 👍/👎 row (≥3.5 recommend, ≤2.5 not, in
 * between clears) so the POPULAR ranking and the owner's like notifications
 * keep working without asking for a separate thumb.
 */
export async function saveReview(
  exploreId: string, userId: string, draft: ReviewDraft,
  prevTags: Iterable<string>, author: RatingAuthor = {},
) {
  const stars = overallOf(draft)
  if (!stars) return { error: { message: 'no score' } }
  const row: Record<string, unknown> = {
    explore_id: exploreId, user_id: userId, stars,
    taste: draft.taste, worth: draft.worth, vibe: draft.vibe, queue: draft.queue,
    author_name: author.name ?? null, author_color: author.color ?? null,
    author_photo: author.photo ?? null, author_focus: author.focus ?? null,
    updated_at: new Date().toISOString(),
  }
  const res = await supabase.from('explore_ratings').upsert(row, { onConflict: 'explore_id,user_id' })
  if (res.error) { probe(res.error); return res }
  probe(null)

  // tags are part of the same submit — write only the difference
  const before = new Set(prevTags)
  const after = new Set(draft.tags)
  const added = [...after].filter((t) => !before.has(t))
  const removed = [...before].filter((t) => !after.has(t))
  if (added.length) {
    await supabase.from('explore_tags')
      .upsert(added.map((tag) => ({ explore_id: exploreId, user_id: userId, tag })), { onConflict: 'explore_id,user_id,tag' })
  }
  if (removed.length) {
    await supabase.from('explore_tags').delete()
      .eq('explore_id', exploreId).eq('user_id', userId).in('tag', removed)
  }

  await syncVote(exploreId, userId, stars)
  return res
}

/** Mirror an overall score onto the legacy recommend/not-recommend vote. */
async function syncVote(exploreId: string, userId: string, stars: number) {
  try {
    if (stars > 2.5 && stars < 3.5) {
      await supabase.from('explore_votes').delete().eq('explore_id', exploreId).eq('user_id', userId)
    } else {
      await supabase.from('explore_votes')
        .upsert({ explore_id: exploreId, user_id: userId, vote: stars >= 3.5 ? 1 : -1 }, { onConflict: 'explore_id,user_id' })
    }
  } catch { /* votes are a secondary signal — never block the review on them */ }
}

/** Withdraw my review — score and my tags go together. */
export async function clearRating(exploreId: string, userId: string) {
  const res = await supabase.from('explore_ratings').delete().eq('explore_id', exploreId).eq('user_id', userId)
  await supabase.from('explore_tags').delete().eq('explore_id', exploreId).eq('user_id', userId)
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
    a.sum += Number(r.stars) || 0; a.n++
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

// Tags are written by `saveReview` as part of the review submit — there is no
// standalone tap-a-tag write, so the reviews tab has exactly one way to change
// your own opinion about a place.

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

/** What dishes I picked while filling the review form. */
export interface MenuDraft {
  /** ids of dishes already on the list that I'm recommending */
  votes: string[]
  /** dishes I typed in that don't exist yet */
  added: string[]
}

export const emptyMenuDraft = (): MenuDraft => ({ votes: [], added: [] })

/** Commit the menu step of the review form: create the dishes I typed, then
 *  reconcile my votes on the ones that were already listed. */
export async function saveMenuPicks(exploreId: string, userId: string, prev: Iterable<string>, draft: MenuDraft) {
  for (const name of draft.added) await addMenuItem(exploreId, userId, name)
  const before = new Set(prev)
  const after = new Set(draft.votes)
  const on = [...after].filter((id) => !before.has(id))
  const off = [...before].filter((id) => !after.has(id))
  if (on.length) {
    await supabase.from('explore_menu_votes')
      .upsert(on.map((item_id) => ({ item_id, user_id: userId })), { onConflict: 'item_id,user_id' })
  }
  if (off.length) {
    await supabase.from('explore_menu_votes').delete().eq('user_id', userId).in('item_id', off)
  }
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
