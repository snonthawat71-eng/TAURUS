// The city names the app knows, and everything people actually type for them.
//
// City is a free-text field — it has to be, nobody can list every city on
// earth — but left alone that means "Hong Kong", "hongkong", "ฮ่องกง" and
// "Kowloon/Hong Kong Island" all become separate cities: separate cards in the
// Explore rail, separate filter chips, separate photo lookups. So a typed city
// is folded onto a canonical name when we recognise it, and passed through
// untouched when we don't.
//
// Aliases only need to be the ones people type. Districts of a city people
// treat AS the city (Kowloon, Shibuya) belong here too — for a trip planner
// "Kowloon" is Hongkong.
import { cityKey } from './countries'

export interface City {
  /** the one spelling everything is stored and shown as */
  name: string
  /** canonical country name (see canonicalCountry) */
  country: string
  aliases?: string[]
}

export const CITIES: City[] = [
  // Japan
  { name: 'Tokyo', country: 'Japan', aliases: ['โตเกียว', '東京', 'Tokyo Japan', 'Shibuya', 'Shinjuku', 'ชิบูย่า', 'ชินจูกุ'] },
  { name: 'Osaka', country: 'Japan', aliases: ['โอซาก้า', 'โอซาก้า', 'โอซากะ', '大阪', 'Namba', 'นัมบะ'] },
  { name: 'Kyoto', country: 'Japan', aliases: ['เกียวโต', '京都'] },
  { name: 'Nara', country: 'Japan', aliases: ['นารา', '奈良'] },
  { name: 'Kobe', country: 'Japan', aliases: ['โกเบ', '神戸'] },
  { name: 'Nagoya', country: 'Japan', aliases: ['นาโกย่า', 'นาโงย่า', '名古屋'] },
  { name: 'Fukuoka', country: 'Japan', aliases: ['ฟุกุโอกะ', '福岡', 'Hakata', 'ฮากาตะ'] },
  { name: 'Sapporo', country: 'Japan', aliases: ['ซัปโปโร', 'ซัปโปโร่', '札幌'] },
  { name: 'Nagano', country: 'Japan', aliases: ['นากาโน่', 'นางาโนะ', '長野'] },
  { name: 'Hakone', country: 'Japan', aliases: ['ฮาโกเน่', '箱根'] },
  { name: 'Okinawa', country: 'Japan', aliases: ['โอกินาว่า', 'โอกินาวะ', '沖縄'] },
  // Hong Kong / Macau — a city that is also the country
  { name: 'Hongkong', country: 'Hong Kong', aliases: ['Hong Kong', 'HK', 'ฮ่องกง', '香港', 'Kowloon', 'เกาลูน', 'Hong Kong Island', 'Kowloon/Hong Kong Island', 'Tsim Sha Tsui', 'จิมซาจุ่ย', 'Central', 'Mongkok', 'Mong Kok', 'มงก๊ก'] },
  { name: 'Macau', country: 'Macau', aliases: ['Macao', 'มาเก๊า', '澳門', '澳门'] },
  // Mainland China
  { name: 'Guangzhou', country: 'China', aliases: ['Guang Zhou', 'กว่างโจว', 'กวางเจา', 'กวางโจว', 'Canton', '广州'] },
  { name: 'Shenzhen', country: 'China', aliases: ['Shen Zhen', 'เซินเจิ้น', 'เซี่ยงเจิ้น', '深圳'] },
  { name: 'Shanghai', country: 'China', aliases: ['Shang Hai', 'เซี่ยงไฮ้', '上海'] },
  { name: 'Beijing', country: 'China', aliases: ['Peking', 'ปักกิ่ง', '北京'] },
  { name: 'Chengdu', country: 'China', aliases: ['เฉิงตู', '成都'] },
  { name: 'Chongqing', country: 'China', aliases: ['ฉงชิ่ง', '重庆'] },
  { name: 'Hangzhou', country: 'China', aliases: ['หางโจว', '杭州'] },
  { name: 'Xiamen', country: 'China', aliases: ['เซี่ยเหมิน', '厦门'] },
  { name: 'Foshan', country: 'China', aliases: ['ฝอซาน', 'ฟอซาน', '佛山'] },
  // Taiwan
  { name: 'Taipei', country: 'Taiwan', aliases: ['ไทเป', '台北', 'New Taipei', 'นิวไทเป', 'Ximending', 'ซีเหมินติง'] },
  { name: 'Taichung', country: 'Taiwan', aliases: ['ไทจง', '台中'] },
  { name: 'Tainan', country: 'Taiwan', aliases: ['ไถหนาน', 'ไทหนาน', '台南'] },
  { name: 'Kaohsiung', country: 'Taiwan', aliases: ['เกาสง', '高雄'] },
  { name: 'Hualien', country: 'Taiwan', aliases: ['ฮวาเหลียน', '花蓮'] },
  // Korea
  { name: 'Seoul', country: 'South Korea', aliases: ['โซล', '서울', 'Myeongdong', 'เมียงดง', 'Hongdae', 'ฮงแด'] },
  { name: 'Busan', country: 'South Korea', aliases: ['ปูซาน', '부산'] },
  { name: 'Jeju', country: 'South Korea', aliases: ['เชจู', 'เกาะเชจู', '제주'] },
  // Southeast Asia
  { name: 'Singapore', country: 'Singapore', aliases: ['สิงคโปร์', '新加坡', 'SG'] },
  { name: 'Kuala Lumpur', country: 'Malaysia', aliases: ['กัวลาลัมเปอร์', 'KL'] },
  { name: 'Bangkok', country: 'Thailand', aliases: ['กรุงเทพ', 'กรุงเทพฯ', 'กรุงเทพมหานคร', 'BKK'] },
  { name: 'Chiang Mai', country: 'Thailand', aliases: ['เชียงใหม่'] },
  { name: 'Phuket', country: 'Thailand', aliases: ['ภูเก็ต'] },
  { name: 'Hanoi', country: 'Vietnam', aliases: ['ฮานอย', 'Ha Noi'] },
  { name: 'Ho Chi Minh City', country: 'Vietnam', aliases: ['โฮจิมินห์', 'Saigon', 'ไซ่ง่อน', 'HCMC'] },
  { name: 'Da Nang', country: 'Vietnam', aliases: ['ดานัง', 'Danang'] },
]

const BY_ALIAS = new Map<string, City>()
for (const c of CITIES) {
  for (const a of [c.name, ...(c.aliases ?? [])]) BY_ALIAS.set(cityKey(a), c)
}

/** The one spelling a city is stored and displayed as. A city we don't know is
 *  kept exactly as typed (trimmed) — the field stays free text. */
export function canonicalCity(raw: string | null | undefined): string {
  const s = (raw ?? '').trim()
  if (!s) return ''
  return BY_ALIAS.get(cityKey(s))?.name ?? s
}

/** The key two city names must share to count as the same place — folds
 *  spelling AND the aliases above, so "Kowloon" meets "Hongkong". */
export const cityMatchKey = (raw: string | null | undefined) => cityKey(canonicalCity(raw))

/** Cities to offer while typing, for the country already chosen (every known
 *  city when there isn't one yet). */
export function citySuggestions(country?: string | null): string[] {
  const c = (country ?? '').trim().toLowerCase()
  if (!c) return CITIES.map((x) => x.name)
  // a country we don't have cities for offers none rather than every city we
  // know — a France trip shouldn't be suggested Osaka
  return CITIES.filter((x) => x.country.toLowerCase() === c).map((x) => x.name)
}
