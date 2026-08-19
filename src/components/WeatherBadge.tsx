import { IconSun, IconCloud, IconCloudFog, IconCloudRain, IconCloudSnow, IconCloudStorm } from '@tabler/icons-react'
import { weatherLabel, type DayWeather } from '@/lib/weather'

/** WMO weather code → Tabler icon (matches the rest of the app's iconography). */
function WxIcon({ code, size }: { code: number; size: number }) {
  const p = { size, stroke: 1.8 }
  if (code === 0) return <IconSun {...p} />
  if (code <= 3) return <IconCloud {...p} />
  if (code <= 48) return <IconCloudFog {...p} />
  if (code <= 67) return <IconCloudRain {...p} />
  if (code <= 77) return <IconCloudSnow {...p} />
  if (code <= 82) return <IconCloudRain {...p} />
  if (code <= 86) return <IconCloudSnow {...p} />
  return <IconCloudStorm {...p} />
}

/** Compact weather chip: icon + high/low. Inherits text colour. `~` = climate avg. */
export function WeatherBadge({ wx, showMin = true, size = 14, className }: {
  wx: DayWeather | null | undefined
  showMin?: boolean
  size?: number
  className?: string
}) {
  if (!wx || wx.tMax == null) return null
  return (
    <span title={wx.climate ? `~${wx.tMax}° เฉลี่ยภูมิอากาศ (พยากรณ์ยังไม่ถึง)` : weatherLabel(wx.code)}
      className={`inline-flex items-center gap-1 tabular-nums whitespace-nowrap ${className ?? ''}`}>
      <WxIcon code={wx.code} size={size} />
      <span>{wx.climate ? '~' : ''}{wx.tMax}°{showMin && wx.tMin != null && <span className="opacity-60">/{wx.tMin}°</span>}</span>
    </span>
  )
}
