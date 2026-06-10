// Formatting helpers (Thai locale)

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]
const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const EN_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]
const EN_DAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
]

function parse(d: string | null | undefined): Date | null {
  if (!d) return null
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? null : dt
}

/** "12–18 Mar 2025" */
export function formatDateRange(start: string | null, end: string | null): string {
  const a = parse(start)
  const b = parse(end)
  if (!a) return ''
  if (!b) return `${a.getDate()} ${EN_MONTHS_SHORT[a.getMonth()]} ${a.getFullYear()}`
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  if (sameMonth) {
    return `${a.getDate()}–${b.getDate()} ${EN_MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`
  }
  return `${a.getDate()} ${EN_MONTHS_SHORT[a.getMonth()]} – ${b.getDate()} ${EN_MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`
}

/** number of days inclusive, e.g. 12->18 = 7 */
export function dayCount(start: string | null, end: string | null): number {
  const a = parse(start)
  const b = parse(end)
  if (!a || !b) return 0
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
}

/** "Wednesday · 12 March 2025" */
export function formatLongDate(d: string | null): string {
  const dt = parse(d)
  if (!dt) return ''
  return `${EN_DAYS[dt.getDay()]} · ${dt.getDate()} ${EN_MONTHS[dt.getMonth()]} ${dt.getFullYear()}`
}

/** "12 มี.ค." */
export function formatShortThai(d: string | null): string {
  const dt = parse(d)
  if (!dt) return ''
  return `${dt.getDate()} ${THAI_MONTHS_SHORT[dt.getMonth()]}`
}

/** "฿84,200" */
export function baht(n: number | null | undefined): string {
  if (n == null) return '฿0'
  return '฿' + Math.round(n).toLocaleString('en-US')
}

/** "¥17,114" given a baht amount and rate (baht per yuan) */
export function yuanFromBaht(bahtAmount: number, bahtPerYuan: number): string {
  if (!bahtPerYuan) return ''
  return '¥' + Math.round(bahtAmount / bahtPerYuan).toLocaleString('en-US')
}
