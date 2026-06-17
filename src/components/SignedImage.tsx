import { useEffect, useState, type ReactNode } from 'react'
import { getSignedUrl, isSampleFile } from '@/lib/files'
import { optimizeImageUrl } from '@/lib/cloudinary'

/**
 * Renders an image. Priority: external `url` → private `path` (signed) → `fallback`.
 * `url` is used directly (e.g. Explore pool photos); `path` is a private bucket
 * object served via a short-lived signed URL. Cloudinary URLs are auto-optimized
 * (format/quality, and `width` if given) so big originals don't load slowly.
 */
export function SignedImage({ url, path, alt, className, fallback, width }: {
  url?: string | null
  path?: string | null
  alt?: string
  className?: string
  fallback?: ReactNode
  width?: number
}) {
  const [signed, setSigned] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  // a "path" that's already a full URL (e.g. Cloudinary) is used as-is
  const isHttp = !!path && /^https?:\/\//.test(path)
  useEffect(() => {
    let active = true
    setSigned(null)
    setFailed(false)
    if (!url && path && !isHttp && !isSampleFile(path)) getSignedUrl(path).then((u) => active && setSigned(u))
    return () => { active = false }
  }, [url, path, isHttp])

  const raw = url || (isHttp ? path : signed)
  const src = optimizeImageUrl(raw, width)
  // no source, or the image failed to load → show the graceful fallback instead
  // of the browser's broken-image glyph
  if (!src || failed) return <>{fallback ?? null}</>
  return <img src={src} alt={alt ?? ''} className={className} loading="lazy" decoding="async" onError={() => setFailed(true)} />
}
