import { useEffect, useState } from 'react'

// Weather via Open-Meteo (free, no API key). We resolve the trip's location from
// a built-in coordinate table first (covers the app's common cities + countries,
// matched even inside a trip name like "Hongkong 2026"); only unknown places hit
// the geocoding API. Then a daily forecast (≤16 days) with a climate-average
// fallback (mean of the last 3 years) for dates the forecast can't reach.
// Everything is cached in localStorage; empty results are never cached, so a
// transient failure retries next time.

export interface DayWeather {
  date: string        // YYYY-MM-DD
  tMax: number | null
  tMin: number | null
  code: number        // WMO weather code
  climate: boolean    // true = climate average (forecast didn't reach this date)
}

type LatLon = { lat: number; lon: number }

// normalized key (lowercase, letters only) → coordinates
const C: Record<string, LatLon> = {
  // cities the app features (+ neighbours)
  tokyo: { lat: 35.68, lon: 139.76 }, osaka: { lat: 34.69, lon: 135.50 }, kyoto: { lat: 35.01, lon: 135.77 },
  nagoya: { lat: 35.18, lon: 136.91 }, fukuoka: { lat: 33.59, lon: 130.40 }, sapporo: { lat: 43.06, lon: 141.35 },
  beijing: { lat: 39.90, lon: 116.41 }, shanghai: { lat: 31.23, lon: 121.47 }, shenzhen: { lat: 22.54, lon: 114.06 },
  guangzhou: { lat: 23.13, lon: 113.26 }, chengdu: { lat: 30.57, lon: 104.07 },
  hongkong: { lat: 22.32, lon: 114.17 }, macau: { lat: 22.20, lon: 113.54 }, macao: { lat: 22.20, lon: 113.54 },
  taipei: { lat: 25.03, lon: 121.57 }, kaohsiung: { lat: 22.63, lon: 120.30 },
  seoul: { lat: 37.57, lon: 126.98 }, busan: { lat: 35.18, lon: 129.08 },
  singapore: { lat: 1.35, lon: 103.82 }, bangkok: { lat: 13.76, lon: 100.50 }, chiangmai: { lat: 18.79, lon: 98.98 },
  phuket: { lat: 7.88, lon: 98.39 }, hanoi: { lat: 21.03, lon: 105.85 }, hochiminh: { lat: 10.82, lon: 106.63 },
  danang: { lat: 16.05, lon: 108.21 }, kualalumpur: { lat: 3.14, lon: 101.69 }, jakarta: { lat: -6.21, lon: 106.85 },
  bali: { lat: -8.65, lon: 115.22 }, denpasar: { lat: -8.65, lon: 115.22 }, manila: { lat: 14.60, lon: 120.98 },
  london: { lat: 51.51, lon: -0.13 }, paris: { lat: 48.86, lon: 2.35 }, newyork: { lat: 40.71, lon: -74.01 },
  sydney: { lat: -33.87, lon: 151.21 }, dubai: { lat: 25.20, lon: 55.27 },
}
// country names → a representative city's coordinates (last-resort fallback)
const COUNTRY: Record<string, string> = {
  japan: 'tokyo', china: 'beijing', taiwan: 'taipei', korea: 'seoul', southkorea: 'seoul',
  thailand: 'bangkok', vietnam: 'hanoi', malaysia: 'kualalumpur', indonesia: 'jakarta',
  philippines: 'manila', uk: 'london', unitedkingdom: 'london', england: 'london',
  france: 'paris', usa: 'newyork', unitedstates: 'newyork', america: 'newyork',
  australia: 'sydney', uae: 'dubai', emirates: 'dubai', hongkong: 'hongkong', singapore: 'singapore',
}
// Thai spellings → the C key above (trip names/cities are often typed in Thai,
// which the ascii-only tables can't match and the geocoder may miss)
const ALIAS: Record<string, string> = {
  'โตเกียว': 'tokyo', 'โอซาก้า': 'osaka', 'โอซากะ': 'osaka', 'เกียวโต': 'kyoto', 'นาโกย่า': 'nagoya',
  'ฟุกุโอกะ': 'fukuoka', 'ซัปโปโร': 'sapporo', 'ปักกิ่ง': 'beijing', 'เซี่ยงไฮ้': 'shanghai',
  'เซินเจิ้น': 'shenzhen', 'กวางเจา': 'guangzhou', 'กว่างโจว': 'guangzhou', 'เฉิงตู': 'chengdu',
  'ฮ่องกง': 'hongkong', 'มาเก๊า': 'macau', 'ไทเป': 'taipei', 'เกาสง': 'kaohsiung',
  'โซล': 'seoul', 'ปูซาน': 'busan', 'สิงคโปร์': 'singapore', 'กรุงเทพ': 'bangkok', 'กรุงเทพฯ': 'bangkok',
  'เชียงใหม่': 'chiangmai', 'ภูเก็ต': 'phuket', 'ฮานอย': 'hanoi', 'โฮจิมินห์': 'hochiminh',
  'ดานัง': 'danang', 'กัวลาลัมเปอร์': 'kualalumpur', 'จาการ์ตา': 'jakarta', 'บาหลี': 'bali',
  'มะนิลา': 'manila', 'ลอนดอน': 'london', 'ปารีส': 'paris', 'นิวยอร์ก': 'newyork',
  'ซิดนีย์': 'sydney', 'ดูไบ': 'dubai',
  // countries in Thai → representative city
  'ญี่ปุ่น': 'tokyo', 'จีน': 'beijing', 'ไต้หวัน': 'taipei', 'เกาหลี': 'seoul', 'เกาหลีใต้': 'seoul',
  'ไทย': 'bangkok', 'เวียดนาม': 'hanoi', 'มาเลเซีย': 'kualalumpur', 'อินโดนีเซีย': 'jakarta',
  'ฟิลิปปินส์': 'manila', 'อังกฤษ': 'london', 'ฝรั่งเศส': 'paris', 'อเมริกา': 'newyork',
  'สหรัฐ': 'newyork', 'ออสเตรเลีย': 'sydney',
}

const PREFIX = 'wx:'
// keep Thai characters so ALIAS keys can match (ascii tables strip to a-z anyway)
const norm = (s: string) => s.toLowerCase().replace(/[^a-z฀-๿]/g, '')
const todayStr = () => new Date().toISOString().slice(0, 10)
const shiftDays = (d: string, n: number) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
const shiftYear = (d: string, n: number) => { const [y, m, day] = d.split('-'); return `${Number(y) + n}-${m}-${day}` }
const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length
const mode = (a: number[]) => { const m = new Map<number, number>(); let best = a[0], n = 0; for (const x of a) { const c = (m.get(x) ?? 0) + 1; m.set(x, c); if (c > n) { n = c; best = x } } return best }
const round = (n: number | null | undefined) => (n == null ? null : Math.round(n))

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

/** Ordered location candidates for a trip: cities → name (may contain the city)
 *  → country. */
export function tripCityCandidates(t: { cities?: string[] | null; country?: string | null; name?: string | null }): string[] {
  const out: string[] = []
  for (const c of t.cities ?? []) if (c?.trim()) out.push(c.trim())
  if (t.name?.trim()) out.push(t.name.trim())
  if (t.country?.trim()) out.push(t.country.trim())
  return out
}

function builtInCoords(candidates: string[]): LatLon | null {
  for (const cand of candidates) {
    const n = norm(cand)
    if (!n) continue
    if (C[n]) return C[n]
    if (COUNTRY[n]) return C[COUNTRY[n]]
    if (ALIAS[n]) return C[ALIAS[n]]
    // the candidate may embed a known city/country (e.g. "hongkong2026", "ทริปเซี่ยงไฮ้")
    for (const key in C) if (n.includes(key)) return C[key]
    for (const key in COUNTRY) if (n.includes(key)) return C[COUNTRY[key]]
    for (const key in ALIAS) if (n.includes(key)) return C[ALIAS[key]]
  }
  return null
}

async function geocode(query: string): Promise<LatLon | null> {
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`)
    const g = (await r.json()).results?.[0]
    return g ? { lat: g.latitude, lon: g.longitude } : null
  } catch { return null }
}

async function resolveCoords(candidates: string[]): Promise<LatLon | null> {
  const clean = candidates.map((c) => c?.trim()).filter(Boolean) as string[]
  if (!clean.length) return null
  const key = `${PREFIX}geo:${clean.join('|').toLowerCase()}`
  const hit = localStorage.getItem(key)
  if (hit) { try { return JSON.parse(hit) } catch { /* ignore */ } }
  let coords = builtInCoords(clean)
  if (!coords) { for (const c of clean) { coords = await geocode(c); if (coords) break } }
  if (coords) localStorage.setItem(key, JSON.stringify(coords))
  return coords
}

async function fetchForecast(lat: number, lon: number): Promise<Record<string, DayWeather>> {
  const out: Record<string, DayWeather> = {}
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=16`)
    const d = (await r.json()).daily
    const t: string[] = d?.time ?? []
    for (let i = 0; i < t.length; i++) out[t[i]] = { date: t[i], tMax: round(d.temperature_2m_max[i]), tMin: round(d.temperature_2m_min[i]), code: d.weather_code[i] ?? 3, climate: false }
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

/** Daily weather for a place (given ordered candidate names) across the dates. */
export async function getWeatherForDates(candidates: string[], dates: string[]): Promise<Record<string, DayWeather>> {
  const clean = [...new Set(dates.filter(Boolean))].sort()
  if (clean.length === 0) return {}
  const sigCity = candidates.filter(Boolean).join('|').toLowerCase()
  const cacheKey = `${PREFIX}${todayStr()}:${sigCity}:${clean.join(',')}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) { try { const v = JSON.parse(cached); if (Object.keys(v).length) return v } catch { /* ignore */ } }

  const geo = await resolveCoords(candidates)
  if (!geo) return {}
  const today = todayStr()
  const horizon = shiftDays(today, 15)
  const near = clean.filter((d) => d >= today && d <= horizon)
  const far = clean.filter((d) => d > horizon || d < today)

  const merged: Record<string, DayWeather> = {}
  if (near.length) Object.assign(merged, await fetchForecast(geo.lat, geo.lon))
  if (far.length) Object.assign(merged, await fetchClimate(geo.lat, geo.lon, far))

  const out: Record<string, DayWeather> = {}
  for (const d of clean) if (merged[d]) out[d] = merged[d]
  if (Object.keys(out).length) {
    pruneStaleCache()
    try { localStorage.setItem(cacheKey, JSON.stringify(out)) }
    catch { /* quota — prune already ran; drop this day's cache */ }
  }
  return out
}

/** Forecast cache keys embed the fetch date (`wx:YYYY-MM-DD:…`) and are only ever
 *  read on that same day — anything older is dead weight that would otherwise
 *  accumulate in localStorage forever. Geo lookups (`wx:geo:…`) are city-bounded
 *  and date-independent, so they stay. */
function pruneStaleCache() {
  try {
    const day = todayStr()
    const stale: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(PREFIX) || k.startsWith(`${PREFIX}geo:`)) continue
      const date = k.slice(PREFIX.length, PREFIX.length + 10)
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date !== day) stale.push(k)
    }
    for (const k of stale) localStorage.removeItem(k)
  } catch { /* ignore */ }
}

/** Hook: weather for a place (candidate names) across dates → date→DayWeather. */
export function useWeather(candidates: string[], dates: string[]): Record<string, DayWeather> {
  const [data, setData] = useState<Record<string, DayWeather>>({})
  const sig = candidates.filter(Boolean).join('|') + '#' + [...dates].filter(Boolean).sort().join(',')
  useEffect(() => {
    let active = true
    if (candidates.filter(Boolean).length === 0 || dates.filter(Boolean).length === 0) { setData({}); return }
    getWeatherForDates(candidates, dates).then((r) => { if (active) setData(r) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])
  return data
}
