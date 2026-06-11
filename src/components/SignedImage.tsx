import { useEffect, useState, type ReactNode } from 'react'
import { getSignedUrl, isSampleFile } from '@/lib/files'

/** Renders a private image via a short-lived signed URL; shows `fallback` until/if unavailable. */
export function SignedImage({ path, alt, className, fallback }: {
  path: string | null | undefined
  alt?: string
  className?: string
  fallback?: ReactNode
}) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    setUrl(null)
    if (path && !isSampleFile(path)) getSignedUrl(path).then((u) => active && setUrl(u))
    return () => { active = false }
  }, [path])

  if (!url) return <>{fallback ?? null}</>
  return <img src={url} alt={alt ?? ''} className={className} />
}
