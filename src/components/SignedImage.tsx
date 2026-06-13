import { useEffect, useState, type ReactNode } from 'react'
import { getSignedUrl, isSampleFile } from '@/lib/files'

/**
 * Renders an image. Priority: external `url` → private `path` (signed) → `fallback`.
 * `url` is used directly (e.g. Explore pool photos); `path` is a private bucket
 * object served via a short-lived signed URL.
 */
export function SignedImage({ url, path, alt, className, fallback }: {
  url?: string | null
  path?: string | null
  alt?: string
  className?: string
  fallback?: ReactNode
}) {
  const [signed, setSigned] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    setSigned(null)
    if (!url && path && !isSampleFile(path)) getSignedUrl(path).then((u) => active && setSigned(u))
    return () => { active = false }
  }, [url, path])

  const src = url || signed
  if (!src) return <>{fallback ?? null}</>
  return <img src={src} alt={alt ?? ''} className={className} />
}
