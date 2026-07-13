import {
  IconInfoCircle, IconCalendarEvent, IconMapPin,
  IconLayoutList, type Icon,
} from '@tabler/icons-react'

export interface NavItem {
  to: string
  label: string
  /** compact label for the mobile bottom nav (label's first word is ambiguous) */
  short: string
  icon: Icon
  /** which count to show (resolved in the sidebar from trip data) */
  count?: 'itinerary' | 'placesfood'
  section: 'PLAN' | 'OVERVIEW'
}

const ALL_PLANS: NavItem = { to: '/plans', label: 'Places List', short: 'Places List', icon: IconLayoutList, section: 'OVERVIEW' }

/** Nav items visible for a given permission. All plans moved INTO the
 *  Itinerary page (big button) — only places-only members still get it in the
 *  nav, since they can't open Itinerary. */
export function visibleNav(perm: string): NavItem[] {
  if (perm === 'places') return [...NAV_ITEMS.filter((n) => n.to === '/places'), ALL_PLANS]
  return NAV_ITEMS
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/info', label: 'Personal Information', short: 'Info', icon: IconInfoCircle, section: 'PLAN' },
  { to: '/itinerary', label: 'Itinerary', short: 'Itinerary', icon: IconCalendarEvent, count: 'itinerary', section: 'PLAN' },
  { to: '/places', label: 'Places & Food', short: 'Places', icon: IconMapPin, count: 'placesfood', section: 'PLAN' },
]
