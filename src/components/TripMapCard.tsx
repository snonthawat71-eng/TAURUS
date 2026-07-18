import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { IconChevronRight, IconMap2 } from '@tabler/icons-react'
import { latLngFromUrl } from '@/lib/geo'
import type { Place } from '@/lib/database.types'

/** Entry card for the trip map — a live (non-interactive) minimap preview of
 *  the trip's pinned places bleeds in from the right, mirroring the Airbnb /
 *  delivery-app "open map" card. Tapping anywhere opens the full map. */
export function TripMapCard({ places, onOpen }: { places: Place[]; onOpen: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null)

  // only places whose coordinates we already know without a network round-trip
  // (DB lat/lng, or parseable straight out of a stored map link)
  const pts = useMemo(() => {
    const out: [number, number][] = []
    for (const p of places) {
      if (typeof p.lat === 'number' && typeof p.lng === 'number') out.push([p.lat, p.lng])
      else { const c = latLngFromUrl(p.map_url); if (c) out.push([c.lat, c.lng]) }
    }
    return out
  }, [places])

  useEffect(() => {
    const el = boxRef.current
    if (!el || pts.length === 0) return
    const map = L.map(el, {
      zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false,
      doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false,
    })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, detectRetina: true }).addTo(map)
    if (pts.length === 1) map.setView(pts[0], 14)
    else map.fitBounds(L.latLngBounds(pts).pad(0.35), { maxZoom: 14 })
    for (const pt of pts) {
      L.circleMarker(pt, { radius: 4.5, color: '#fff', weight: 1.5, fillColor: '#0270FB', fillOpacity: 1 }).addTo(map)
    }
    const t = setTimeout(() => map.invalidateSize(), 80)
    return () => { clearTimeout(t); map.remove() }
  }, [pts])

  return (
    <button onClick={onOpen}
      className="relative w-full mb-3 h-[124px] rounded-[16px] overflow-hidden text-left bg-surface hairline shadow-sm">
      {/* live minimap preview (behind everything, can't grab taps) */}
      <div ref={boxRef} className="absolute inset-0 pointer-events-none" />
      {/* fade the left side back to the card surface so the text stays legible */}
      <div aria-hidden className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface) 40%, color-mix(in srgb, var(--color-surface) 35%, transparent) 66%, transparent 100%)' }} />
      {/* content */}
      <div className="relative h-full flex flex-col justify-center px-4 pr-28">
        <div className="flex items-center gap-1.5 text-ink">
          <IconMap2 size={20} />
          <span className="text-[16px] font-bold leading-tight">แผนที่ทริป</span>
        </div>
        <span className="text-[12.5px] text-ink-2 mt-1.5">ดูทุกสถานที่ปักหมุดตามตำแหน่งจริง</span>
        <span className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-brand mt-2.5">
          เปิดแผนที่ <IconChevronRight size={15} />
        </span>
      </div>
    </button>
  )
}
