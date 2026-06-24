// Formatting helpers (Thai locale)

import { tzOffsetMinutes } from './timezones'

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

/**
 * "5h 50m" from a departure → arrival clock time. When `depTz`/`arrTz` (IANA
 * zones) are given, the two clocks are converted to UTC first so the duration is
 * real (e.g. BKK→PEK isn't off by the +7/+8 difference). Without zones it falls
 * back to a plain clock difference. Wraps a clock that lands earlier into the
 * next day. `flightDate` (YYYY-MM-DD) fixes the offsets to the travel date (DST).
 */
export function flightDuration(
  dep: string | null, arr: string | null,
  depTz?: string | null, arrTz?: string | null, flightDate?: string | null,
): string {
  if (!dep || !arr) return ''
  const [dh, dm] = dep.split(':').map(Number)
  const [ah, am] = arr.split(':').map(Number)
  if ([dh, dm, ah, am].some((n) => isNaN(n))) return ''
  let depMin = dh * 60 + dm
  let arrMin = ah * 60 + am
  if (depTz && arrTz) {
    const at = flightDate ? new Date(`${flightDate}T12:00:00Z`) : new Date()
    const ref = isNaN(at.getTime()) ? new Date() : at
    depMin -= tzOffsetMinutes(depTz, ref) // → UTC minutes
    arrMin -= tzOffsetMinutes(arrTz, ref)
  }
  let mins = arrMin - depMin
  while (mins <= 0) mins += 24 * 60 // arrival on a later day
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h${m ? ` ${m}m` : ''}`
}

/** "Wed 12 Mar 2025" */
export function formatFlightDate(d: string | null): string {
  const dt = d ? new Date(d) : null
  if (!dt || isNaN(dt.getTime())) return ''
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`
}

/** "12 Mar · 15:00" from an ISO timestamp */
export function formatCheckTime(d: string | null): string {
  const dt = d ? new Date(d) : null
  if (!dt || isNaN(dt.getTime())) return ''
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const hh = String(dt.getHours()).padStart(2, '0')
  const mm = String(dt.getMinutes()).padStart(2, '0')
  return `${dt.getDate()} ${months[dt.getMonth()]} · ${hh}:${mm}`
}

/** "¥17,114" given a baht amount and rate (baht per yuan) */
export function yuanFromBaht(bahtAmount: number, bahtPerYuan: number): string {
  if (!bahtPerYuan) return ''
  return '¥' + Math.round(bahtAmount / bahtPerYuan).toLocaleString('en-US')
}
