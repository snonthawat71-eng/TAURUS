import { supabase } from './supabase'
import { isCloudinaryConfigured, uploadToCloudinary } from './cloudinary'
import { toast } from './toast'
import type { TravelerFileKind } from './database.types'

const BUCKET = 'trip-files'
const SIGNED_TTL = 600 // ~10 minutes, per spec

/** Sample seed files have a recognizable path and no real object behind them. */
export function isSampleFile(storagePath: string | null | undefined): boolean {
  return !!storagePath && storagePath.startsWith('sample/')
}

/** Create a short-lived signed URL to view a private file. */
export async function getSignedUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_TTL)
  if (error) return null
  return data.signedUrl
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

/** Upload an image for the public Explore pool and return a permanent URL
 *  (Cloudinary CDN if configured, else the Supabase public bucket). */
export async function uploadPublicImage(file: File): Promise<{ url: string | null; error: string | null }> {
  if (isCloudinaryConfigured) {
    const res = await uploadToCloudinary(file, 'taurus/explore')
    if (res.error) toast.error(`อัปโหลดรูปไม่สำเร็จ: ${res.error}`)
    return res
  }
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `explore/${crypto.randomUUID()}.${ext}`
  const up = await supabase.storage.from('explore-photos').upload(path, file, { upsert: false })
  if (up.error) { toast.error(`อัปโหลดรูปไม่สำเร็จ: ${up.error.message}`); return { url: null, error: up.error.message } }
  const { data } = supabase.storage.from('explore-photos').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

/** Attach a booking file to a flight or hotel (single storage_path column). */
export async function uploadEntityFile(opts: {
  table: 'flights' | 'hotels'
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
export async function removeEntityFile(table: 'flights' | 'hotels', id: string, path: string) {
  if (!isSampleFile(path)) await supabase.storage.from(BUCKET).remove([path])
  return supabase.from(table).update({ storage_path: null }).eq('id', id)
}
