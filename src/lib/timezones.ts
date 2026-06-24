// Shared timezone list for trips and flights. Used to interpret local times
// (itinerary reminders, flight departure/arrival) against a real UTC offset.
export const TIMEZONES = [
  { tz: 'Asia/Bangkok', label: 'ไทย / เวียดนาม (GMT+7)' },
  { tz: 'Asia/Tokyo', label: 'ญี่ปุ่น (GMT+9)' },
  { tz: 'Asia/Seoul', label: 'เกาหลีใต้ (GMT+9)' },
  { tz: 'Asia/Shanghai', label: 'จีน (GMT+8)' },
  { tz: 'Asia/Hong_Kong', label: 'ฮ่องกง (GMT+8)' },
  { tz: 'Asia/Taipei', label: 'ไต้หวัน (GMT+8)' },
  { tz: 'Asia/Singapore', label: 'สิงคโปร์ / มาเลเซีย (GMT+8)' },
  { tz: 'Asia/Jakarta', label: 'อินโดนีเซีย-จาการ์ตา (GMT+7)' },
  { tz: 'Asia/Manila', label: 'ฟิลิปปินส์ (GMT+8)' },
  { tz: 'Asia/Kolkata', label: 'อินเดีย (GMT+5:30)' },
  { tz: 'Asia/Dubai', label: 'ดูไบ / UAE (GMT+4)' },
  { tz: 'Europe/London', label: 'อังกฤษ (GMT+0/+1)' },
  { tz: 'Europe/Paris', label: 'ยุโรปกลาง (GMT+1/+2)' },
  { tz: 'America/New_York', label: 'สหรัฐ-ตะวันออก (GMT-5/-4)' },
  { tz: 'America/Los_Angeles', label: 'สหรัฐ-ตะวันตก (GMT-8/-7)' },
  { tz: 'Australia/Sydney', label: 'ออสเตรเลีย-ซิดนีย์ (GMT+10/+11)' },
]

export const deviceTz = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'Asia/Bangkok' }
})()

/** Minutes that `timeZone` is ahead of UTC at the given instant (e.g. +420 for
 *  GMT+7). DST-aware via Intl. */
export function tzOffsetMinutes(timeZone: string, at: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    const p: Record<string, string> = {}
    for (const part of dtf.formatToParts(at)) p[part.type] = part.value
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
    return Math.round((asUTC - at.getTime()) / 60000)
  } catch { return 0 }
}
