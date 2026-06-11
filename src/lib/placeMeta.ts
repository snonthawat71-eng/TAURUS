import {
  IconBuildingMonument, IconMountain, IconBuildingCarousel,
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
]

export const FOOD_TABS: CategoryTab[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'restaurant', label: 'ร้านอาหาร' },
  { key: 'cafe', label: 'คาเฟ่' },
  { key: 'dessert', label: 'ร้านขนม' },
]

export const PLACE_CATEGORIES = ['landmark', 'nature', 'themepark']
export const FOOD_CATEGORIES = ['restaurant', 'cafe', 'dessert']
