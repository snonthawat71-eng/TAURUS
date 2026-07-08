import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { IconSearch, IconX, IconCurrentLocation, IconMapPin, IconMapPinOff, IconFocus2, IconLoader2, IconArrowLeft } from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { catMeta } from '@/lib/placeMeta'
import { latLngFromUrl, geocode, resolveMapUrl, isMapLink, type LatLng } from '@/lib/geo'
import { setPlaceCoords } from '@/lib/placeMutations'
import { openMap } from '@/lib/maps'
import { toast } from '@/lib/toast'
import type { Place } from '@/lib/database.types'

const TILE = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const ATTR = '&copy; OpenStreetMap &copy; CARTO'

function haversine(a: LatLng, b: LatLng) {
  const R = 6371, toR = Math.PI / 180
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s)) // km
}
const kmLabel = (km: number) => (km < 1 ? `${Math.round(km * 1000)} ม.` : `${km.toFixed(1)} กม.`)
const httpPhoto = (p: Place) => {
  const u = p.photo_url || (p.photo_path && /^https?:\/\//.test(p.photo_path) ? p.photo_path : null)
  return u ? u.replace('/upload/', '/upload/f_auto,q_auto,w_96,h_96,c_fill/') : null
}

export default function TripMap() {
  const { trip, places } = useTrip()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'all' | 'place' | 'food'>('all')
  const [query, setQuery] = useState('')
  const [coords, setCoords] = useState<Record<string, LatLng>>({})
  const [selected, setSelected] = useState<Place | null>(null)
  const [me, setMe] = useState<LatLng | null>(null)
  const [geoBusy, setGeoBusy] = useState(0)
  const [placing, setPlacing] = useState<Place | null>(null) // the place we're pinning
  const [linkText, setLinkText] = useState('')
  const placingRef = useRef<Place | null>(null)
  useEffect(() => { placingRef.current = placing }, [placing])

  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const meMarkerRef = useRef<L.Marker | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const fitted = useRef(false)

  const tripPlaces = useMemo(() => places.filter((p) => p.name), [places])

  // ---- resolve coordinates (A: lat/lng col or map_url · C: geocode + cache) ----
  useEffect(() => {
    let alive = true
    const next: Record<string, LatLng> = {}
    const missing: Place[] = []
    for (const p of tripPlaces) {
      if (typeof p.lat === 'number' && typeof p.lng === 'number') next[p.id] = { lat: p.lat, lng: p.lng }
      else {
        const fromUrl = latLngFromUrl(p.map_url)
        if (fromUrl) next[p.id] = fromUrl
        else missing.push(p)
      }
    }
    setCoords(next)
    setGeoBusy(missing.length)
    const gotCoords = (p: Place, r: LatLng | null) => {
      if (!alive) return
      setGeoBusy((n) => Math.max(0, n - 1))
      if (r) { setCoords((c) => ({ ...c, [p.id]: r })); setPlaceCoords(p.id, r.lat, r.lng).catch(() => {}) }
    }
    // A2) links (short google/amap) — resolve server-side, in parallel (fast)
    const links = missing.filter((p) => isMapLink(p.map_url))
    const queue = [...links]
    const worker = async () => { while (queue.length && alive) { const p = queue.shift()!; gotCoords(p, await resolveMapUrl(p.map_url!)) } }
    Promise.all(Array.from({ length: 6 }, worker))
    // C) the rest — geocode by name+city (throttled inside geocode())
    ;(async () => {
      for (const p of missing.filter((p) => !isMapLink(p.map_url))) {
        if (!alive) return
        gotCoords(p, await geocode([p.name, p.station_name, p.city, trip?.country]))
      }
    })()
    return () => { alive = false }
  }, [tripPlaces, trip?.country])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tripPlaces.filter((p) => {
      if (!coords[p.id]) return false
      const g = catMeta(p.category).group
      if (filter !== 'all' && g !== filter) return false
      if (q && !(p.name ?? '').toLowerCase().includes(q) && !(p.station_name ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [tripPlaces, coords, filter, query])

  // ---- init map once ----
  useEffect(() => {
    if (!boxRef.current || mapRef.current) return
    const map = L.map(boxRef.current, { zoomControl: false, attributionControl: true }).setView([22.3, 114.17], 12)
    L.tileLayer(TILE, { attribution: ATTR, maxZoom: 19, detectRetina: true }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    // tap the map while pinning a place → set its location
    map.on('click', (e) => { const p = placingRef.current; if (p) applyRef.current(p, { lat: e.latlng.lat, lng: e.latlng.lng }) })
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // ---- (re)draw markers ----
  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    const pts: L.LatLngExpression[] = []
    for (const p of shown) {
      const c = coords[p.id]; if (!c) continue
      const meta = catMeta(p.category)
      const photo = httpPhoto(p)
      const inner = photo ? `<img src="${photo}" alt=""/>` : `<div style="width:100%;height:100%;background:${meta.bg}"></div>`
      const icon = L.divIcon({
        className: '', iconSize: [38, 38], iconAnchor: [19, 38],
        html: `<div class="tpin ${selected?.id === p.id ? 'sel' : ''}" style="--c:${meta.fg}"><div class="tpin-b">${inner}</div></div>`,
      })
      const m = L.marker([c.lat, c.lng], { icon }).addTo(layer)
      m.on('click', () => { setSelected(p); map.panTo([c.lat, c.lng]) })
      pts.push([c.lat, c.lng])
    }
    // fit once when we first have points (avoid yanking the view on every geocode)
    if (pts.length && !fitted.current) { map.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 15 }); fitted.current = true }
  }, [shown, coords, selected])

  function applyCoords(p: Place, c: LatLng) {
    setCoords((m) => ({ ...m, [p.id]: c }))
    setPlaceCoords(p.id, c.lat, c.lng).catch(() => {})
    setPlacing(null); setLinkText('')
    fitted.current = true // don't auto-refit after a manual pin
    mapRef.current?.setView([c.lat, c.lng], 15)
    toast.success(`ปักหมุด "${p.name}" แล้ว`)
  }
  const applyRef = useRef(applyCoords)
  applyRef.current = applyCoords

  function parsePasted(text: string): LatLng | null {
    const t = text.trim()
    const fromUrl = latLngFromUrl(t)
    if (fromUrl) return fromUrl
    const m = t.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/)
    if (m) { const lat = +m[1], lng = +m[2]; if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng } }
    return null
  }

  function locate() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((pos) => {
      const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      setMe(c)
      const map = mapRef.current; if (!map) return
      map.setView([c.lat, c.lng], 14)
      if (meMarkerRef.current) meMarkerRef.current.remove()
      meMarkerRef.current = L.marker([c.lat, c.lng], {
        icon: L.divIcon({ className: '', iconSize: [18, 18], iconAnchor: [9, 9], html: '<div style="width:18px;height:18px;border-radius:50%;background:#0270FB;border:3px solid #fff;box-shadow:0 0 0 2px rgba(2,112,251,.4)"></div>' }),
      }).addTo(map)
    })
  }
  function refit() {
    const map = mapRef.current; if (!map) return
    const pts = shown.map((p) => coords[p.id]).filter(Boolean).map((c) => [c.lat, c.lng] as L.LatLngExpression)
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 15 })
  }

  // distances (and the "nearby" sort) are measured from the user's location only —
  // NOT the map centre, so panning the map never re-renders/re-sorts the list.
  const ref = me
  const nearby = useMemo(() => {
    if (!ref) return shown
    return [...shown].sort((a, b) => haversine(ref, coords[a.id]) - haversine(ref, coords[b.id]))
  }, [shown, coords, ref])
  const unplaced = useMemo(() => tripPlaces.filter((p) => !coords[p.id]), [tripPlaces, coords])

  const CHIPS: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'ทั้งหมด' }, { key: 'place', label: 'สถานที่' }, { key: 'food', label: 'อาหาร/คาเฟ่' },
  ]

  return (
    <div className="fixed inset-0 z-[400]">
      {/* test banner */}
      <div className="absolute top-0 inset-x-0 z-[500] bg-[#D97706] text-white text-[11px] font-medium flex items-center justify-center gap-2 py-1">
        <button onClick={() => navigate('/places')} className="absolute left-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5"><IconArrowLeft size={13} /> กลับ</button>
        🧪 หน้าแผนที่ (เทส) — ยังไม่เปิดให้ผู้ใช้ · /map
      </div>

      <div ref={boxRef} className="absolute inset-0" style={placing ? { cursor: 'crosshair' } : undefined} />

      {/* pinning banner — overlays the search while placing a pin */}
      {placing && (
        <div className="absolute top-7 inset-x-0 z-[600] px-3 pt-2">
          <div className="rounded-2xl bg-ink text-white p-3 shadow-xl">
            <div className="text-[12.5px] font-semibold flex items-center gap-1.5"><IconMapPin size={15} /> แตะบนแผนที่เพื่อวางหมุด: {placing.name}</div>
            <div className="flex gap-2 mt-2">
              <input value={linkText} onChange={(e) => setLinkText(e.target.value)} placeholder="หรือวางลิงก์ Google / พิกัด lat,lng"
                className="flex-1 h-9 rounded-md px-2.5 text-[12px] text-ink bg-white outline-none" />
              <button onClick={() => { const c = parsePasted(linkText); if (c) applyCoords(placing, c); else toast.error('อ่านพิกัดจากที่วางไม่ได้ — ใช้ลิงก์ที่มี @lat,lng หรือพิมพ์ 22.30,114.17') }}
                className="h-9 px-3.5 rounded-md bg-brand text-white text-[12px] font-semibold shrink-0">ใช้</button>
            </div>
            <button onClick={() => { setPlacing(null); setLinkText('') }} className="mt-2 text-[11.5px] text-white/70">ยกเลิก</button>
          </div>
        </div>
      )}

      {/* top controls */}
      <div className={`absolute top-7 inset-x-0 z-[500] px-3 pt-2 space-y-2 ${placing ? 'hidden' : ''}`}>
        <div className="flex items-center gap-2 h-11 rounded-full bg-white shadow-md px-4">
          <IconSearch size={17} className="text-ink-3" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาสถานที่ในทริป"
            className="flex-1 bg-transparent outline-none text-[13.5px]" />
          {query && <button onClick={() => setQuery('')} className="text-ink-3"><IconX size={15} /></button>}
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {CHIPS.map((c) => (
            <button key={c.key} onClick={() => setFilter(c.key)}
              className={['flex-none h-9 px-3.5 rounded-full text-[12px] font-semibold shadow-sm', filter === c.key ? 'bg-brand text-white' : 'bg-white text-ink-2'].join(' ')}>
              {c.label}
            </button>
          ))}
          {geoBusy > 0 && (
            <span className="flex-none h-9 px-3 rounded-full bg-white shadow-sm text-[11px] text-ink-3 inline-flex items-center gap-1.5">
              <IconLoader2 size={13} className="animate-spin" /> หาพิกัด {geoBusy}
            </span>
          )}
        </div>
      </div>

      {/* floating buttons */}
      <button onClick={refit} className="absolute right-3 bottom-[42%] z-[500] size-11 rounded-full bg-white shadow-md grid place-items-center text-ink-2" title="จัดกึ่งกลางหมุด"><IconFocus2 size={19} /></button>
      <button onClick={locate} className="absolute right-3 bottom-[calc(42%+3.25rem)] z-[500] size-11 rounded-full bg-white shadow-md grid place-items-center text-brand" title="ตำแหน่งฉัน"><IconCurrentLocation size={19} /></button>

      {/* bottom sheet */}
      <div className="absolute inset-x-0 bottom-0 z-[500] bg-white rounded-t-[18px] shadow-[0_-6px_24px_rgba(10,20,40,.14)] max-h-[42%] flex flex-col">
        <div className="w-9 h-1 rounded-full mx-auto mt-2.5 mb-1.5 shrink-0" style={{ background: 'var(--color-line-2)' }} />
        {selected ? (
          <SelectedCard p={selected} dist={ref ? kmLabel(haversine(ref, coords[selected.id])) : null}
            onClose={() => setSelected(null)} onRelocate={() => { setSelected(null); setPlacing(selected) }} />
        ) : (
          <div className="overflow-y-auto px-3 pb-4">
            {/* places still without a pin — tap to place one */}
            {unplaced.length > 0 && (
              <div className="mb-3">
                <div className="text-[12px] font-bold text-[#D97706] px-1 mb-1">ยังไม่มีพิกัด · {unplaced.length} — แตะ “ปักหมุด”</div>
                {unplaced.slice(0, 12).map((p) => {
                  const meta = catMeta(p.category)
                  return (
                    <div key={p.id} className="flex items-center gap-3 py-1.5">
                      <span className="size-9 rounded-[9px] grid place-items-center shrink-0" style={{ background: meta.bg, color: meta.fg }}><meta.icon size={17} /></span>
                      <span className="text-[13px] font-medium truncate flex-1">{p.name}</span>
                      <button onClick={() => setPlacing(p)} className="shrink-0 h-8 px-3 rounded-full bg-brand text-white text-[11.5px] font-semibold inline-flex items-center gap-1"><IconMapPin size={13} /> ปักหมุด</button>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="text-[14px] font-bold px-1 mb-1.5">บนแผนที่ · {shown.length} ที่</div>
            {nearby.length === 0 ? (
              <div className="text-center text-[12.5px] text-ink-3 py-8 flex flex-col items-center gap-2">
                <IconMapPinOff size={24} /> ยังไม่มีสถานที่ที่มีพิกัดบนแผนที่
              </div>
            ) : nearby.map((p) => (
              <NearbyRow key={p.id} p={p} dist={ref ? kmLabel(haversine(ref, coords[p.id])) : null}
                onOpen={() => { setSelected(p); const c = coords[p.id]; mapRef.current?.setView([c.lat, c.lng], 15) }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NearbyRow({ p, dist, onOpen }: { p: Place; dist: string | null; onOpen: () => void }) {
  const meta = catMeta(p.category)
  const photo = httpPhoto(p)
  return (
    <button onClick={onOpen} className="w-full flex items-center gap-3 py-2 text-left">
      {photo ? <img src={photo} alt="" className="size-12 rounded-[11px] object-cover shrink-0" />
        : <span className="size-12 rounded-[11px] grid place-items-center shrink-0" style={{ background: meta.bg, color: meta.fg }}><meta.icon size={22} /></span>}
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-ink truncate">{p.name}</div>
        <div className="text-[11.5px] text-ink-3 mt-0.5 flex items-center gap-1.5">
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>
          {dist && <span className="text-brand font-bold">{dist}</span>}
        </div>
      </div>
      <span role="button" onClick={(e) => { e.stopPropagation(); openMap(p.map_url) }}
        className="shrink-0 size-10 rounded-[11px] bg-brand-soft text-brand grid place-items-center"><IconMapPin size={17} /></span>
    </button>
  )
}

function SelectedCard({ p, dist, onClose, onRelocate }: { p: Place; dist: string | null; onClose: () => void; onRelocate: () => void }) {
  const meta = catMeta(p.category)
  const photo = httpPhoto(p)
  return (
    <div className="px-4 pb-5 overflow-y-auto">
      <div className="flex items-start gap-3">
        {photo ? <img src={photo} alt="" className="size-16 rounded-[12px] object-cover shrink-0" />
          : <span className="size-16 rounded-[12px] grid place-items-center shrink-0" style={{ background: meta.bg, color: meta.fg }}><meta.icon size={26} /></span>}
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-bold text-ink leading-tight">{p.name}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11.5px]">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>
            {dist && <span className="text-brand font-bold">{dist}</span>}
          </div>
          {(p.station_line || p.station_name) && <div className="text-[11.5px] text-ink-3 mt-1 truncate">{p.station_line}{p.station_name ? ` · ${p.station_name}` : ''}</div>}
        </div>
        <button onClick={onClose} className="shrink-0 size-7 grid place-items-center rounded-full bg-surface-2 text-ink-3"><IconX size={15} /></button>
      </div>
      {p.note && <p className="text-[12.5px] text-ink-2 mt-2.5 leading-relaxed">{p.note}</p>}
      <div className="flex gap-2 mt-3">
        <button onClick={() => openMap(p.map_url)} className="btn-primary flex-1 h-11 flex items-center justify-center gap-1.5">
          <IconMapPin size={16} /> นำทาง
        </button>
        <button onClick={onRelocate} className="h-11 px-4 rounded-md text-[13px] font-medium text-ink-2 inline-flex items-center gap-1.5" style={{ border: '0.5px solid var(--color-line)' }}>
          <IconFocus2 size={15} /> ย้ายหมุด
        </button>
      </div>
    </div>
  )
}
