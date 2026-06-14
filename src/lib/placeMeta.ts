import {
  IconBuildingMonument, IconMountain, IconBuildingCarousel,
  IconMusic, IconBuildingArch, IconTorii, IconBuildingBank, IconShoppingBag, IconWalk,
  IconToolsKitchen2, IconCoffee, IconCake, IconMapPin, type Icon,
} from '@tabler/icons-react'

export interface CategoryMeta {
  group: 'place' | 'food'
  label: string
  icon: Icon
  bg: string
  fg: string
}

export const CATEGORY: Record<string, CategoryMeta> = {
  landmark: { group: 'place', label: 'แลนด์มาร์ก', icon: IconBuildingMonument, bg: '#EAF1FB', fg: '#185FA5' },
  nature: { group: 'place', label: 'ธรรมชาติ', icon: IconMountain, bg: '#EAF3EC', fg: '#2F7D4F' },
  themepark: { group: 'place', label: 'สวนสนุก', icon: IconBuildingCarousel, bg: '#EFECFB', fg: '#7F77DD' },
  entertainment: { group: 'place', label: 'สถานบันเทิง', icon: IconMusic, bg: '#FBEAF3', fg: '#B23A86' },
  historic: { group: 'place', label: 'โบราณสถาน', icon: IconBuildingArch, bg: '#F5EFE5', fg: '#9A7320' },
  shrine: { group: 'place', label: 'วัด/ศาลเจ้า', icon: IconTorii, bg: '#FBECE9', fg: '#C0432E' },
  museum: { group: 'place', label: 'พิพิธภัณฑ์', icon: IconBuildingBank, bg: '#ECEFF6', fg: '#4A5A86' },
  shopping: { group: 'place', label: 'ช้อปปิ้ง', icon: IconShoppingBag, bg: '#FDF0E6', fg: '#C56A1E' },
  walkingstreet: { group: 'place', label: 'ถนนคนเดิน', icon: IconWalk, bg: '#E9F3F4', fg: '#2E7E8C' },
  restaurant: { group: 'food', label: 'ร้านอาหาร', icon: IconToolsKitchen2, bg: '#FBEEE8', fg: '#C2562B' },
  cafe: { group: 'food', label: 'คาเฟ่', icon: IconCoffee, bg: '#F3EEE6', fg: '#8A6A3B' },
  dessert: { group: 'food', label: 'ร้านขนม', icon: IconCake, bg: '#FBEAF0', fg: '#C24E7C' },
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
]

export const FOOD_TABS: CategoryTab[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'restaurant', label: 'ร้านอาหาร' },
  { key: 'cafe', label: 'คาเฟ่' },
  { key: 'dessert', label: 'ร้านขนม' },
]

export const PLACE_CATEGORIES = ['landmark', 'nature', 'themepark', 'entertainment', 'historic', 'shrine', 'museum', 'shopping', 'walkingstreet']
export const FOOD_CATEGORIES = ['restaurant', 'cafe', 'dessert']
