import { useEffect, useState } from 'react'
import { IconBuildingSkyscraper } from '@tabler/icons-react'
import { getSignedUrl, isSampleFile } from '@/lib/files'
import { optimizeImageUrl } from '@/lib/cloudinary'

function gradientFor(name: string | null) {
  let h = 0
  for (const c of name ?? 'hotel') h = (h * 31 + c.charCodeAt(0)) >>> 0
  const hue = h % 360
  return `linear-gradient(135deg, hsl(${hue} 45% 58%), hsl(${(hue + 40) % 360} 45% 42%))`
}

export function HotelPhoto({ photoPath, name, size = 56, radius = 10, fill = false, className }: {
  photoPath: string | null | undefined
  name: string | null
  size?: number
  radius?: number
  /** Stretch to fill the parent (size controls only the fetched resolution). */
  fill?: boolean
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setUrl(null)
    if (!photoPath || isSampleFile(photoPath)) return
    // Cloudinary (or any public) URLs are used as-is; only private storage paths
    // need a short-lived signed URL.
    if (/^https?:\/\//.test(photoPath)) {
      setUrl(optimizeImageUrl(photoPath, size * 2) ?? photoPath)
    } else {
      getSignedUrl(photoPath).then((u) => active && setUrl(u))
    }
    return () => { active = false }
  }, [photoPath, size])

  return (
    <div className={`overflow-hidden grid place-items-center text-white/90 ${fill ? '' : 'shrink-0'} ${className ?? ''}`}
      style={{
        ...(fill ? {} : { width: size, height: size, borderRadius: radius }),
        background: gradientFor(name),
      }}>
      {url ? (
        <img src={url} alt={name ?? ''} className="w-full h-full object-cover" />
      ) : (
        <IconBuildingSkyscraper size={fill ? 30 : size * 0.4} stroke={1.6} />
      )}
    </div>
  )
}
