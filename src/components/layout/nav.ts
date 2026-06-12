import {
  IconInfoCircle, IconCalendarEvent, IconMapPin, IconToolsKitchen2,
  IconLayoutList, IconReceipt, type Icon,
} from '@tabler/icons-react'

export interface NavItem {
  to: string
  label: string
  icon: Icon
  /** which count to show (resolved in the sidebar from trip data) */
  count?: 'itinerary' | 'places' | 'food'
  section: 'PLAN' | 'OVERVIEW'
}

/** Nav items visible for a given permission (places-only sees just Places/Food). */
export function visibleNav(perm: string): NavItem[] {
  if (perm === 'places') return NAV_ITEMS.filter((n) => ['/places', '/food', '/plans'].includes(n.to))
  return NAV_ITEMS
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/info', label: 'Personal Information', icon: IconInfoCircle, section: 'PLAN' },
  { to: '/itinerary', label: 'Itinerary', icon: IconCalendarEvent, count: 'itinerary', section: 'PLAN' },
  { to: '/places', label: 'Places', icon: IconMapPin, count: 'places', section: 'PLAN' },
  { to: '/food', label: 'Food & café', icon: IconToolsKitchen2, count: 'food', section: 'PLAN' },
  { to: '/plans', label: 'All plans', icon: IconLayoutList, section: 'OVERVIEW' },
  { to: '/budget', label: 'Budget', icon: IconReceipt, section: 'OVERVIEW' },
]
