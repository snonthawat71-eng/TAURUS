import { supabase } from './supabase'
import { isCloudinaryConfigured, uploadToCloudinary, optimizeImageUrl } from './cloudinary'
import { toast } from './toast'
import type { TravelerFileKind } from './database.types'

const BUCKET = 'trip-files'
const SIGNED_TTL = 600 // ~10 minutes, per spec

/** Sample seed files have a recognizable path and no real object behind them. */
export function isSampleFile(storagePath: string | null | undefined): boolean {
  return !!storagePath && storagePath.startsWith('sample/')
}

// Cache signed URLs in-memory so re-renders / remounts don't re-request one
// every time (each call is a network round-trip). Cached until ~1 min before TTL.
const signedCache = new Map<string, { url: string; exp: number }>()

// Offline fallback: remember the LAST signed URL per path. The token in it may
// be expired, but the service worker caches image bytes with ignoreSearch, so a
// previously-viewed photo/QR still renders from cache with no network at all.
const SIGNED_LS = 'taurus:signed:'
const lastSigned = (path: string): string | null => {
  try { return localStorage.getItem(SIGNED_LS + path) } catch { return null }
}

/** Create a short-lived signed URL to view a private file (cached per session). */
export async function getSignedUrl(storagePath: string): Promise<string | null> {
  const hit = signedCache.get(storagePath)
  if (hit && hit.exp > Date.now()) return hit.url
  if (!navigator.onLine) return lastSigned(storagePath)
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_TTL)
    if (error || !data) return lastSigned(storagePath)
    signedCache.set(storagePath, { url: data.signedUrl, exp: Date.now() + (SIGNED_TTL - 60) * 1000 })
    try { localStorage.setItem(SIGNED_LS + storagePath, data.signedUrl) } catch { /* quota — offline fallback only */ }
    return data.signedUrl
  } catch {
    // Network/throw — callers render a placeholder when this returns null.
    return lastSigned(storagePath)
  }
}

/** Resolve a photo (external `url` or private `path`) to a viewable full-size
 *  URL — for opening it in a lightbox. Cloudinary URLs get a larger width. */
export async function photoFullUrl(url: string | null | undefined, path: string | null | undefined, width = 1600): Promise<string | null> {
  if (url) return optimizeImageUrl(url, width) ?? url
  if (!path) return null
  if (/^https?:\/\//.test(path)) return optimizeImageUrl(path, width) ?? path
  if (isSampleFile(path)) return null
  return getSignedUrl(path)
}

/** Upload a secret file into the trip's private folder and record it. */
export async function uploadTravelerFile(opts: {
  tripId: string
  travelerId: string
  kind: TravelerFileKind
  label: string
  file: File
}): Promise<{ error: string | null }> {
  const ext = opts.file.name.split('.').pop() ?? 'bin'
  const safe = crypto.randomUUID()
  // Path MUST start with {trip_id}/ — storage RLS checks foldername[1]
  const path = `${opts.tripId}/${opts.travelerId}-${safe}.${ext}`

  const up = await supabase.storage.from(BUCKET).upload(path, opts.file, { upsert: false })
  if (up.error) { toast.error(`อัปโหลดไม่สำเร็จ: ${up.error.message}`); return { error: up.error.message } }

  const ins = await supabase.from('traveler_files').insert({
    traveler_id: opts.travelerId,
    trip_id: opts.tripId,
    kind: opts.kind,
    label: opts.label,
    storage_path: path,
  })
  if (ins.error) toast.error(`บันทึกไฟล์ไม่สำเร็จ: ${ins.error.message}`)
  else toast.success('อัปโหลดไฟล์แล้ว')
  return { error: ins.error?.message ?? null }
}

/** Upload an image and return a reference the caller stores (in a photo/path
 *  column). With Cloudinary configured this is a public CDN URL; otherwise a
 *  Supabase storage path. SignedImage renders either transparently. */
export async function uploadImage(tripId: string, prefix: string, file: File): Promise<{ path: string | null; error: string | null }> {
  if (isCloudinaryConfigured) {
    const { url, error } = await uploadToCloudinary(file, `taurus/${prefix}`)
    if (error) toast.error(`อัปโหลดรูปไม่สำเร็จ: ${error}`)
    return { path: url, error }
  }
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${tripId}/${prefix}-${crypto.randomUUID()}.${ext}`
  const up = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
  if (up.error) { toast.error(`อัปโหลดรูปไม่สำเร็จ: ${up.error.message}`); return { path: null, error: up.error.message } }
  return { path, error: null }
}

/** Where a public image lands. Each kind gets its own folder on Cloudinary and
 *  its own prefix in the Supabase bucket, so the shared Explore photos and the
 *  photos people attach to a review never end up in the same pile.
 *
 *  Adding a kind here is all it takes — Cloudinary creates folders on upload,
 *  and the Supabase bucket needs no policy change (the prefix is just a path). */
export const PUBLIC_IMAGE_FOLDERS = {
  /** a place's own photos in the shared Explore pool */
  explore: { cloudinary: 'taurus/explore', bucket: 'explore' },
  /** photos somebody attached to their review of a place */
  review: { cloudinary: 'taurus/explore-reviews', bucket: 'explore-reviews' },
} as const

export type PublicImageKind = keyof typeof PUBLIC_IMAGE_FOLDERS

/** Upload a publicly-readable image and return a permanent URL (Cloudinary CDN
 *  if configured, else the Supabase public bucket). */
export async function uploadPublicImage(
  file: File, kind: PublicImageKind = 'explore',
): Promise<{ url: string | null; error: string | null }> {
  const dest = PUBLIC_IMAGE_FOLDERS[kind]
  if (isCloudinaryConfigured) {
    const res = await uploadToCloudinary(file, dest.cloudinary)
    if (res.error) toast.error(`อัปโหลดรูปไม่สำเร็จ: ${res.error}`)
    return res
  }
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${dest.bucket}/${crypto.randomUUID()}.${ext}`
  const up = await supabase.storage.from('explore-photos').upload(path, file, { upsert: false })
  if (up.error) { toast.error(`อัปโหลดรูปไม่สำเร็จ: ${up.error.message}`); return { url: null, error: up.error.message } }
  const { data } = supabase.storage.from('explore-photos').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

/** Attach a booking file to a flight or hotel (single storage_path column). */
export async function uploadEntityFile(opts: {
  table: 'flights' | 'hotels' | 'trains'
  id: string
  tripId: string
  file: File
}): Promise<{ error: string | null }> {
  const ext = opts.file.name.split('.').pop() ?? 'bin'
  const path = `${opts.tripId}/${opts.table}-${opts.id}-${crypto.randomUUID()}.${ext}`
  const up = await supabase.storage.from(BUCKET).upload(path, opts.file, { upsert: false })
  if (up.error) { toast.error(`อัปโหลดไม่สำเร็จ: ${up.error.message}`); return { error: up.error.message } }
  const upd = await supabase.from(opts.table).update({ storage_path: path }).eq('id', opts.id)
  if (upd.error) toast.error(`บันทึกไฟล์ไม่สำเร็จ: ${upd.error.message}`)
  else toast.success('แนบไฟล์แล้ว')
  return { error: upd.error?.message ?? null }
}

/** Remove a booking file from a flight or hotel. */
export async function removeEntityFile(table: 'flights' | 'hotels' | 'trains', id: string, path: string) {
  if (!isSampleFile(path)) await supabase.storage.from(BUCKET).remove([path])
  return supabase.from(table).update({ storage_path: null }).eq('id', id)
}
