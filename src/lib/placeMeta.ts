import {
  IconBuildingMonument, IconMountain, IconBuildingCarousel,
  IconMusic, IconBuildingArch, IconTorii, IconBuildingBank, IconShoppingBag, IconWalk,
  IconToolsKitchen2, IconSoup, IconBowl, IconBurger,
  IconCoffee, IconCup, IconCake, IconBread, IconIceCream2,
  IconGlassCocktail, IconBeer, IconArmchair, IconGift,
  IconTree, IconMapPin, type Icon,
} from '@tabler/icons-react'

export interface CategoryMeta {
  group: 'place' | 'food'
  label: string
  icon: Icon
  bg: string
  fg: string
}

export const CATEGORY: Record<string, CategoryMeta> = {
  // --- places ---
  landmark: { group: 'place', label: 'แลนด์มาร์ก', icon: IconBuildingMonument, bg: '#EAF1FB', fg: '#185FA5' },
  nature: { group: 'place', label: 'ธรรมชาติ', icon: IconMountain, bg: '#EAF3EC', fg: '#2F7D4F' },
  themepark: { group: 'place', label: 'สวนสนุก', icon: IconBuildingCarousel, bg: '#EFECFB', fg: '#7F77DD' },
  entertainment: { group: 'place', label: 'สถานบันเทิง', icon: IconMusic, bg: '#FBEAF3', fg: '#B23A86' },
  historic: { group: 'place', label: 'โบราณสถาน', icon: IconBuildingArch, bg: '#F5EFE5', fg: '#9A7320' },
  shrine: { group: 'place', label: 'วัด/ศาลเจ้า', icon: IconTorii, bg: '#FBECE9', fg: '#C0432E' },
  museum: { group: 'place', label: 'พิพิธภัณฑ์', icon: IconBuildingBank, bg: '#ECEFF6', fg: '#4A5A86' },
  shopping: { group: 'place', label: 'ช้อปปิ้ง', icon: IconShoppingBag, bg: '#FDF0E6', fg: '#C56A1E' },
  walkingstreet: { group: 'place', label: 'ถนนคนเดิน', icon: IconWalk, bg: '#E9F3F4', fg: '#2E7E8C' },
  park: { group: 'place', label: 'สวนสาธารณะ', icon: IconTree, bg: '#EBF4E9', fg: '#3C8246' },
  // --- food: Food group ---
  restaurant: { group: 'food', label: 'ร้านอาหาร', icon: IconToolsKitchen2, bg: '#FBEEE8', fg: '#C2562B' },
  buffet: { group: 'food', label: 'บุฟเฟต์', icon: IconSoup, bg: '#FBF1E3', fg: '#C07A1E' },
  snack: { group: 'food', label: 'ของทานเล่น', icon: IconBowl, bg: '#FBF4E6', fg: '#B5862B' },
  fastfood: { group: 'food', label: 'ฟาสต์ฟู้ด', icon: IconBurger, bg: '#FBEAE6', fg: '#C24E3A' },
  // --- food: Cafe group ---
  cafe: { group: 'food', label: 'คาเฟ่', icon: IconCoffee, bg: '#F3EEE6', fg: '#8A6A3B' },
  coffeetea: { group: 'food', label: 'กาแฟ / ชา', icon: IconCup, bg: '#F4EEE3', fg: '#94703C' },
  dessert: { group: 'food', label: 'ของหวาน', icon: IconCake, bg: '#FBEAF0', fg: '#C24E7C' },
  bakery: { group: 'food', label: 'เบเกอรี่', icon: IconBread, bg: '#F6EEE2', fg: '#A9763B' },
  icecream: { group: 'food', label: 'ไอศครีม', icon: IconIceCream2, bg: '#E7F3F8', fg: '#3F8FB5' },
  // --- food: Bar group ---
  bar: { group: 'food', label: 'บาร์', icon: IconGlassCocktail, bg: '#EEEBF7', fg: '#6A5BA8' },
  pub: { group: 'food', label: 'ผับ', icon: IconBeer, bg: '#F4EDE4', fg: '#9A6B2B' },
  chill: { group: 'food', label: 'ร้านนั่งชิว', icon: IconArmchair, bg: '#E9F1F4', fg: '#5C7E8C' },
  // --- food: Souvenir group ---
  souvenir: { group: 'food', label: 'ร้านของฝาก', icon: IconGift, bg: '#E6F4EE', fg: '#2F8F6B' },
  // --- food group headers (used for filter tabs + section headers; not selectable) ---
  gfood: { group: 'food', label: 'Food', icon: IconToolsKitchen2, bg: '#FBEEE8', fg: '#C2562B' },
  gcafe: { group: 'food', label: 'Cafe', icon: IconCoffee, bg: '#F3EEE6', fg: '#8A6A3B' },
  gbar: { group: 'food', label: 'Bar', icon: IconGlassCocktail, bg: '#EEEBF7', fg: '#6A5BA8' },
  gsouvenir: { group: 'food', label: 'Souvenir', icon: IconGift, bg: '#E6F4EE', fg: '#2F8F6B' },
}

export function catMeta(category: string | null | undefined): CategoryMeta {
  return (category && CATEGORY[category]) || {
    group: 'place', label: 'อื่นๆ', icon: IconMapPin, bg: '#F1F0EC', fg: '#5F5E5A',
  }
}

export interface CategoryTab { key: string; label: string }

export const PLACE_TABS: CategoryTab[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'landmark', label: 'แลนด์มาร์ก' },
  { key: 'nature', label: 'ธรรมชาติ' },
  { key: 'themepark', label: 'สวนสนุก' },
  { key: 'entertainment', label: 'สถานบันเทิง' },
  { key: 'historic', label: 'โบราณสถาน' },
  { key: 'shrine', label: 'วัด/ศาลเจ้า' },
  { key: 'museum', label: 'พิพิธภัณฑ์' },
  { key: 'shopping', label: 'ช้อปปิ้ง' },
  { key: 'walkingstreet', label: 'ถนนคนเดิน' },
  { key: 'park', label: 'สวนสาธารณะ' },
]

// Food: 4 main groups, each with subcategories.
export const FOOD_GROUPS: { key: string; label: string; cats: string[] }[] = [
  { key: 'gfood', label: 'Food', cats: ['restaurant', 'buffet', 'snack', 'fastfood'] },
  { key: 'gcafe', label: 'Cafe', cats: ['cafe', 'coffeetea', 'dessert', 'bakery', 'icecream'] },
  { key: 'gbar', label: 'Bar', cats: ['bar', 'pub', 'chill'] },
  { key: 'gsouvenir', label: 'Souvenir', cats: ['souvenir'] },
]

// Food page top-level filter chips = the 4 groups.
export const FOOD_TABS: CategoryTab[] = [
  { key: 'all', label: 'ทั้งหมด' },
  ...FOOD_GROUPS.map((g) => ({ key: g.key, label: g.label })),
]

/** Which food group a subcategory belongs to (group key, e.g. 'gcafe'). */
export function foodGroupKey(category: string | null | undefined): string {
  for (const g of FOOD_GROUPS) if (category && g.cats.includes(category)) return g.key
  return 'gfood'
}

export const PLACE_CATEGORIES = ['landmark', 'nature', 'themepark', 'entertainment', 'historic', 'shrine', 'museum', 'shopping', 'walkingstreet', 'park']
export const FOOD_CATEGORIES = FOOD_GROUPS.flatMap((g) => g.cats)
