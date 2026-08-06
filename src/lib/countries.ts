// Country identity. `country` is free text on trips and Explore places, so the
// same country arrives spelled several ways ("Japan", "ญี่ปุ่น", "日本", "jp").
// Anything that GROUPS by country must fold the raw value through
// `canonicalCountry()` first, or one country turns into several cards.

export interface Country {
  name: string
  flag: string
  /** other spellings that mean this country (matched after normalising) */
  aliases?: string[]
}

export const COUNTRIES: Country[] = [
  { name: 'China', flag: '🇨🇳', aliases: ['cn', 'chn', 'prc', 'mainland china', 'จีน', 'ประเทศจีน', '中国', '中國'] },
  { name: 'Japan', flag: '🇯🇵', aliases: ['jp', 'jpn', 'nippon', 'ญี่ปุ่น', 'ประเทศญี่ปุ่น', '日本'] },
  { name: 'South Korea', flag: '🇰🇷', aliases: ['kr', 'kor', 'korea', 'republic of korea', 'เกาหลี', 'เกาหลีใต้', '한국', '대한민국', '韓国'] },
  { name: 'Taiwan', flag: '🇹🇼', aliases: ['tw', 'twn', 'roc', 'ไต้หวัน', '台灣', '台湾'] },
  { name: 'Thailand', flag: '🇹🇭', aliases: ['th', 'tha', 'ไทย', 'ประเทศไทย', '泰国'] },
  { name: 'Singapore', flag: '🇸🇬', aliases: ['sg', 'sgp', 'สิงคโปร์', '新加坡'] },
  { name: 'Vietnam', flag: '🇻🇳', aliases: ['vn', 'vnm', 'viet nam', 'เวียดนาม'] },
  { name: 'Hong Kong', flag: '🇭🇰', aliases: ['hk', 'hkg', 'hongkong', 'ฮ่องกง', '香港'] },
  { name: 'Macau', flag: '🇲🇴', aliases: ['macao', 'มาเก๊า', '澳門', '澳门'] },
  { name: 'Malaysia', flag: '🇲🇾', aliases: ['mys', 'มาเลเซีย', 'มาเลย์'] },
  { name: 'Indonesia', flag: '🇮🇩', aliases: ['idn', 'อินโดนีเซีย', 'อินโด'] },
  { name: 'Philippines', flag: '🇵🇭', aliases: ['phl', 'ฟิลิปปินส์'] },
  { name: 'Laos', flag: '🇱🇦', aliases: ['lao', 'ลาว', 'ประเทศลาว'] },
  { name: 'Cambodia', flag: '🇰🇭', aliases: ['khm', 'กัมพูชา', 'เขมร'] },
  { name: 'Myanmar', flag: '🇲🇲', aliases: ['burma', 'พม่า', 'เมียนมา', 'เมียนมาร์'] },
  { name: 'India', flag: '🇮🇳', aliases: ['ind', 'อินเดีย'] },
  { name: 'Australia', flag: '🇦🇺', aliases: ['aus', 'ออสเตรเลีย'] },
  { name: 'New Zealand', flag: '🇳🇿', aliases: ['nzl', 'นิวซีแลนด์'] },
  { name: 'USA', flag: '🇺🇸', aliases: ['us', 'u.s.', 'u.s.a.', 'united states', 'united states of america', 'america', 'อเมริกา', 'สหรัฐอเมริกา', 'สหรัฐฯ', 'สหรัฐ'] },
  { name: 'Canada', flag: '🇨🇦', aliases: ['can', 'แคนาดา'] },
  { name: 'United Kingdom', flag: '🇬🇧', aliases: ['uk', 'u.k.', 'britain', 'great britain', 'england', 'อังกฤษ', 'สหราชอาณาจักร'] },
  { name: 'France', flag: '🇫🇷', aliases: ['fra', 'ฝรั่งเศส'] },
  { name: 'Italy', flag: '🇮🇹', aliases: ['ita', 'italia', 'อิตาลี'] },
  { name: 'Spain', flag: '🇪🇸', aliases: ['esp', 'espana', 'españa', 'สเปน'] },
  { name: 'Germany', flag: '🇩🇪', aliases: ['deu', 'deutschland', 'เยอรมนี', 'เยอรมัน'] },
  { name: 'Switzerland', flag: '🇨🇭', aliases: ['che', 'swiss', 'สวิตเซอร์แลนด์', 'สวิส'] },
  { name: 'Netherlands', flag: '🇳🇱', aliases: ['nld', 'holland', 'เนเธอร์แลนด์'] },
  { name: 'Portugal', flag: '🇵🇹', aliases: ['prt', 'โปรตุเกส'] },
  { name: 'Turkey', flag: '🇹🇷', aliases: ['turkiye', 'türkiye', 'ตุรกี'] },
  { name: 'United Arab Emirates', flag: '🇦🇪', aliases: ['uae', 'u.a.e.', 'ยูเออี', 'สหรัฐอาหรับเอมิเรตส์'] },
]

/** Fold spelling differences away: case, spaces, dots, dashes, quotes. Thai and
 *  CJK characters pass through untouched — they carry the meaning. */
const norm = (s: string) => s.trim().toLowerCase().replace(/[\s._'’`´\-–—,()/]+/g, '')

const BY_ALIAS = new Map<string, Country>()
for (const c of COUNTRIES) {
  for (const a of [c.name, ...(c.aliases ?? [])]) BY_ALIAS.set(norm(a), c)
}

/** The key a city is grouped and compared under, so "Guang Zhou", "guangzhou"
 *  and "Guang-Zhou" are one city rather than three. Display keeps whatever
 *  spelling was typed — only the matching is folded. */
export const cityKey = (raw: string | null | undefined) => norm(raw ?? '')

/** The single name a country is grouped and displayed under. A country we don't
 *  know is kept exactly as typed (trimmed) so nothing ever vanishes from the
 *  browser — it just doesn't get a flag. Blank input returns ''. */
export function canonicalCountry(raw: string | null | undefined): string {
  const s = (raw ?? '').trim()
  if (!s) return ''
  return BY_ALIAS.get(norm(s))?.name ?? s
}

export function countryFlag(name: string | null | undefined): string {
  if (!name) return '🌍'
  return BY_ALIAS.get(norm(name))?.flag ?? '🌍'
}
