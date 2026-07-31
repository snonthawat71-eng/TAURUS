import { buildNetwork } from './build'
import { OSAKA } from './osaka'
import type { BuiltNetwork } from './types'
import type { Trip } from '@/lib/database.types'

export const NETWORKS: BuiltNetwork[] = [buildNetwork(OSAKA)]
const RAW = [OSAKA]

/** Find a metro network matching free text (e.g. a place's city). */
export function getNetworkForText(text: string): BuiltNetwork | null {
  const hay = ` ${text.toLowerCase()} `
  for (let i = 0; i < RAW.length; i++) {
    if (RAW[i].match.some((m) => hay.includes(m.toLowerCase()))) return NETWORKS[i]
  }
  return null
}

/** Find a metro network that matches a trip (by city / country keywords). */
export function getNetworkForTrip(trip: Trip | null | undefined): BuiltNetwork | null {
  if (!trip) return null
  return getNetworkForText([trip.country ?? '', ...(trip.cities ?? []), trip.name ?? ''].join(' '))
}

export { computeRoute } from './router'
export type { BuiltNetwork } from './types'
