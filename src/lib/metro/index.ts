import { buildNetwork } from './build'
import { OSAKA } from './osaka'
import type { BuiltNetwork } from './types'
import type { Trip } from '@/lib/database.types'

export const NETWORKS: BuiltNetwork[] = [buildNetwork(OSAKA)]
const RAW = [OSAKA]

/** Find a metro network that matches a trip (by city / country keywords). */
export function getNetworkForTrip(trip: Trip | null | undefined): BuiltNetwork | null {
  if (!trip) return null
  const hay = [trip.country ?? '', ...(trip.cities ?? []), trip.name ?? ''].join(' ').toLowerCase()
  for (let i = 0; i < RAW.length; i++) {
    if (RAW[i].match.some((m) => hay.includes(m.toLowerCase()))) return NETWORKS[i]
  }
  return null
}

export { computeRoute } from './router'
export type { BuiltNetwork } from './types'
