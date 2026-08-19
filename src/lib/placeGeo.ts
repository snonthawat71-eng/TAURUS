// Plan-side coordinates for places, pulled from the map links users already
// paste (Google / AMap). Long links parse locally in one tick; short links
// resolve once through /api/resolve-map (result cached in localStorage by
// geo.ts, so each link costs at most one network call ever).
import { latLngFromUrl, resolveMapUrl, isMapLink, type LatLng } from './geo'
import { planBranch } from './branches'
import { setPlaceCoords } from './placeMutations'
import type { Place } from './database.types'

/** Coordinates of where the PLAN goes for this place — the chosen branch's
 *  link when one was picked, else the main location. Main-location results are
 *  persisted onto the row (lat/lng, added by place_geo.sql) so future loads
 *  skip the resolve; branch coords live in the per-link cache only. */
export async function coordsForPlace(p: Place): Promise<LatLng | null> {
  const b = planBranch(p)
  const url = b?.map_url || p.map_url
  const usingMain = !b?.map_url
  if (usingMain && p.lat != null && p.lng != null) return { lat: p.lat, lng: p.lng }
  if (!url) return null
  let c = latLngFromUrl(url)
  if (!c && isMapLink(url)) c = await resolveMapUrl(url)
  if (c && usingMain && (p.lat == null || p.lng == null)) void setPlaceCoords(p.id, c.lat, c.lng)
  return c
}

/** Great-circle distance in meters. */
export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** "480 ม." under a km, "1.4 กม." above. */
export function fmtDistance(m: number): string {
  return m < 950 ? `${Math.max(10, Math.round(m / 10) * 10)} ม.` : `${(m / 1000).toFixed(1)} กม.`
}
