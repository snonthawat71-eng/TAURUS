import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { IconSearch, IconX, IconCurrentLocation, IconMapPin, IconMapPinOff, IconFocus2, IconLoader2, IconArrowLeft, IconListCheck } from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { catMeta } from '@/lib/placeMeta'
import { latLngFromUrl, latLngFromUrlExact, geocodeSmart, resolveMapUrl, resolveFailNote, resolvedLinkName, isMapLink, type LatLng, type GeoHit } from '@/lib/geo'
import { setPlaceCoords } from '@/lib/placeMutations'
import { openMap } from '@/lib/maps'
import { toast } from '@/lib/toast'
import type { Place } from '@/lib/database.types'

// Positron: Carto's most minimal base style — pale grey, minimal labels, so
// the photo pins stay the loudest thing on screen. (Chosen over Voyager/
// Dark/Esri/OSM in the live style test.)
const TILE = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const ATTR = '&copy; OpenStreetMap &copy; CARTO'

function haversine(a: LatLng, b: LatLng) {
  const R = 6371, toR = Math.PI / 180
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s)) // km
}
const kmLabel = (km: number) => (km < 1 ? `${Math.round(km * 1000)} ม.` : `${km.toFixed(1)} กม.`)

type MapPoint = { p: Place; c: LatLng }
type MapGroup = { type: 'point'; p: Place; c: LatLng } | { type: 'cluster'; lat: number; lng: number; items: MapPoint[] }

/** Greedy pixel-distance clustering: any points within `radiusPx` of each
 *  other on screen collapse into one numbered bubble. Re-run on zoom (pixel
 *  distances change with zoom level; lat/lng distances don't). */
function clusterPoints(map: L.Map, points: MapPoint[], radiusPx: number): MapGroup[] {
  const proj = points.map((pt) => ({ pt, sp: map.latLngToContainerPoint([pt.c.lat, pt.c.lng]) }))
  const used = new Array(proj.length).fill(false)
  const groups: MapGroup[] = []
  for (let i = 0; i < proj.length; i++) {
    if (used[i]) continue
    used[i] = true
    const bucket = [proj[i]]
    for (let j = i + 1; j < proj.length; j++) {
      if (used[j]) continue
      const dx = proj[i].sp.x - proj[j].sp.x, dy = proj[i].sp.y - proj[j].sp.y
      if (Math.sqrt(dx * dx + dy * dy) < radiusPx) { used[j] = true; bucket.push(proj[j]) }
    }
    if (bucket.length === 1) groups.push({ type: 'point', p: bucket[0].pt.p, c: bucket[0].pt.c })
    else groups.push({
      type: 'cluster',
      lat: bucket.reduce((s, g) => s + g.pt.c.lat, 0) / bucket.length,
      lng: bucket.reduce((s, g) => s + g.pt.c.lng, 0) / bucket.length,
      items: bucket.map((g) => g.pt),
    })
  }
  return groups
}
const httpPhoto = (p: Place) => {
  const u = p.photo_url || (p.photo_path && /^https?:\/\//.test(p.photo_path) ? p.photo_path : null)
  // Cloudinary: the same square crop the selected card's thumbnail uses.
  // (b_blurred padding 404'd outright on some stored photos — never again.)
  // Non-Cloudinary URLs (no /upload/ segment) are left untouched.
  return u ? u.replace('/upload/', '/upload/f_auto,q_auto,w_160,h_160,c_fill/') : null
}

export default function TripMap() {
  const { trip, places } = useTrip()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'all' | 'place' | 'food'>('all')
  const [query, setQuery] = useState('')
  const [coords, setCoords] = useState<Record<string, GeoHit>>({})
  const [showUnplaced, setShowUnplaced] = useState(false)
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
  // bumped on zoom so markers recluster — pixel distance between two points
  // changes with zoom even though their lat/lng doesn't
  const [zoomTick, setZoomTick] = useState(0)

  const tripPlaces = useMemo(() => places.filter((p) => p.name), [places])

  // Full-screen map: freeze the page behind it. Without this, dragging the map
  // rubber-bands the document and the browser's pull-to-refresh reloads the app.
  useEffect(() => {
    const html = document.documentElement, body = document.body
    const prev = {
      htmlOB: html.style.overscrollBehavior, bodyOB: body.style.overscrollBehavior,
      overflow: body.style.overflow, height: body.style.height,
    }
    html.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'none'
    body.style.overflow = 'hidden'
    body.style.height = '100%'
    return () => {
      html.style.overscrollBehavior = prev.htmlOB
      body.style.overscrollBehavior = prev.bodyOB
      body.style.overflow = prev.overflow
      body.style.height = prev.height
    }
  }, [])

  // ---- resolve coordinates (A: lat/lng col or map_url · C: geocode + cache) ----
  useEffect(() => {
    let alive = true
    const next: Record<string, GeoHit> = {}
    const missing: Place[] = []
    // a "แก้พิกัดให้แล้ว N จุด" toast once the healing passes settle
    let healed = 0
    let healTimer: ReturnType<typeof setTimeout> | undefined
    const reportHeal = () => {
      healed++
      clearTimeout(healTimer)
      healTimer = setTimeout(() => { if (alive) toast.success(`ปรับตำแหน่งหมุดให้ถูกต้องแล้ว ${healed} จุด`) }, 1800)
    }
    // stored coords that a link contradicts get healed: the map link is the
    // user's ground truth, stored values may be stale bad auto-geocodes (e.g.
    // Nominatim matching the WRONG BRANCH of a chain restaurant)
    const verify: { p: Place; db: LatLng }[] = []
    const verifyStation: Place[] = []
    for (const p of tripPlaces) {
      const exact = latLngFromUrlExact(p.map_url)
      if (typeof p.lat === 'number' && typeof p.lng === 'number') {
        const db = { lat: p.lat, lng: p.lng }
        if (exact) {
          // the link IS the pin — no tolerance window; stored values only
          // matter as a write-churn guard (>20m → persist the correction)
          next[p.id] = exact
          if (haversine(db, exact) > 0.02) {
            setPlaceCoords(p.id, exact.lat, exact.lng).catch(() => {})
            if (haversine(db, exact) > 0.05) reportHeal()
          }
        } else {
          next[p.id] = db
          // short links carry no inline coords — follow them server-side (cached)
          if (isMapLink(p.map_url)) verify.push({ p, db })
          // no usable link at all, but the user named a transit station —
          // sanity-check the stored point against it (wrong-branch geocodes)
          else if ((p.station_name ?? '').trim()) verifyStation.push(p)
        }
      } else {
        const fromUrl = exact ?? latLngFromUrl(p.map_url)
        if (fromUrl) next[p.id] = fromUrl
        else missing.push(p)
      }
    }
    setCoords(next)
    setGeoBusy(missing.length)
    const gotCoords = (p: Place, r: GeoHit | null) => {
      if (!alive) return
      setGeoBusy((n) => Math.max(0, n - 1))
      if (r) {
        setCoords((c) => ({ ...c, [p.id]: r }))
        // approximate (station stand-in) pins stay in-memory only — never
        // written to the DB as if they were the real spot
        if (!r.approx) setPlaceCoords(p.id, r.lat, r.lng).catch(() => {})
      }
    }
    // re-check stored coords against the place's own named station via the
    // branch-guarded geocoder; heal when they disagree strongly. nameOverride
    // lets a failed link resolution still contribute Google's canonical place
    // name as the search anchor.
    const stationSanity = async (p: Place, db: LatLng, nameOverride?: string) => {
      if (!(p.station_name ?? '').trim()) return
      const g = await geocodeSmart({ name: nameOverride ?? p.name, station: p.station_name, city: p.city, country: trip?.country })
      if (!alive || !g) return
      if (!g.approx && haversine(db, g) > 0.25) {
        setCoords((c) => ({ ...c, [p.id]: g }))
        setPlaceCoords(p.id, g.lat, g.lng).catch(() => {})
        reportHeal()
      } else if (g.approx && haversine(db, g) > 2) {
        // stored point is far from the user's own station and nothing better
        // exists — show the station stand-in (dashed), don't persist
        setCoords((c) => ({ ...c, [p.id]: g }))
        reportHeal()
      }
    }
    // background verification of short-linked places that already have coords
    ;(async () => {
      for (const { p, db } of verify) {
        if (!alive) return
        const r = await resolveMapUrl(p.map_url!) // cached per link after first hit
        if (!alive) return
        if (!r) {
          // no coords from the link — but its canonical Google NAME often came
          // back; geocode that (station-guarded) instead of giving up
          console.warn('[map] ตามลิงก์ไม่สำเร็จ:', p.name, p.map_url)
          await stationSanity(p, db, resolvedLinkName(p.map_url))
          continue
        }
        // the link's point IS the pin — no tolerance window
        setCoords((c) => ({ ...c, [p.id]: r }))
        if (haversine(db, r) > 0.02) {
          setPlaceCoords(p.id, r.lat, r.lng).catch(() => {})
          if (haversine(db, r) > 0.05) reportHeal()
        }
      }
    })()
    // background sanity-check of linkless places against their named station —
    // heals wrong-branch geocodes persisted before the guard existed
    ;(async () => {
      for (const p of verifyStation) {
        if (!alive) return
        await stationSanity(p, { lat: p.lat as number, lng: p.lng as number })
      }
    })()
    // A2) links (short google/amap) — resolve server-side, in parallel (fast)
    const links = missing.filter((p) => isMapLink(p.map_url))
    const queue = [...links]
    const worker = async () => {
      while (queue.length && alive) {
        const p = queue.shift()!
        const r = await resolveMapUrl(p.map_url!)
        // link dead-ends (expired short link etc.) fall through to geocoding
        if (r) gotCoords(p, r)
        else gotCoords(p, await geocodeSmart({ name: p.name, station: p.station_name, city: p.city, country: trip?.country }))
      }
    }
    Promise.all(Array.from({ length: 6 }, worker))
    // C) the rest — smart multi-step geocode (throttled inside geocodeSmart())
    ;(async () => {
      for (const p of missing.filter((p) => !isMapLink(p.map_url))) {
        if (!alive) return
        gotCoords(p, await geocodeSmart({ name: p.name, station: p.station_name, city: p.city, country: trip?.country }))
      }
    })()
    return () => { alive = false; clearTimeout(healTimer) }
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
    // tap the map: while pinning → set the place's location; otherwise → close
    // the open place card
    map.on('click', (e) => {
      const p = placingRef.current
      if (p) applyRef.current(p, { lat: e.latlng.lat, lng: e.latlng.lng })
      else setSelected(null)
    })
    map.on('zoomend', () => setZoomTick((n) => n + 1))
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // ---- (re)draw markers — circular photo pins, grouped into numbered
  // clusters where they'd otherwise overlap on screen ----
  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    const points: MapPoint[] = shown.map((p) => ({ p, c: coords[p.id] })).filter((pt): pt is MapPoint => !!pt.c)
    const groups = clusterPoints(map, points, 46)
    const pts: L.LatLngExpression[] = []
    for (const g of groups) {
      if (g.type === 'cluster') {
        const icon = L.divIcon({ className: '', iconSize: [44, 44], iconAnchor: [22, 22], html: `<div class="tcluster">${g.items.length}</div>` })
        const m = L.marker([g.lat, g.lng], { icon, zIndexOffset: 500 }).addTo(layer)
        // tapping a cluster zooms in just enough to fit its points — it
        // naturally breaks apart into individual pins as it does
        m.on('click', () => map.fitBounds(L.latLngBounds(g.items.map((it) => [it.c.lat, it.c.lng])).pad(0.4), { maxZoom: 18 }))
        g.items.forEach((it) => pts.push([it.c.lat, it.c.lng]))
        continue
      }
      const { p, c } = g
      const meta = catMeta(p.category)
      const photo = httpPhoto(p)
      // inline styles on the img — the pin then renders the photo exactly like
      // the card thumbnail regardless of any stale cached stylesheet
      const inner = photo
        ? `<img src="${photo}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/>`
        : `<div class="tpin-fallback" style="background:${meta.bg}"></div>`
      const icon = L.divIcon({
        className: '', iconSize: [48, 48], iconAnchor: [24, 24],
        html: `<div class="tpin ${selected?.id === p.id ? 'sel' : ''} ${coords[p.id]?.approx ? 'approx' : ''}" style="--c:${meta.fg}"><div class="tpin-b">${inner}</div></div>`,
      })
      const m = L.marker([c.lat, c.lng], { icon }).addTo(layer)
      m.on('click', () => { setSelected(p); map.panTo([c.lat, c.lng]) })
      pts.push([c.lat, c.lng])
    }
    // fit once when we first have points (avoid yanking the view on every geocode)
    if (pts.length && !fitted.current) { map.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 15 }); fitted.current = true }
  }, [shown, coords, selected, zoomTick])

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

  // Paste box accepts full links, bare coords AND short links (surl.amap.com,
  // maps.app.goo.gl) that carry no coords — those get resolved server-side.
  const [resolving, setResolving] = useState(false)
  async function usePasted(p: Place, text: string) {
    const direct = parsePasted(text)
    if (direct) { applyCoords(p, direct); return }
    const t = text.trim()
    if (isMapLink(t)) {
      setResolving(true)
      const r = await resolveMapUrl(t).finally(() => setResolving(false))
      if (r) { applyCoords(p, r); return }
    }
    toast.error('อ่านพิกัดจากที่วางไม่ได้ — ใช้ลิงก์ Google/AMap หรือพิมพ์ 22.30,114.17')
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

  // distances are measured from the user's location only — NOT the map centre,
  // so panning the map never re-renders the open card.
  const ref = me
  const unplaced = useMemo(() => tripPlaces.filter((p) => !coords[p.id]), [tripPlaces, coords])

  // ── trip-wide coordinate audit: sweep EVERY place, verify against its link
  // or named station, heal what it can, and report the rest — so nobody has to
  // eyeball pins one by one ─────────────────────────────────────────────────
  type AuditStatus = 'link' | 'station' | 'approx' | 'manualcheck' | 'nocoords'
  interface AuditRow { p: Place; status: AuditStatus; fixed: boolean; linkFailed?: boolean }
  const [audit, setAudit] = useState<{ running: boolean; done: number; total: number; rows: AuditRow[] } | null>(null)

  async function runAudit() {
    const list = tripPlaces
    const cur: Record<string, GeoHit | undefined> = { ...coords }
    const rows: AuditRow[] = []
    setSelected(null)
    setAudit({ running: true, done: 0, total: list.length, rows: [] })
    for (const p of list) {
      const prev = cur[p.id]
      // link points apply unconditionally (the link IS the pin); geocoded
      // points keep a 250m threshold so they can't churn a manual placement
      const apply = (c: GeoHit, persist: boolean, force: boolean) => {
        const moved = !prev || haversine(prev, c) > 0.05
        if (!force && prev && haversine(prev, c) <= 0.25) return false
        cur[p.id] = c
        setCoords((m) => ({ ...m, [p.id]: c }))
        if (persist && !c.approx && (!prev || haversine(prev, c) > 0.02)) setPlaceCoords(p.id, c.lat, c.lng).catch(() => {})
        return moved
      }
      let row: AuditRow
      const exact = latLngFromUrlExact(p.map_url)
      const hasLink = !exact && isMapLink(p.map_url)
      const resolved = hasLink ? await resolveMapUrl(p.map_url!) : null
      const linkFailed = hasLink && !resolved // surfaced in the panel — never silent
      if (exact) row = { p, status: 'link', fixed: apply(exact, true, true) }
      else if (resolved) row = { p, status: 'link', fixed: apply(resolved, true, true) }
      else if ((p.station_name ?? '').trim()) {
        const g = await geocodeSmart({ name: (linkFailed && resolvedLinkName(p.map_url)) || p.name, station: p.station_name, city: p.city, country: trip?.country })
        if (g && !g.approx) row = { p, status: 'station', fixed: apply(g, true, false), linkFailed }
        else if (g) row = { p, status: 'approx', fixed: apply({ ...g, approx: true }, false, false), linkFailed }
        else row = { p, status: prev ? 'manualcheck' : 'nocoords', fixed: false, linkFailed }
      } else row = { p, status: prev ? 'manualcheck' : 'nocoords', fixed: false, linkFailed }
      rows.push(row)
      setAudit({ running: true, done: rows.length, total: list.length, rows: [...rows] })
    }
    setAudit({ running: false, done: rows.length, total: list.length, rows })
  }

  const CHIPS: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'ทั้งหมด' }, { key: 'place', label: 'สถานที่' }, { key: 'food', label: 'อาหาร/คาเฟ่' },
  ]

  return (
    <div className="fixed inset-0 z-[400]">
      <div ref={boxRef} className="absolute inset-0" style={placing ? { cursor: 'crosshair' } : undefined} />

      {/* pinning banner — overlays the search while placing a pin */}
      {placing && (
        <div className="absolute inset-x-0 z-[600] px-3" style={{ top: 'calc(env(safe-area-inset-top,0px) + 10px)' }}>
          <div className="rounded-2xl bg-ink text-white p-3 shadow-xl">
            <div className="text-[12.5px] font-semibold flex items-center gap-1.5"><IconMapPin size={15} /> แตะบนแผนที่เพื่อวางหมุด: {placing.name}</div>
            <div className="flex gap-2 mt-2">
              <input value={linkText} onChange={(e) => setLinkText(e.target.value)} placeholder="หรือวางลิงก์ Google / AMap / พิกัด lat,lng"
                className="flex-1 h-9 rounded-md px-2.5 text-[12px] text-ink bg-white outline-none" />
              <button onClick={() => usePasted(placing, linkText)} disabled={resolving}
                className="h-9 px-3.5 rounded-md bg-brand text-white text-[12px] font-semibold shrink-0 inline-flex items-center gap-1 disabled:opacity-60">
                {resolving && <IconLoader2 size={13} className="animate-spin" />} ใช้
              </button>
            </div>
            <button onClick={() => { setPlacing(null); setLinkText('') }} className="mt-2 text-[11.5px] text-white/70">ยกเลิก</button>
          </div>
        </div>
      )}

      {/* top controls */}
      <div className={`absolute inset-x-0 z-[500] px-3 space-y-2 ${placing ? 'hidden' : ''}`} style={{ top: 'calc(env(safe-area-inset-top,0px) + 10px)' }}>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/places')} aria-label="กลับ"
            className="size-11 rounded-full bg-white shadow-md grid place-items-center text-ink shrink-0">
            <IconArrowLeft size={19} />
          </button>
          <div className="flex-1 flex items-center gap-2 h-11 rounded-full bg-white shadow-md px-4 min-w-0">
            <IconSearch size={17} className="text-ink-3" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาสถานที่ในทริป"
              className="flex-1 bg-transparent outline-none text-[13.5px] min-w-0" />
            {query && <button onClick={() => setQuery('')} className="text-ink-3"><IconX size={15} /></button>}
          </div>
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

      {/* floating buttons — right side, above the card zone */}
      <button onClick={refit} className="absolute right-3 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] z-[500] size-11 rounded-full bg-white shadow-md grid place-items-center text-ink-2" title="จัดกึ่งกลางหมุด"><IconFocus2 size={19} /></button>
      <button onClick={locate} className="absolute right-3 bottom-[calc(env(safe-area-inset-bottom,0px)+8.75rem)] z-[500] size-11 rounded-full bg-white shadow-md grid place-items-center text-brand" title="ตำแหน่งฉัน"><IconCurrentLocation size={19} /></button>
      {/* trip-wide pin audit — verify every place at once */}
      <button onClick={() => { if (audit?.running) return; if (audit) setAudit(null); else runAudit() }}
        className={['absolute right-3 bottom-[calc(env(safe-area-inset-bottom,0px)+12rem)] z-[500] size-11 rounded-full shadow-md grid place-items-center', audit ? 'bg-brand text-white' : 'bg-white text-ink-2'].join(' ')}
        title="ตรวจพิกัดทั้งทริป">
        {audit?.running ? <IconLoader2 size={19} className="animate-spin" /> : <IconListCheck size={19} />}
      </button>

      {/* audit result panel */}
      {audit && (
        <div className="absolute inset-x-0 bottom-0 z-[520] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
          <div className="rounded-[18px] bg-white shadow-[0_10px_34px_rgba(10,20,40,.22)] p-4 max-h-[55dvh] overflow-y-auto">
            <div className="flex items-center gap-2">
              <IconListCheck size={18} className="text-brand shrink-0" />
              <span className="text-[14.5px] font-bold flex-1">ตรวจพิกัดทั้งทริป</span>
              {!audit.running && <button onClick={() => setAudit(null)} aria-label="ปิด" className="size-7 grid place-items-center rounded-full bg-surface-2 text-ink-3"><IconX size={15} /></button>}
            </div>
            {audit.running ? (
              <div className="mt-3">
                <div className="text-[12.5px] text-ink-2">กำลังตรวจ {audit.done}/{audit.total} … (ตรวจกับลิงก์แมพ/สถานีของแต่ละที่)</div>
                <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div className="h-full bg-brand transition-all" style={{ width: `${audit.total ? (audit.done / audit.total) * 100 : 100}%` }} />
                </div>
              </div>
            ) : (() => {
              const fixed = audit.rows.filter((r) => r.fixed)
              const confirmed = audit.rows.filter((r) => !r.fixed && (r.status === 'link' || r.status === 'station'))
              const approx = audit.rows.filter((r) => r.status === 'approx')
              const manual = audit.rows.filter((r) => r.status === 'manualcheck' || r.status === 'nocoords')
              const linkFails = audit.rows.filter((r) => r.linkFailed)
              return (
                <div className="mt-2.5 space-y-3">
                  <div className="flex flex-wrap gap-1.5 text-[11.5px] font-semibold">
                    <span className="rounded-full px-2.5 py-1" style={{ background: '#E6F4EE', color: '#1E8E5A' }}>ยืนยันถูกต้อง {confirmed.length}</span>
                    {fixed.length > 0 && <span className="rounded-full px-2.5 py-1" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)' }}>แก้ให้แล้ว {fixed.length}</span>}
                    {approx.length > 0 && <span className="rounded-full px-2.5 py-1" style={{ background: '#FDF0E6', color: '#C56A1E' }}>โดยประมาณ {approx.length}</span>}
                    {manual.length > 0 && <span className="rounded-full px-2.5 py-1" style={{ background: '#FBECE9', color: '#C0432E' }}>ต้องยืนยันเอง {manual.length}</span>}
                  </div>
                  {fixed.length > 0 && (
                    <div>
                      <div className="text-[11.5px] font-bold text-ink-3 mb-1">ย้ายไปตำแหน่งที่ถูกต้องให้แล้ว</div>
                      {fixed.map((r) => <div key={r.p.id} className="text-[12.5px] py-0.5 truncate">✅ {r.p.name}</div>)}
                    </div>
                  )}
                  {approx.length > 0 && (
                    <div>
                      <div className="text-[11.5px] font-bold text-ink-3 mb-1">ปักไว้ที่สถานีโดยประมาณ (หมุดเส้นประ)</div>
                      {approx.map((r) => <div key={r.p.id} className="text-[12.5px] py-0.5 truncate">≈ {r.p.name} — {r.p.station_name}</div>)}
                    </div>
                  )}
                  {linkFails.length > 0 && (
                    <div>
                      <div className="text-[11.5px] font-bold mb-1" style={{ color: '#C0432E' }}>ตามลิงก์แมพไม่สำเร็จ (จะลองใหม่อัตโนมัติครั้งหน้า)</div>
                      {linkFails.map((r) => (
                        <div key={r.p.id} className="text-[12.5px] py-0.5 truncate">
                          🔗 {r.p.name}
                          {resolveFailNote(r.p.map_url) && <span className="text-[10.5px] text-ink-3"> — {resolveFailNote(r.p.map_url)}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {manual.length > 0 && (
                    <div>
                      <div className="text-[11.5px] font-bold text-ink-3 mb-1">ระบบยืนยันไม่ได้ — ไม่มีลิงก์แมพ/สถานีให้ยึด</div>
                      {manual.map((r) => (
                        <div key={r.p.id} className="flex items-center gap-2 py-1">
                          <span className="text-[12.5px] truncate flex-1">{r.p.name}</span>
                          <button onClick={() => { setAudit(null); setPlacing(r.p) }} className="shrink-0 h-7 px-2.5 rounded-full bg-brand text-white text-[11px] font-semibold inline-flex items-center gap-1"><IconMapPin size={12} /> ปักหมุด</button>
                        </div>
                      ))}
                      <div className="text-[11px] text-ink-3 mt-1.5">แนบ “ลิงก์แผนที่” ในหน้าแก้ไขของรายการเหล่านี้ แล้วระบบจะยืนยันให้อัตโนมัติตลอดไป</div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* places with no coordinates yet — one small pill, tap to expand */}
      {unplaced.length > 0 && !selected && !placing && !audit && (
        <div className="absolute left-3 right-16 bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] z-[500]">
          {showUnplaced && (
            <div className="mb-2 rounded-[15px] bg-white shadow-xl max-h-[45dvh] overflow-y-auto px-3 py-2">
              {unplaced.map((p) => {
                const meta = catMeta(p.category)
                return (
                  <div key={p.id} className="flex items-center gap-3 py-1.5">
                    <span className="size-9 rounded-[9px] grid place-items-center shrink-0" style={{ background: meta.bg, color: meta.fg }}><meta.icon size={17} /></span>
                    <span className="text-[13px] font-medium truncate flex-1">{p.name}</span>
                    <button onClick={() => { setShowUnplaced(false); setPlacing(p) }} className="shrink-0 h-8 px-3 rounded-full bg-brand text-white text-[11.5px] font-semibold inline-flex items-center gap-1"><IconMapPin size={13} /> ปักหมุด</button>
                  </div>
                )
              })}
            </div>
          )}
          <button onClick={() => setShowUnplaced((v) => !v)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-white shadow-md text-[12px] font-semibold text-ink">
            <IconMapPinOff size={15} style={{ color: '#D97706' }} /> ยังไม่มีพิกัด · {unplaced.length}
            {showUnplaced && <IconX size={13} className="text-ink-3" />}
          </button>
        </div>
      )}

      {/* tapping a pin opens its floating card; tap the map to dismiss */}
      {selected && coords[selected.id] && !audit && (
        <div className="absolute inset-x-0 bottom-0 z-[500] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
          <div className="rounded-[18px] bg-white shadow-[0_10px_34px_rgba(10,20,40,.22)] pt-4">
            <SelectedCard p={selected} dist={ref ? kmLabel(haversine(ref, coords[selected.id])) : null} approx={!!coords[selected.id]?.approx}
              onClose={() => setSelected(null)} onRelocate={() => { setSelected(null); setPlacing(selected) }} />
          </div>
        </div>
      )}
    </div>
  )
}

function SelectedCard({ p, dist, approx, onClose, onRelocate }: { p: Place; dist: string | null; approx?: boolean; onClose: () => void; onRelocate: () => void }) {
  const meta = catMeta(p.category)
  const photo = httpPhoto(p)
  return (
    <div className="px-4 pb-5 overflow-y-auto">
      <div className="flex items-start gap-3">
        {photo ? <img src={photo} alt="" className="size-16 rounded-[12px] object-cover shrink-0" />
          : <span className="size-16 rounded-[12px] grid place-items-center shrink-0" style={{ background: meta.bg, color: meta.fg }}><meta.icon size={26} /></span>}
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-bold text-ink leading-tight">{p.name}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11.5px] flex-wrap">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>
            {approx && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: '#FDF0E6', color: '#D97706' }}>ตำแหน่งโดยประมาณ (จากสถานี)</span>}
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
