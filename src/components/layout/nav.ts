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

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Trip info', icon: IconInfoCircle, section: 'PLAN' },
  { to: '/itinerary', label: 'Itinerary', icon: IconCalendarEvent, count: 'itinerary', section: 'PLAN' },
  { to: '/places', label: 'Places', icon: IconMapPin, count: 'places', section: 'PLAN' },
  { to: '/food', label: 'Food & café', icon: IconToolsKitchen2, count: 'food', section: 'PLAN' },
  { to: '/plans', label: 'All plans', icon: IconLayoutList, section: 'OVERVIEW' },
  { to: '/budget', label: 'Budget', icon: IconReceipt, section: 'OVERVIEW' },
]
