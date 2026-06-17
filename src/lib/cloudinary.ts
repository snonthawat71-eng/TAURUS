// Optional Cloudinary image hosting. When VITE_CLOUDINARY_CLOUD_NAME and
// VITE_CLOUDINARY_UPLOAD_PRESET are set, photo uploads go to Cloudinary (CDN +
// auto-optimization) instead of Supabase Storage. Uses an *unsigned* upload
// preset so the browser can upload directly with no server.
const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined

export const isCloudinaryConfigured = !!(CLOUD && PRESET)

/**
 * Make a Cloudinary delivery URL load fast: insert auto format + auto quality
 * (and an optional max width) right after `/image/upload/`. Non-Cloudinary URLs
 * (and already-transformed ones) are returned unchanged. This serves a small,
 * modern-format image instead of the multi-MB original.
 */
export function optimizeImageUrl(url: string | null | undefined, width?: number): string | null {
  if (!url) return null
  const marker = '/image/upload/'
  const i = url.indexOf(marker)
  if (i < 0) return url
  const rest = url.slice(i + marker.length)
  const firstSeg = rest.split('/')[0]
  if (/(^|,)(f_|q_|w_|c_)/.test(firstSeg)) return url // already has a transformation
  const t = ['f_auto', 'q_auto', ...(width ? [`w_${width}`, 'c_limit'] : [])].join(',')
  return url.slice(0, i + marker.length) + t + '/' + rest
}

export async function uploadToCloudinary(file: File, folder = 'taurus'): Promise<{ url: string | null; error: string | null }> {
  if (!isCloudinaryConfigured) return { url: null, error: 'cloudinary not configured' }
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', PRESET!)
  fd.append('folder', folder)
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/auto/upload`, { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) return { url: null, error: data?.error?.message ?? 'อัปโหลดไป Cloudinary ไม่สำเร็จ' }
    return { url: data.secure_url as string, error: null }
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : 'อัปโหลดไป Cloudinary ไม่สำเร็จ' }
  }
}
