import { useEffect, useState } from 'react'

// Weather via Open-Meteo (free, no API key). We only have a city name, so we
// geocode it, then fetch a daily forecast (≤16 days) and fall back to a climate
// average (mean of the same calendar dates over the last 3 years) for dates the
// forecast can't reach. Everything is cached in localStorage (per day).

export interface DayWeather {
  date: string        // YYYY-MM-DD
  tMax: number | null
  tMin: number | null
  code: number        // WMO weather code
  climate: boolean    // true = climate average (forecast didn't reach this date)
}

const PREFIX = 'wx:'
const todayStr = () => new Date().toISOString().slice(0, 10)
const shiftDays = (d: string, n: number) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
const shiftYear = (d: string, n: number) => { const [y, m, day] = d.split('-'); return `${Number(y) + n}-${m}-${day}` }
const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length
const mode = (a: number[]) => { const m = new Map<number, number>(); let best = a[0], n = 0; for (const x of a) { const c = (m.get(x) ?? 0) + 1; m.set(x, c); if (c > n) { n = c; best = x } } return best }

/** WMO weather code → emoji. */
export function weatherIcon(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 2) return '⛅'
  if (code === 3) return '☁️'
  if (code <= 48) return '🌫️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌦️'
  if (code <= 86) return '🌨️'
  return '⛈️'
}
/** WMO weather code → Thai label. */
export function weatherLabel(code: number): string {
  if (code === 0) return 'แดดจัด'
  if (code <= 2) return 'มีเมฆบางส่วน'
  if (code === 3) return 'เมฆมาก'
  if (code <= 48) return 'หมอก'
  if (code <= 57) return 'ฝนปรอย'
  if (code <= 67) return 'ฝนตก'
  if (code <= 77) return 'หิมะ'
  if (code <= 82) return 'ฝนซู่'
  if (code <= 86) return 'หิมะตก'
  return 'พายุฝนฟ้าคะนอง'
}

/** Best city string to geocode for a trip: explicit city → country → trip name
 *  with any year/number stripped (e.g. "Hongkong 2026" → "Hongkong"). */
export function cityFromTrip(t: { cities?: string[] | null; country?: string | null; name?: string | null }): string {
  const c = t.cities?.[0]?.trim()
  if (c) return c
  if (t.country?.trim()) return t.country.trim()
  if (t.name) return t.name.replace(/[#\d]+/g, ' ').replace(/\s+/g, ' ').trim()
  return ''
}

async function geocode(city: string): Promise<{ lat: number; lon: number } | null> {
  const key = `${PREFIX}geo:${city.toLowerCase()}`
  const hit = localStorage.getItem(key)
  if (hit) { try { return JSON.parse(hit) } catch { /* ignore */ } }
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`)
    const j = await r.json()
    const g = j.results?.[0]
    if (!g) return null
    const out = { lat: g.latitude as number, lon: g.longitude as number }
    localStorage.setItem(key, JSON.stringify(out))
    return out
  } catch { return null }
}

async function fetchForecast(lat: number, lon: number): Promise<Record<string, DayWeather>> {
  const out: Record<string, DayWeather> = {}
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=16`)
    const d = (await r.json()).daily
    const t: string[] = d?.time ?? []
    for (let i = 0; i < t.length; i++) {
      out[t[i]] = { date: t[i], tMax: round(d.temperature_2m_max[i]), tMin: round(d.temperature_2m_min[i]), code: d.weather_code[i] ?? 3, climate: false }
    }
  } catch { /* ignore */ }
  return out
}

async function fetchClimate(lat: number, lon: number, dates: string[]): Promise<Record<string, DayWeather>> {
  const sorted = [...dates].sort()
  const start = sorted[0], end = sorted[sorted.length - 1]
  const byMD: Record<string, { max: number[]; min: number[]; code: number[] }> = {}
  await Promise.all([1, 2, 3].map(async (y) => {
    try {
      const r = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${shiftYear(start, -y)}&end_date=${shiftYear(end, -y)}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`)
      const d = (await r.json()).daily
      const t: string[] = d?.time ?? []
      for (let i = 0; i < t.length; i++) {
        const md = t[i].slice(5)
        const b = (byMD[md] ??= { max: [], min: [], code: [] })
        if (d.temperature_2m_max[i] != null) b.max.push(d.temperature_2m_max[i])
        if (d.temperature_2m_min[i] != null) b.min.push(d.temperature_2m_min[i])
        if (d.weather_code[i] != null) b.code.push(d.weather_code[i])
      }
    } catch { /* ignore */ }
  }))
  const out: Record<string, DayWeather> = {}
  for (const d of dates) {
    const b = byMD[d.slice(5)]
    if (b && b.max.length) out[d] = { date: d, tMax: round(avg(b.max)), tMin: round(avg(b.min)), code: b.code.length ? mode(b.code) : 3, climate: true }
  }
  return out
}

const round = (n: number | null | undefined) => (n == null ? null : Math.round(n))

/** Daily weather for a city across the given dates (forecast + climate fallback). */
export async function getWeatherForDates(city: string, dates: string[]): Promise<Record<string, DayWeather>> {
  const clean = [...new Set(dates.filter(Boolean))].sort()
  if (!city || clean.length === 0) return {}
  const cacheKey = `${PREFIX}${todayStr()}:${city.toLowerCase()}:${clean.join(',')}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) { try { return JSON.parse(cached) } catch { /* ignore */ } }

  const geo = await geocode(city)
  if (!geo) return {}
  const today = todayStr()
  const horizon = shiftDays(today, 15)
  const near = clean.filter((d) => d >= today && d <= horizon)
  const far = clean.filter((d) => d > horizon || d < today) // beyond forecast, or already-past trip days

  const merged: Record<string, DayWeather> = {}
  if (near.length) Object.assign(merged, await fetchForecast(geo.lat, geo.lon))
  if (far.length) Object.assign(merged, await fetchClimate(geo.lat, geo.lon, far))

  const out: Record<string, DayWeather> = {}
  for (const d of clean) if (merged[d]) out[d] = merged[d]
  try { localStorage.setItem(cacheKey, JSON.stringify(out)) } catch { /* quota */ }
  return out
}

/** Hook: weather for a city across dates. Returns a date→DayWeather map. */
export function useWeather(city: string | null | undefined, dates: string[]): Record<string, DayWeather> {
  const [data, setData] = useState<Record<string, DayWeather>>({})
  const sig = `${city ?? ''}|${[...dates].filter(Boolean).sort().join(',')}`
  useEffect(() => {
    let active = true
    if (!city || dates.filter(Boolean).length === 0) { setData({}); return }
    getWeatherForDates(city, dates).then((r) => { if (active) setData(r) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])
  return data
}
