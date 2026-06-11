import { supabase } from './supabase'

const METRO = {
  blue: '#185FA5',
  cyan: '#378ADD',
  orange: '#EF9F27',
  purple: '#7F77DD',
  gray: '#888780',
}

const uuid = () => crypto.randomUUID()

function die(step: string, error: unknown): never {
  const msg =
    error && typeof error === 'object' && 'message' in error
      ? (error as { message: string }).message
      : String(error)
  throw new Error(`[${step}] ${msg}`)
}

/**
 * Create the trip row only. We generate the id client-side so we never depend
 * on INSERT ... RETURNING passing the SELECT RLS policy (which can race with the
 * "add owner as member" trigger). Returns the new trip id.
 */
export async function createSampleTrip(userId: string): Promise<string> {
  const id = uuid()
  const { error } = await supabase.from('trips').insert({
    id,
    name: 'Beijing · Tianjin',
    country: 'China',
    start_date: '2025-03-12',
    end_date: '2025-03-18',
    owner_id: userId,
  })
  if (error) die('สร้างทริป', error)
  return id
}

/**
 * Populate an (empty) trip with the Beijing sample content. Safe to call only
 * when the trip has no travelers yet. All child ids are generated client-side.
 */
export async function seedTripContent(trip_id: string, userId: string): Promise<void> {
  // Travelers
  const tv = {
    elf: uuid(), nak: uuid(), tum: uuid(), ploy: uuid(),
  }
  let r = await supabase.from('travelers').insert([
    { id: tv.elf, trip_id, nickname: 'Elf', full_name: 'Nuttaporn Saengthong', passport_last4: '3456' },
    { id: tv.nak, trip_id, nickname: 'Nak', full_name: 'Siriporn Wattana', passport_last4: '8821' },
    { id: tv.tum, trip_id, nickname: 'Tum', full_name: 'Chaiyaporn Buranasiri', passport_last4: '1290' },
    { id: tv.ploy, trip_id, nickname: 'Ploy', full_name: 'Nareerat Phomchit', passport_last4: '7704' },
  ])
  if (r.error) die('ผู้เดินทาง', r.error)

  // Sample secret-file tags (placeholders — tapping shows a note until a real
  // file is uploaded). Demonstrates the "who has which files" tag bubbles.
  r = await supabase.from('traveler_files').insert([
    { trip_id, traveler_id: tv.elf, kind: 'arrival_card', label: 'Arrival card', storage_path: 'sample/elf-arrival.png' },
    { trip_id, traveler_id: tv.elf, kind: 'visa', label: 'Visa', storage_path: 'sample/elf-visa.png' },
    { trip_id, traveler_id: tv.nak, kind: 'arrival_card', label: 'Arrival card', storage_path: 'sample/nak-arrival.png' },
    { trip_id, traveler_id: tv.tum, kind: 'arrival_card', label: 'Arrival card', storage_path: 'sample/tum-arrival.png' },
    { trip_id, traveler_id: tv.tum, kind: 'ticket', label: 'Disney ticket', storage_path: 'sample/tum-disney.png' },
    { trip_id, traveler_id: tv.ploy, kind: 'arrival_card', label: 'Arrival card', storage_path: 'sample/ploy-arrival.png' },
    { trip_id, traveler_id: tv.ploy, kind: 'visa', label: 'Visa', storage_path: 'sample/ploy-visa.png' },
  ])
  if (r.error) die('ไฟล์ผู้เดินทาง', r.error)

  // Flights
  r = await supabase.from('flights').insert([
    {
      trip_id, direction: 'outbound', airline: 'Thai Airways', flight_no: 'TG614',
      dep_code: 'BKK', dep_name: 'Suvarnabhumi', dep_time: '09:45',
      arr_code: 'PEK', arr_name: 'Capital Intl', arr_time: '15:35',
      flight_date: '2025-03-12', booking_ref: 'XKQP34',
    },
    {
      trip_id, direction: 'return', airline: 'Thai Airways', flight_no: 'TG615',
      dep_code: 'PEK', dep_name: 'Capital Intl', dep_time: '17:05',
      arr_code: 'BKK', arr_name: 'Suvarnabhumi', arr_time: '21:20',
      flight_date: '2025-03-18', booking_ref: 'XKQP34',
    },
  ])
  if (r.error) die('ไฟลต์', r.error)

  // Hotels
  r = await supabase.from('hotels').insert([
    {
      trip_id, name: 'Beijing Wangfujing Grand Hotel', city: 'Beijing', nights: 4,
      map_url: 'https://maps.apple.com/?q=Beijing+Wangfujing+Hotel',
      booking_id: 'BK-4892301', checkin: '2025-03-12T15:00:00', checkout: '2025-03-16T12:00:00',
      rooms: [
        { name: 'Room 1', members: ['Elf', 'Nak'] },
        { name: 'Room 2', members: ['Tum', 'Ploy'] },
      ],
    },
    {
      trip_id, name: 'Tianjin Riverside Inn', city: 'Tianjin', nights: 2,
      map_url: 'https://maps.apple.com/?q=Tianjin+Riverside+Inn',
      booking_id: 'BK-7731045', checkin: '2025-03-16T14:00:00', checkout: '2025-03-18T11:00:00',
      rooms: [{ name: 'Room 1', members: ['ทุกคน'] }],
    },
  ])
  if (r.error) die('ที่พัก', r.error)

  // Days
  const d = { d0: uuid(), d1: uuid(), d2: uuid() }
  r = await supabase.from('itinerary_days').insert([
    { id: d.d0, trip_id, day_date: '2025-03-12', label: 'วันเดินทาง · เข้าปักกิ่ง', position: 0 },
    { id: d.d1, trip_id, day_date: '2025-03-13', label: 'พระราชวัง · ใจกลางเมือง', position: 1 },
    { id: d.d2, trip_id, day_date: '2025-03-14', label: 'กำแพงเมืองจีน', position: 2 },
  ])
  if (r.error) die('วันในแพลน', r.error)

  // Stops
  r = await supabase.from('itinerary_stops').insert([
    {
      trip_id, day_id: d.d0, time: '07:00', place_name: 'Suvarnabhumi International Airport',
      map_url: 'https://maps.apple.com/?q=Suvarnabhumi+Airport',
      note: 'เช็คอินสนามบิน · TG614 ออก 09:45', position: 0,
    },
    {
      trip_id, day_id: d.d0, time: '15:35', place_name: 'Capital International Airport (PEK)',
      map_url: 'https://maps.apple.com/?q=Beijing+Capital+Airport',
      note: 'ถึงปักกิ่ง · ผ่าน ตม. และรับกระเป๋า', position: 1,
    },
    {
      trip_id, day_id: d.d0, time: '17:00', place_name: 'เดินทางเข้าเมือง → โรงแรม',
      note: '~1ชม.', position: 2,
      transit: {
        legs: [
          {
            line: 'Airport Express', color: METRO.blue,
            from: 'Terminal 3 · Capital Airport', to: 'Dongzhimen',
            direction: 'ทาง Dongzhimen', stops: 2, minutes: 16,
            transferAfter: { walkMeters: 163, minutes: 4 },
          },
          {
            line: 'Line 5', color: METRO.orange,
            from: 'Dongzhimen', to: 'Dongdan',
            direction: 'ทาง Jinghuadongdao', stops: 4, minutes: 6,
            transferAfter: { minutes: 1 },
          },
          {
            line: 'Line 1', color: METRO.blue,
            from: 'Dongdan', to: 'Wangfujing',
            direction: 'ทาง Gucheng', stops: 2, minutes: 4,
          },
        ],
        exit: { label: 'Exit E3', note: 'เดินต่อ ~3 นาที ถึงโรงแรม' },
      },
    },
    {
      trip_id, day_id: d.d1, time: '09:00', place_name: 'Forbidden City',
      map_url: 'https://maps.apple.com/?q=Forbidden+City+Beijing',
      note: 'จองตั๋วล่วงหน้า เข้าทาง Meridian Gate', position: 0,
    },
    {
      trip_id, day_id: d.d1, time: '14:00', place_name: 'Wangfujing Snack Street',
      map_url: 'https://maps.apple.com/?q=Wangfujing+Snack+Street',
      note: 'ของกินเล่นยอดนิยม', position: 1,
    },
    {
      trip_id, day_id: d.d2, time: '07:30', place_name: 'Great Wall (Badaling)',
      map_url: 'https://maps.apple.com/?q=Badaling+Great+Wall',
      note: 'ไปเช้า เลี่ยงคนเยอะ เผื่อเวลาทั้งวัน', position: 0,
    },
  ])
  if (r.error) die('จุดแวะในแพลน', r.error)

  // Places + Food
  const p = {
    forbidden: uuid(), greatwall: uuid(), heaven: uuid(), universal: uuid(),
    quanjude: uuid(), metalhands: uuid(), snack: uuid(), haidilao: uuid(),
  }
  r = await supabase.from('places').insert([
    {
      id: p.forbidden, trip_id, group_type: 'place', category: 'landmark', name: 'Forbidden City',
      station_line: 'Line 1', station_color: METRO.blue, station_name: 'Tiananmen East',
      map_url: 'https://maps.apple.com/?q=Forbidden+City+Beijing',
      note: 'พระราชวังสมัยราชวงศ์หมิง-ชิง ควรจองตั๋วล่วงหน้า', in_plan: true,
    },
    {
      id: p.greatwall, trip_id, group_type: 'place', category: 'nature', name: 'Great Wall (Badaling)',
      station_line: 'Bus', station_color: METRO.gray, station_name: 'Badaling',
      map_url: 'https://maps.apple.com/?q=Badaling+Great+Wall',
      note: 'ช่วงที่นิยมที่สุด มีรถเข้าขึ้น เผื่อเวลาทั้งวัน', in_plan: true,
    },
    {
      id: p.heaven, trip_id, group_type: 'place', category: 'landmark', name: 'Temple of Heaven',
      station_line: 'Line 8', station_color: METRO.cyan, station_name: 'Olympic Park',
      map_url: 'https://maps.apple.com/?q=Temple+of+Heaven+Beijing',
      note: 'สวนสาธารณะกว้าง สถาปัตยกรรมสวย คนท้องถิ่นออกกำลังเช้า', in_plan: false,
    },
    {
      id: p.universal, trip_id, group_type: 'place', category: 'themepark', name: 'Universal Studios Beijing',
      station_line: 'Line 11', station_color: METRO.orange, station_name: 'Universal Resort',
      map_url: 'https://maps.apple.com/?q=Universal+Studios+Beijing',
      note: 'ตั๋วจองแล้วของ Tum · ไปเช้า เล่นได้ทั้งวัน', in_plan: true,
    },
    {
      id: p.quanjude, trip_id, group_type: 'food', category: 'restaurant', name: 'Quanjude Roast Duck',
      station_line: 'Line 1', station_color: METRO.blue, station_name: 'Wangfujing',
      map_url: 'https://maps.apple.com/?q=Quanjude+Wangfujing',
      note: 'ร้านเป็ดย่างเก่าแก่ระดับตำนาน ควรจองโต๊ะล่วงหน้า', in_plan: true,
    },
    {
      id: p.metalhands, trip_id, group_type: 'food', category: 'cafe', name: 'Metal Hands Coffee',
      station_line: 'Line 6', station_color: METRO.purple, station_name: 'Nanluoguxiang',
      map_url: 'https://maps.apple.com/?q=Metal+Hands+Coffee+Beijing',
      note: 'คาเฟ่ฮิปในตรอกเก่า บรรยากาศดี เหมาะถ่ายรูป', in_plan: false,
    },
    {
      id: p.snack, trip_id, group_type: 'food', category: 'dessert', name: 'Wangfujing Snack Street',
      station_line: 'Line 1', station_color: METRO.blue, station_name: 'Wangfujing',
      map_url: 'https://maps.apple.com/?q=Wangfujing+Snack+Street',
      note: 'ถนนของกินยอดนิยม ลองขนมพื้นเมืองหลากหลาย', in_plan: true,
    },
    {
      id: p.haidilao, trip_id, group_type: 'food', category: 'restaurant', name: 'Haidilao Hot Pot',
      station_line: 'Line 5', station_color: METRO.orange, station_name: 'Dongdan',
      map_url: 'https://maps.apple.com/?q=Haidilao+Dongdan',
      note: 'หม้อไฟชื่อดัง บริการเยี่ยม เปิดดึก เหมาะมื้อค่ำ', in_plan: false,
    },
  ])
  if (r.error) die('สถานที่/ร้าน', r.error)

  // Current user's interest on a few
  r = await supabase.from('place_interest').insert(
    [p.forbidden, p.greatwall, p.quanjude].map((place_id) => ({ place_id, user_id: userId })),
  )
  if (r.error) die('อยากไป', r.error)

  // Expenses — you paid, split across all 4 travelers
  const splitAll = [tv.elf, tv.nak, tv.tum, tv.ploy]
  r = await supabase.from('expenses').insert([
    { trip_id, name: 'ตั๋วเครื่องบิน TG614 ไป-กลับ', payer_id: userId, total: 48000, split_user_ids: splitAll },
    { trip_id, name: 'Beijing Wangfujing Hotel · 4 คืน', payer_id: userId, total: 22000, split_user_ids: splitAll },
    { trip_id, name: 'Universal Studios · ตั๋ว 4 ใบ', payer_id: userId, total: 9600, split_user_ids: splitAll },
    { trip_id, name: 'มื้อค่ำ Haidilao', payer_id: userId, total: 4600, split_user_ids: splitAll },
  ])
  if (r.error) die('ค่าใช้จ่าย', r.error)
}

const OLD_FULLNAMES: Record<string, string> = {
  Elf: 'Nuttaporn Saengthong', Nak: 'Siriporn Wattana',
  Tum: 'Chaiyaporn Buranasiri', Ploy: 'Nareerat Phomchit',
}

const SAMPLE_FILES: Record<string, { kind: string; label: string; path: string }[]> = {
  Elf: [
    { kind: 'arrival_card', label: 'Arrival card', path: 'sample/elf-arrival.png' },
    { kind: 'visa', label: 'Visa', path: 'sample/elf-visa.png' },
  ],
  Nak: [{ kind: 'arrival_card', label: 'Arrival card', path: 'sample/nak-arrival.png' }],
  Tum: [
    { kind: 'arrival_card', label: 'Arrival card', path: 'sample/tum-arrival.png' },
    { kind: 'ticket', label: 'Disney ticket', path: 'sample/tum-disney.png' },
  ],
  Ploy: [
    { kind: 'arrival_card', label: 'Arrival card', path: 'sample/ploy-arrival.png' },
    { kind: 'visa', label: 'Visa', path: 'sample/ploy-visa.png' },
  ],
}

/**
 * Top up a trip that was seeded by an earlier version: add sample traveler files,
 * a second (Tianjin) hotel, and nicer full names. Idempotent and additive.
 */
export async function backfillSample(opts: {
  trip_id: string
  travelers: { id: string; nickname: string | null; full_name: string | null }[]
  travelerFilesCount: number
  hotelsCount: number
}) {
  const { trip_id, travelers } = opts

  if (opts.travelerFilesCount === 0) {
    const rows = travelers.flatMap((t) => {
      const files = SAMPLE_FILES[t.nickname ?? '']
      return files
        ? files.map((f) => ({ trip_id, traveler_id: t.id, kind: f.kind, label: f.label, storage_path: f.path }))
        : []
    })
    if (rows.length) await supabase.from('traveler_files').insert(rows)
  }

  // Upgrade generic full names from the very first seed version
  for (const t of travelers) {
    const want = OLD_FULLNAMES[t.nickname ?? '']
    if (want && t.full_name !== want && (t.full_name === t.nickname || t.full_name === `${t.nickname} (you)` || !t.full_name)) {
      await supabase.from('travelers').update({ full_name: want }).eq('id', t.id)
    }
  }

  if (opts.hotelsCount === 1) {
    await supabase.from('hotels').insert({
      trip_id, name: 'Tianjin Riverside Inn', city: 'Tianjin', nights: 2,
      map_url: 'https://maps.apple.com/?q=Tianjin+Riverside+Inn',
      booking_id: 'BK-7731045', checkin: '2025-03-16T14:00:00', checkout: '2025-03-18T11:00:00',
      rooms: [{ name: 'Room 1', members: ['ทุกคน'] }],
    })
  }
}
