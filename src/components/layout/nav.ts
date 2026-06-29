import {
  IconInfoCircle, IconCalendarEvent, IconMapPin,
  IconLayoutList, type Icon,
} from '@tabler/icons-react'

export interface NavItem {
  to: string
  label: string
  icon: Icon
  /** which count to show (resolved in the sidebar from trip data) */
  count?: 'itinerary' | 'placesfood'
  section: 'PLAN' | 'OVERVIEW'
}

/** Nav items visible for a given permission (places-only sees just Places & Food). */
export function visibleNav(perm: string): NavItem[] {
  if (perm === 'places') return NAV_ITEMS.filter((n) => ['/places', '/plans'].includes(n.to))
  return NAV_ITEMS
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/info', label: 'Personal Information', icon: IconInfoCircle, section: 'PLAN' },
  { to: '/itinerary', label: 'Itinerary', icon: IconCalendarEvent, count: 'itinerary', section: 'PLAN' },
  { to: '/places', label: 'Places & Food', icon: IconMapPin, count: 'placesfood', section: 'PLAN' },
  { to: '/plans', label: 'All plans', icon: IconLayoutList, section: 'OVERVIEW' },
]
