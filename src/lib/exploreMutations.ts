import { supabase } from './supabase'
import { canonicalCountry } from './countries'
import { latLngFromUrl, latLngFromUrlExact, isMapLink, resolveMapUrl, resolvedLinkAddress, resolvedLinkName, geocodeSmart, localLang } from './geo'
import type { ExplorePlace, ExploreSuggestion, SuggestionKind, Place, Profile } from './database.types'

export type ExploreInput = Partial<Omit<ExplorePlace, 'id' | 'created_by' | 'created_at'>>

export async function listExplore() {
  return supabase.from('explore_places').select('*').order('created_at', { ascending: false })
}

/** Only the items the given user shared (for the "manage my places" page). */
export async function listMyExplore(userId: string) {
  return supabase.from('explore_places').select('*').eq('created_by', userId).order('created_at', { ascending: false })
}

// `routes`/`branches` are optional (added later) — strip on a "column does not exist" error.
const OPTIONAL = ['routes', 'branches', 'multi_branch', 'branch_label', 'menu_paths', 'photo_focus', 'photos', 'lat', 'lng']

/** Persist an Explore item's resolved coordinate. Silent if the lat/lng columns
 *  don't exist yet (explore_coords.sql not run). */
export async function setExploreCoords(id: string, lat: number, lng: number) {
  return supabase.from('explore_places').update({ lat, lng }).eq('id', id)
}

/** Push a resolved Explore coordinate onto EVERY already-saved copy (matched by
 *  source_explore_id), stamping it into map_url so it's immutable ground truth —
 *  so fixing the coordinate at the source updates existing trips too, not only
 *  future saves. RLS limits the write to copies in trips the user can edit. */
export async function propagateExploreCoord(exploreId: string, lat: number, lng: number) {
  // set the shared coordinate + lock it (pinned), but KEEP each copy's map_url so
  // navigation still follows the real link, not a bare coordinate
  let r = await supabase.from('places').update({ lat, lng, pinned: true }).eq('source_explore_id', exploreId)
  if (r.error && /pinned/.test(r.error.message)) r = await supabase.from('places').update({ lat, lng }).eq('source_explore_id', exploreId)
  return r
}

/** Lock a NEW coordinate for an Explore item across the WHOLE app — the shared
 *  `explore_places` source AND every saved copy in EVERY trip (all users), so
 *  one person fixing a pin corrects it for everyone. Uses a SECURITY-DEFINER
 *  RPC (supabase/lock_explore_coord.sql) to bypass per-trip RLS; when that
 *  function isn't there yet it degrades to what RLS allows from the client:
 *  update the source (owner only) + the caller's own copies. Idempotent. */
export async function lockExploreCoord(exploreId: string, lat: number, lng: number) {
  const rpc = await supabase.rpc('lock_explore_coord', { p_explore_id: exploreId, p_lat: lat, p_lng: lng })
  if (!rpc.error) return rpc
  // function/columns not migrated yet — best-effort within RLS
  await setExploreCoords(exploreId, lat, lng)
  return propagateExploreCoord(exploreId, lat, lng)
}

/** Resolve an Explore item's coordinate from its map_url ONCE and store it on
 *  the Explore row, so every trip that saves this item inherits the SAME pin
 *  (option B — kills per-trip geocoding drift). Full pipeline: in-URL coords →
 *  short-link resolve → geocode the canonical address (country/local-language
 *  aware). Fire-and-forget; a failure just leaves the coord null and copies fall
 *  back to per-trip resolution as before. */
export async function syncExploreCoord(id: string, mapUrl?: string | null, country?: string | null) {
  if (!mapUrl) return
  try {
    let c: { lat: number; lng: number } | null =
      latLngFromUrlExact(mapUrl) ?? (isMapLink(mapUrl) ? await resolveMapUrl(mapUrl, localLang(country)) : latLngFromUrl(mapUrl))
    if (c && 'pageDerived' in c && (c as { pageDerived?: boolean }).pageDerived) c = null
    if (!c) {
      // ?g_st=ic (address but no coordinate) — geocode the canonical address
      const g = await geocodeSmart({ name: resolvedLinkName(mapUrl), address: resolvedLinkAddress(mapUrl), country })
      if (g) c = { lat: g.lat, lng: g.lng }
    }
    if (c) {
      await setExploreCoords(id, c.lat, c.lng)
      // fixing the coordinate at the source must flow to trips that ALREADY
      // saved this item, not just future saves
      await propagateExploreCoord(id, c.lat, c.lng)
    }
  } catch { /* offline / resolver down — coord stays null */ }
}
function stripUnknown(payload: Record<string, unknown>, msg: string) {
  const copy = { ...payload }; let changed = false
  for (const k of OPTIONAL) if (k in copy && msg.includes(k)) { delete copy[k]; changed = true }
  return changed ? copy : null
}

// ---------- duplicate detection (เตือนตอนพิมพ์ + ด่านยืนยันตอนบันทึก) ----------

export interface ExploreDupe {
  id: string
  name: string | null
  city: string | null
  country: string | null
  /** cover + extra photos, so a new branch of a chain (ICHIRAN, HEYTEA …) can
   *  offer to reuse the photos the first branch already has */
  photo_url?: string | null
  photos?: string[] | null
}

const normName = (s: string) => s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '')
const words = (s: string) => s.toLowerCase().normalize('NFKC').split(/[^\p{L}\p{N}]+/u).filter(Boolean)

function bigrams(s: string): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2))
  return out
}
/** How alike two strings are, 0–1 (Dice coefficient over letter pairs). */
function overlap(a: string, b: string): number {
  const A = bigrams(a), B = bigrams(b)
  if (!A.size || !B.size) return a === b ? 1 : 0
  let hit = 0
  for (const g of A) if (B.has(g)) hit++
  return (2 * hit) / (A.size + B.size)
}
/** Two words meaning the same thing — "jenny"/"jennys", "cafe"/"cafes".
 *
 *  A plain letter-pair score is far too generous on short words: "sand" and
 *  "and" score exactly 0.8, so "Ginza Sand" matched "Glitch Coffee and
 *  Roasters GINZA". So the only cheap match allowed is a suffix of at most two
 *  letters on an otherwise identical word (plural/possessive); anything else
 *  has to be near the same length AND overlap almost completely. */
const sameWord = (a: string, b: string) => {
  if (a === b) return true
  if (a.length < 3 || b.length < 3) return false
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  if (long.startsWith(short) && long.length - short.length <= 2) return true
  return long.length - short.length <= 1 && overlap(a, b) >= 0.9
}

/** Filler words that never identify a place on their own. Dropped before
 *  matching so they can't stand in as a partner for a real word. */
const STOPWORDS = new Set(['and', 'the', 'of', 'at', 'in', 'on', 'de', 'la', 'le', 'el', 'no', 'ya'])
const keyWords = (s: string) => {
  const w = words(s)
  const strong = w.filter((x) => !STOPWORDS.has(x))
  return strong.length ? strong : w
}

/**
 * Do these two names look like the same place?
 *
 * Compared WORD BY WORD, not as one run of letters. Names that share a long
 * opening and differ only at the end — "Tokyo Disneyland" vs "Tokyo DisneySea",
 * "Universal Studios Singapore" vs "Universal Studios Japan" — overlap enough
 * to pass any whole-string threshold, yet the word they differ on is exactly
 * the one that identifies the place. So every word of the shorter name has to
 * find a partner in the longer one; a word left without a partner means a
 * different place.
 *
 * Still matched: one name contained in the other ("Ichiran" / "Ichiran
 * Shibuya", "Osaka Castle" / "Osaka Castle Park"), punctuation and spacing
 * differences ("Jenny's Bakery", "DinTaiFung"), and extra words on one side
 * ("Ichiran Hong Kong, Causeway Bay" / "Ichiran Causeway Bay").
 */
function similarName(a: string, b: string): boolean {
  const x = normName(a), y = normName(b)
  if (!x || !y) return false
  if (x === y || x.includes(y) || y.includes(x)) return true
  const wa = keyWords(a), wb = keyWords(b)
  if (!wa.length || !wb.length) return false
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa]
  return short.every((w) => long.some((u) => sameWord(w, u)))
}

/** Broad candidate fetch, ranked precisely client-side afterwards.
 *
 *  Matching on the longest word alone misses the same name written with
 *  different spacing — "HEYTEA" never finds "Hey Tea", because `ilike
 *  '%HEYTEA%'` needs the letters adjacent. So a single-word name is also
 *  looked up letter-by-letter with anything allowed between ("h%e%y%t%e%a"),
 *  which catches every spelling of it. Extra noise is harmless: similarName()
 *  throws it away. */
async function fetchSimilarCandidates(q: string): Promise<ExploreDupe[] | null> {
  if (q.length < 3) return null
  const token = (q.split(/\s+/).sort((a, b) => b.length - a.length)[0] ?? q).replace(/[%_,()]/g, '')
  if (token.length < 2) return null
  const flat = normName(q) // letters/digits only — safe to use in a pattern
  const patterns = [`%${token}%`]
  if (flat.length >= 4 && flat.length <= 24) patterns.push(`%${flat.split('').join('%')}%`)

  const results = await Promise.all(patterns.map((p) => supabase.from('explore_places')
    .select('id,name,city,country,photo_url,photos')
    .ilike('name', p)
    .limit(20)))
  const rows = new Map<string, ExploreDupe>()
  for (const r of results) for (const d of ((r.data ?? []) as ExploreDupe[])) rows.set(d.id, d)
  return [...rows.values()]
}

/** Photos already on file for the SAME place under another name/branch —
 *  offered when adding a new branch of a chain (ICHIRAN, HEYTEA …).
 *
 *  Unlike the duplicate warning this ignores the country: a chain's branches
 *  live in different countries by definition, and the shopfront photo is just
 *  as good for the Tokyo branch as the Shenzhen one. */
export async function findChainPhotos(name: string, excludeId?: string | null): Promise<{ url: string; from: string }[]> {
  const q = name.trim()
  const data = await fetchSimilarCandidates(q)
  if (!data) return []
  const seen = new Set<string>()
  const out: { url: string; from: string }[] = []
  for (const d of data) {
    if (d.id === excludeId || !similarName(d.name ?? '', q)) continue
    for (const url of [d.photo_url, ...(d.photos ?? [])]) {
      if (!url || seen.has(url)) continue
      seen.add(url)
      out.push({ url, from: d.name ?? 'สาขาก่อนหน้า' })
    }
  }
  return out.slice(0, 8)
}

/** Places in the shared pool (any user's) with a name similar to `name`,
 *  excluding the row being edited. Used live while typing AND as the final
 *  confirm gate on save.
 *
 *  `country` (the one being added) rules out matches in a DIFFERENT country.
 *  Name similarity alone can't tell "Universal Studios Singapore" from
 *  "Universal Studios Japan" — they share a long prefix and score 0.727
 *  against a 0.72 threshold, while the genuinely-related "Universal Studios
 *  Osaka" scores 0.714 and doesn't. Two places on different continents are
 *  never the same place, whatever their names look like. A candidate with no
 *  country recorded still warns, so real duplicates aren't lost. */
export async function searchExploreSimilar(name: string, excludeId?: string | null, country?: string | null): Promise<ExploreDupe[]> {
  const q = name.trim()
  const data = await fetchSimilarCandidates(q)
  if (!data) return []
  const mine = canonicalCountry(country)
  const elsewhere = (d: ExploreDupe) => {
    const theirs = canonicalCountry(d.country)
    return !!mine && !!theirs && mine !== theirs
  }
  return ((data ?? []) as ExploreDupe[])
    .filter((d) => d.id !== excludeId && !elsewhere(d) && similarName(d.name ?? '', q))
    .slice(0, 4)
}

export async function addExplore(created_by: string, input: ExploreInput) {
  const payload: Record<string, unknown> = { id: crypto.randomUUID(), created_by, ...input }
  let res = await supabase.from('explore_places').insert(payload)
  if (res.error) { const s = stripUnknown(payload, res.error.message); if (s) res = await supabase.from('explore_places').insert(s) }
  // resolve the ONE shared coordinate for this item (so every saved copy matches)
  if (!res.error && typeof input.map_url === 'string' && input.map_url) {
    void syncExploreCoord(payload.id as string, input.map_url, (input.country as string) ?? null)
  }
  return res
}

export async function updateExplore(id: string, input: ExploreInput) {
  const payload: Record<string, unknown> = { ...input }
  let res = await supabase.from('explore_places').update(payload).eq('id', id)
  if (res.error) { const s = stripUnknown(payload, res.error.message); if (s) res = await supabase.from('explore_places').update(s).eq('id', id) }
  // link changed → re-resolve the shared coordinate
  if (!res.error && typeof input.map_url === 'string' && input.map_url) {
    void syncExploreCoord(id, input.map_url, (input.country as string) ?? null)
  }
  return res
}

// ── Community suggestions / reports (supabase/explore_suggestions.sql) ──────
// Non-owners propose an added route/branch, a general edit, or a report; the
// owner reviews and either accepts (merged into the item) or dismisses.

export async function addSuggestion(input: {
  exploreId: string; userId: string; authorName: string; authorColor?: string | null
  authorPhoto?: string | null; authorFocus?: string | null
  kind: SuggestionKind; payload?: Record<string, unknown> | null; note?: string | null
}) {
  const row: Record<string, unknown> = {
    id: crypto.randomUUID(), explore_id: input.exploreId, user_id: input.userId,
    author_name: input.authorName, author_color: input.authorColor ?? null,
    author_photo: input.authorPhoto ?? null, author_focus: input.authorFocus ?? null,
    kind: input.kind, payload: input.payload ?? null, note: input.note ?? null, status: 'pending',
  }
  let res = await supabase.from('explore_suggestions').insert(row)
  // author_photo/author_focus are optional (supabase/avatars.sql) — retry without
  if (res.error && (res.error.message.includes('author_photo') || res.error.message.includes('author_focus'))) {
    const { author_photo, author_focus, ...rest } = row // eslint-disable-line @typescript-eslint/no-unused-vars
    res = await supabase.from('explore_suggestions').insert(rest)
  }
  return res
}

/** Pending suggestions on one item (owner-only under RLS). Missing table → []. */
export async function listSuggestions(exploreId: string): Promise<ExploreSuggestion[]> {
  const { data, error } = await supabase.from('explore_suggestions')
    .select('*').eq('explore_id', exploreId).eq('status', 'pending').order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []) as ExploreSuggestion[]
}

export async function resolveSuggestion(id: string, status: 'accepted' | 'dismissed') {
  return supabase.from('explore_suggestions').update({ status, resolved_at: new Date().toISOString() }).eq('id', id)
}

/** Turn an accepted suggestion into the fields to merge into its item. Returns
 *  null when there's nothing to apply (a report, or an empty edit). */
export function suggestionToInput(e: ExplorePlace, s: ExploreSuggestion): ExploreInput | null {
  const p = (s.payload ?? {}) as Record<string, string | null | undefined>
  if (s.kind === 'route') {
    return { routes: [...(e.routes ?? []), { line: p.line ?? null, color: p.color ?? null, station: p.station ?? null, mode: p.mode ?? undefined }] }
  }
  if (s.kind === 'branch') {
    return {
      branches: [...(e.branches ?? []), { label: p.label ?? null, map_url: p.map_url ?? null, line: p.line ?? null, color: p.color ?? null, station: p.station ?? null }],
      multi_branch: true,
    }
  }
  if (s.kind === 'edit') {
    const out: ExploreInput = {}
    if (p.name) out.name = p.name
    if (p.note != null && p.note !== '') out.note = p.note
    if (p.photo_url) out.photo_url = p.photo_url
    return Object.keys(out).length ? out : null
  }
  return null // 'report' has nothing to merge
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
  authorPhoto?: string | null, authorFocus?: string | null,
) {
  const payload: Record<string, unknown> = {
    id: crypto.randomUUID(), explore_id: exploreId, user_id: userId,
    author_name: authorName, author_color: authorColor ?? null, body, parent_id: parentId ?? null,
    author_photo: authorPhoto ?? null, author_focus: authorFocus ?? null,
  }
  let res = await supabase.from('explore_comments').insert(payload)
  // parent_id (explore.sql) + author_photo/author_focus (avatars.sql) are added
  // later — strip whichever the schema reports as missing, then retry.
  if (res.error) {
    const copy = { ...payload }; const msg = res.error.message; let changed = false
    if (msg.includes('parent_id')) { delete copy.parent_id; changed = true }
    if (msg.includes('author_photo') || msg.includes('author_focus')) { delete copy.author_photo; delete copy.author_focus; changed = true }
    if (changed) res = await supabase.from('explore_comments').insert(copy)
  }
  return res
}

export async function deleteComment(id: string) {
  return supabase.from('explore_comments').delete().eq('id', id)
}

// ---- Votes (recommend / not recommend) ------------------------------------
//
// `explore_votes` is no longer something people click. Stars replaced it: the
// 1–5 rating in src/lib/exploreReviews.ts mirrors itself onto this table (4–5★
// = recommend, 1–2★ = not, 3★ = no opinion), so the POPULAR ranking below and
// the owner's like notifications keep working off one action instead of two.
//
// The star average shown across the app now comes from `explore_ratings` and
// ONLY from there. It used to be computed here as `up / (up + down) × 5`,
// which handed a place with 3 likes and 0 dislikes a perfect 5.0 without a
// single person ever giving it a star.

// ---- Notifications (likes / comments on MY explore items) -----------------

export interface ExploreNotif {
  id: string
  kind: 'like' | 'comment' | 'suggestion'
  exploreId: string
  placeName: string
  who: string
  whoColor?: string | null
  body?: string
  /** for suggestion notifs — which kind of suggestion (route/branch/edit/report) */
  sugKind?: SuggestionKind
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

  const [cRes, vRes, sRes] = await Promise.all([
    supabase.from('explore_comments')
      .select('id,explore_id,user_id,author_name,author_color,body,created_at')
      .in('explore_id', ids).neq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('explore_votes')
      .select('explore_id,user_id,created_at')
      .in('explore_id', ids).eq('vote', 1).neq('user_id', userId),
    // pending suggestions on my items — tolerate a missing table (migration not run)
    supabase.from('explore_suggestions')
      .select('id,explore_id,author_name,author_color,kind,note,created_at')
      .in('explore_id', ids).eq('status', 'pending').order('created_at', { ascending: false }),
  ])
  const comments = cRes.data ?? []
  const votes = vRes.data ?? []
  const suggestions = sRes.error ? [] : (sRes.data ?? [])

  // A star rating mirrors itself onto explore_votes, so an anonymous review
  // would otherwise reach the owner's bell with the reviewer's real profile
  // name attached — the one person they most likely wanted to stay hidden
  // from. Collect those pairs and show them nameless.
  const anon = new Set<string>()
  {
    const { data, error } = await supabase.from('explore_ratings')
      .select('explore_id,user_id').in('explore_id', ids).eq('anonymous', true)
    if (!error) for (const r of data ?? []) anon.add(`${r.explore_id}:${r.user_id}`)
  }

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
  for (const s of suggestions) {
    out.push({
      id: `s:${s.id}`, kind: 'suggestion', exploreId: s.explore_id as string,
      placeName: nameById.get(s.explore_id as string) ?? '', who: (s.author_name as string) || 'ใครบางคน',
      whoColor: s.author_color as string | null, body: (s.note as string) || undefined,
      sugKind: s.kind as SuggestionKind, at: s.created_at as string,
    })
  }
  for (const v of votes) {
    const hidden = anon.has(`${v.explore_id}:${v.user_id}`)
    const p = !hidden && v.user_id ? profById.get(v.user_id as string) : undefined
    out.push({
      id: `v:${v.explore_id}:${v.user_id}`, kind: 'like', exploreId: v.explore_id as string,
      placeName: nameById.get(v.explore_id as string) ?? '',
      who: hidden ? 'ไม่ระบุตัวตน' : (p?.nickname || p?.full_name || 'ใครบางคน'),
      whoColor: hidden ? null : p?.avatar_color ?? null,
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

const httpOnly = (refs?: string[] | null) => (refs ?? []).filter((r) => /^https?:\/\//.test(r))

/** Inverse of exploreAsPlace: shape a user's own trip Place as an Explore
 *  submission. Only PUBLIC (http) photo refs carry over — private trip-file
 *  paths can't be shown in the shared pool, so they're dropped. `country`
 *  comes from the trip (Place doesn't store it). */
export function placeAsExploreInput(p: Place, country?: string | null): ExploreInput {
  const cover = p.photo_url || (p.photo_path && /^https?:\/\//.test(p.photo_path) ? p.photo_path : null)
  const menu = httpOnly(p.menu_paths)
  const morePhotos = httpOnly(p.photos)
  return {
    group_type: p.group_type, category: p.category, name: p.name,
    city: p.city ?? null, country: country ?? null,
    station_line: p.station_line, station_color: p.station_color, station_name: p.station_name,
    routes: p.routes ?? null, branches: p.branches ?? null, multi_branch: p.multi_branch ?? null,
    branch_label: p.branch_label ?? null,
    menu_paths: menu.length ? menu : null,
    map_url: p.map_url, note: p.note,
    photo_url: cover, photo_focus: cover ? (p.photo_focus ?? null) : null,
    photos: morePhotos.length ? morePhotos : null,
  }
}

/** Shape an Explore pool item as a Place so it can be copied into a trip. */
export function exploreAsPlace(e: ExplorePlace): Place {
  return {
    id: e.id, trip_id: '', group_type: e.group_type, category: e.category, name: e.name,
    station_line: e.station_line, station_color: e.station_color, station_name: e.station_name,
    routes: e.routes ?? null, branches: e.branches ?? null, multi_branch: e.multi_branch ?? null,
    branch_label: e.branch_label ?? null,
    menu_paths: e.menu_paths ?? null,
    map_url: e.map_url, note: e.note, in_plan: false, photo_path: null, photo_url: e.photo_url,
    photo_focus: e.photo_focus ?? null, photos: e.photos ?? null,
    // carry the Explore item's single shared coordinate so the copy inherits it
    // instead of independently re-geocoding (the source of cross-trip drift)
    lat: e.lat ?? null, lng: e.lng ?? null,
    city: e.city, country: e.country ?? null, created_at: e.created_at,
  }
}
