// Foreign-exchange rates vs THB. Fetched once per day from a free public API
// (open.er-api.com, no key) and cached in localStorage. Falls back to static
// approximate rates if the network is unavailable (e.g. offline).

export interface Currency {
  code: string
  symbol: string
  name: string
  flag: string
}

export const CURRENCIES: Currency[] = [
  { code: 'CNY', symbol: '¥', name: 'หยวน (จีน)', flag: '🇨🇳' },
  { code: 'JPY', symbol: '¥', name: 'เยน (ญี่ปุ่น)', flag: '🇯🇵' },
  { code: 'KRW', symbol: '₩', name: 'วอน (เกาหลี)', flag: '🇰🇷' },
  { code: 'USD', symbol: '$', name: 'ดอลลาร์ (สหรัฐ)', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'ยูโร', flag: '🇪🇺' },
  { code: 'TWD', symbol: 'NT$', name: 'ดอลลาร์ไต้หวัน', flag: '🇹🇼' },
  { code: 'HKD', symbol: 'HK$', name: 'ดอลลาร์ฮ่องกง', flag: '🇭🇰' },
  { code: 'GBP', symbol: '£', name: 'ปอนด์', flag: '🇬🇧' },
  { code: 'SGD', symbol: 'S$', name: 'ดอลลาร์สิงคโปร์', flag: '🇸🇬' },
]

// Rough fallbacks (THB per 1 unit) used only if the API can't be reached.
const FALLBACK: Record<string, number> = {
  CNY: 4.92, JPY: 0.23, KRW: 0.025, USD: 35.2, EUR: 38.1, TWD: 1.1, HKD: 4.5, GBP: 44.5, SGD: 26.2,
}

export interface FxResult {
  rate: number // THB per 1 unit of `code`
  date: string // YYYY-MM-DD
  live: boolean // true = fetched fresh today
  approx?: boolean // true = rough static fallback (no real rate ever cached)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

// One API call returns EVERY currency vs THB, so fetch once and share it:
// concurrent callers (Budget + the FX widget load together) await the same
// in-flight request instead of each firing their own.
let inflight: Promise<Record<string, number> | null> | null = null
function fetchAllRatesTHB(): Promise<Record<string, number> | null> {
  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/THB')
        const json = await res.json()
        const rates = json?.rates
        if (!rates || typeof rates !== 'object') return null
        // API gives units-per-THB; invert to THB per 1 unit
        const out: Record<string, number> = {}
        for (const [code, v] of Object.entries(rates as Record<string, unknown>)) {
          if (typeof v === 'number' && v > 0) out[code] = 1 / v
        }
        return Object.keys(out).length ? out : null
      } catch { return null } finally { inflight = null }
    })()
  }
  return inflight
}

/** THB per 1 unit of `code`, cached per-day in localStorage.
 *  Pass force=true to bypass today's cache and re-fetch. */
export async function getRateToTHB(code: string, force = false): Promise<FxResult> {
  const day = today()
  const key = `fx:${code}:THB`
  let cached: FxResult | null = null
  try {
    const raw = localStorage.getItem(key)
    if (raw) cached = JSON.parse(raw) as FxResult
  } catch { /* ignore */ }

  // fresh: a real rate already fetched today
  if (!force && cached && cached.date === day && cached.rate > 0) {
    return { rate: cached.rate, date: cached.date, live: true, approx: false }
  }

  const all = await fetchAllRatesTHB()
  if (all) {
    // warm today's cache for every supported currency in one go
    for (const c of CURRENCIES) {
      if (all[c.code]) {
        try { localStorage.setItem(`fx:${c.code}:THB`, JSON.stringify({ rate: all[c.code], date: day, live: true, approx: false })) } catch { /* ignore */ }
      }
    }
    if (all[code]) return { rate: all[code], date: day, live: true, approx: false }
  }

  // offline: prefer the last real rate we ever cached (stale but accurate)
  if (cached && typeof cached.rate === 'number' && cached.rate > 0) {
    return { rate: cached.rate, date: cached.date, live: false, approx: false }
  }
  // nothing cached → rough static estimate
  return { rate: FALLBACK[code] ?? 1, date: day, live: false, approx: true }
}
