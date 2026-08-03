// Admin-curated country pages — reads for everyone, writes for admins.
//
// The tables arrive with supabase/admin_pages.sql. Everything here degrades to
// "no curated page" when they don't exist yet, so the app runs unchanged before
// the migration is applied.
import { supabase } from './supabase'
import type { CountryBlock, CountryPage } from './database.types'

/** A block plus the ids of the places the admin put in it, in their order. */
export interface BlockWithPlaces extends CountryBlock {
  placeIds: string[]
}

export interface CuratedPage {
  page: CountryPage
  blocks: BlockWithPlaces[]
}

/** A missing table (or a database still on the old schema) is not an error —
 *  the caller just gets "nothing curated" and falls back. */
function missing(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  return err.code === '42P01' || /does not exist/i.test(err.message ?? '')
}

/** The curated page for one country, or null when there isn't one.
 *  RLS hides unpublished pages from everyone but admins, so this returns a
 *  draft to its author and nothing to everyone else — no flag to check here. */
export async function loadCuratedPage(country: string): Promise<CuratedPage | null> {
  if (!country) return null
  const pageRes = await supabase.from('country_pages').select('*').eq('country', country).maybeSingle()
  if (missing(pageRes.error) || !pageRes.data) return null
  const page = pageRes.data as CountryPage

  const blocksRes = await supabase.from('country_blocks').select('*')
    .eq('country', country).order('position')
  const blocks = (blocksRes.data ?? []) as CountryBlock[]
  if (!blocks.length) return { page, blocks: [] }

  const linkRes = await supabase.from('country_block_places').select('*')
    .in('block_id', blocks.map((b) => b.id)).order('position')
  const byBlock = new Map<string, string[]>()
  for (const r of linkRes.data ?? []) {
    const id = (r as { block_id: string }).block_id
    const arr = byBlock.get(id)
    if (arr) arr.push((r as { explore_id: string }).explore_id)
    else byBlock.set(id, [(r as { explore_id: string }).explore_id])
  }

  return { page, blocks: blocks.map((b) => ({ ...b, placeIds: byBlock.get(b.id) ?? [] })) }
}

/** Every curated page, for the admin's country list. Returns [] pre-migration. */
export async function listCuratedPages(): Promise<CountryPage[]> {
  const res = await supabase.from('country_pages').select('*').order('country')
  if (missing(res.error)) return []
  return (res.data ?? []) as CountryPage[]
}

// ── writes (admin only — RLS enforces it, the UI just hides the buttons) ─────

export async function upsertCountryPage(page: Partial<CountryPage> & { country: string }) {
  return supabase.from('country_pages')
    .upsert({ ...page, updated_at: new Date().toISOString() }, { onConflict: 'country' })
}

export async function deleteCountryPage(country: string) {
  return supabase.from('country_pages').delete().eq('country', country)
}

export async function addBlock(country: string, position: number) {
  const row = { id: crypto.randomUUID(), country, position, title: '', action: 'list' }
  const res = await supabase.from('country_blocks').insert(row).select().maybeSingle()
  return { data: (res.data as CountryBlock) ?? null, error: res.error }
}

export async function updateBlock(id: string, fields: Partial<CountryBlock>) {
  return supabase.from('country_blocks').update(fields).eq('id', id)
}

export async function deleteBlock(id: string) {
  return supabase.from('country_blocks').delete().eq('id', id)
}

/** Persist a new block order — one update per row, which is fine for a handful. */
export async function reorderBlocks(ids: string[]) {
  for (let i = 0; i < ids.length; i++) {
    await supabase.from('country_blocks').update({ position: i }).eq('id', ids[i])
  }
}

/** Replace a block's places wholesale — simplest thing that stays consistent
 *  whether the admin added, removed or reordered. */
export async function setBlockPlaces(blockId: string, exploreIds: string[]) {
  const del = await supabase.from('country_block_places').delete().eq('block_id', blockId)
  if (del.error) return del
  if (!exploreIds.length) return del
  return supabase.from('country_block_places').insert(
    exploreIds.map((explore_id, position) => ({ block_id: blockId, explore_id, position })),
  )
}
