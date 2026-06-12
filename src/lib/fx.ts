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
  live: boolean
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

/** THB per 1 unit of `code`, cached per-day in localStorage. */
export async function getRateToTHB(code: string): Promise<FxResult> {
  const day = today()
  const key = `fx:${code}:THB`
  try {
    const cached = localStorage.getItem(key)
    if (cached) {
      const parsed = JSON.parse(cached) as FxResult
      if (parsed.date === day) return parsed
    }
  } catch { /* ignore */ }

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${code}`)
    const json = await res.json()
    const rate = json?.rates?.THB
    if (typeof rate === 'number' && rate > 0) {
      const result: FxResult = { rate, date: day, live: true }
      try { localStorage.setItem(key, JSON.stringify(result)) } catch { /* ignore */ }
      return result
    }
  } catch { /* network unavailable — fall through */ }

  return { rate: FALLBACK[code] ?? 1, date: day, live: false }
}
