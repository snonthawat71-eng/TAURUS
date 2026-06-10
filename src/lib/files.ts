import { supabase } from './supabase'
import type { TravelerFileKind } from './database.types'

const BUCKET = 'trip-files'
const SIGNED_TTL = 600 // ~10 minutes, per spec

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
  if (up.error) return { error: up.error.message }

  const ins = await supabase.from('traveler_files').insert({
    traveler_id: opts.travelerId,
    trip_id: opts.tripId,
    kind: opts.kind,
    label: opts.label,
    storage_path: path,
  })
  return { error: ins.error?.message ?? null }
}
