import { weatherIcon, weatherLabel, type DayWeather } from '@/lib/weather'

/** Compact weather chip: emoji + high/low. Inherits text colour so it works on
 *  dark cards and light rows alike. `~` marks a climate average. */
export function WeatherBadge({ wx, showMin = true, className }: {
  wx: DayWeather | null | undefined
  showMin?: boolean
  className?: string
}) {
  if (!wx || wx.tMax == null) return null
  return (
    <span title={wx.climate ? `~${wx.tMax}° เฉลี่ยภูมิอากาศ (พยากรณ์ยังไม่ถึง)` : weatherLabel(wx.code)}
      className={`inline-flex items-center gap-1 tabular-nums whitespace-nowrap ${className ?? ''}`}>
      <span className="not-italic leading-none">{weatherIcon(wx.code)}</span>
      <span>{wx.climate ? '~' : ''}{wx.tMax}°{showMin && wx.tMin != null && <span className="opacity-60">/{wx.tMin}°</span>}</span>
    </span>
  )
}
