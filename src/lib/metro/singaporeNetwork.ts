// Routing for the Singapore map. The line/station data already lives in
// SINGAPORE (singapore.ts) and the shared Dijkstra in router.ts already walks a
// BuiltNetwork, so this file only glues the two together — no second copy of
// the network, unlike the Hong Kong / Shanghai / Shenzhen modules which predate
// the shared router.
//
// buildNetwork() also computes coordinates, which this network has none of
// (`hubs` is empty). That's fine: the map's geometry comes from the official
// artwork in singaporeGeo.ts, and routing never looks at x/y.
import { buildNetwork } from './build'
import { SINGAPORE } from './singapore'
import { computeRoute } from './router'
import { SG_STATIONS } from './singaporeGeo'
import type { Transit } from '@/lib/database.types'

export const SG_NET = buildNetwork(SINGAPORE)

export interface SgStationEntry { id: string; name: string; codes: string[]; colors: string[] }

/** Every station once, with the codes and line colours it carries.
 *
 *  Limited to stations the map can actually show: the Sentosa Express stops are
 *  drawn as a grey line in the artwork but carry no code box, so picking one
 *  from search would highlight nothing. */
export const SG_STATION_LIST: SgStationEntry[] = SG_NET.stations
  .filter((s) => SG_STATIONS.some((b) => b.station === s.id))
  .map((s) => ({
    id: s.id,
    name: s.name,
    codes: s.lineIds.map((l) => s.numbers[l]).filter(Boolean),
    colors: s.lineIds.map((l) => SG_NET.lineById[l]?.color).filter(Boolean),
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

export const sgStation = (id: string) => SG_NET.stationById[id]

export function computeRouteSingapore(fromId: string, toId: string): Transit | null {
  return computeRoute(SG_NET, fromId, toId)
}

export function isSingapore(hay: string) {
  const s = hay.toLowerCase()
  return ['singapore', 'สิงคโปร์', 'สิงคโป', '新加坡', 'changi'].some((k) => s.includes(k))
}
