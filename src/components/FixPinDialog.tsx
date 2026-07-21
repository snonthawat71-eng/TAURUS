import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { IconLoader2, IconCheck, IconExternalLink, IconMapPin } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { useTrip } from '@/contexts/TripContext'
import { setManualPin } from '@/lib/placeMutations'
import { propagateExploreCoord } from '@/lib/exploreMutations'
import { geoCandidates, distKm, latLngFromUrl, isMapLink, resolveMapUrl, localLang, type GeoCandidate, type LatLng } from '@/lib/geo'
import { toast } from '@/lib/toast'
import type { Place } from '@/lib/database.types'

const TILE = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

function dot(color: string, label: string, ring = false) {
  return L.divIcon({
    className: '', iconSize: [26, 26], iconAnchor: [13, 13],
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35)${ring ? ',0 0 0 3px rgba(2,112,251,.3)' : ''};color:#fff;font-size:11px;font-weight:700;display:grid;place-items:center">${label}</div>`,
  })
}

/** Report-and-fix a place's pin: pulls candidate locations from every source at
 *  once and lets the user compare them on a mini map (or drop their own), then
 *  locks the chosen one (stamps map_url) and propagates to Explore copies. */
export function FixPinDialog({ place, current, open, onClose, onFixed }: {
  place: Place | null
  current: LatLng | null
  open: boolean
  onClose: () => void
  onFixed: (c: LatLng) => void
}) {
  const { trip } = useTrip()
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const [loading, setLoading] = useState(false)
  const [cands, setCands] = useState<GeoCandidate[]>([])
  const [sel, setSel] = useState<LatLng | null>(null)
  const [selSource, setSelSource] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [paste, setPaste] = useState('')
  const [pasteBusy, setPasteBusy] = useState(false)

  async function usePaste() {
    const t = paste.trim()
    if (!t) return
    setPasteBusy(true)
    let p = latLngFromUrl(t)
    if (!p && isMapLink(t)) p = await resolveMapUrl(t, localLang(trip?.country))
    setPasteBusy(false)
    if (p) { setSel(p); setSelSource('manual'); setPaste(''); mapRef.current?.setView([p.lat, p.lng], 16) }
    else toast.error('อ่านพิกัดจากที่วางไม่ได้ — ใช้ลิงก์ Google/AMap หรือพิมพ์ 22.30,114.17')
  }

  // gather candidates from all sources when opened
  useEffect(() => {
    if (!open || !place) return
    setCands([]); setSel(null); setSelSource(''); setLoading(true)
    geoCandidates({ name: place.name, mapUrl: place.map_url, city: place.city, country: trip?.country, near: current })
      .then((c) => { setCands(c); setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, place?.id])

  // init / teardown the mini map
  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(() => {
      if (!boxRef.current || mapRef.current) return
      const start = current ?? { lat: 13.7, lng: 100.5 }
      const map = L.map(boxRef.current, { zoomControl: true, attributionControl: false }).setView([start.lat, start.lng], 15)
      L.tileLayer(TILE, { maxZoom: 19, detectRetina: true }).addTo(map)
      layerRef.current = L.layerGroup().addTo(map)
      // tap the map to drop a custom pin (full-manual fallback)
      map.on('click', (e) => { setSel({ lat: e.latlng.lat, lng: e.latlng.lng }); setSelSource('manual') })
      mapRef.current = map
      setTimeout(() => map.invalidateSize(), 80)
    })
    return () => { cancelAnimationFrame(raf); mapRef.current?.remove(); mapRef.current = null }
  }, [open, current])

  // (re)draw markers on any change
  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    const pts: L.LatLngExpression[] = []
    if (current) { L.marker([current.lat, current.lng], { icon: dot('#8893a4', '•') }).addTo(layer); pts.push([current.lat, current.lng]) }
    cands.forEach((c, i) => {
      const isSel = !!sel && selSource === c.source && distKm(sel, c) < 0.01
      L.marker([c.lat, c.lng], { icon: dot(isSel ? '#0270FB' : '#135fd6', String(i + 1), isSel) })
        .addTo(layer).on('click', () => { setSel({ lat: c.lat, lng: c.lng }); setSelSource(c.source) })
      pts.push([c.lat, c.lng])
    })
    if (sel && selSource === 'manual') { L.marker([sel.lat, sel.lng], { icon: dot('#0270FB', '✓', true) }).addTo(layer); pts.push([sel.lat, sel.lng]) }
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.35), { maxZoom: 16 })
  }, [cands, sel, selSource, current])

  async function confirm() {
    if (!place || !sel) return
    setBusy(true)
    // keep the user's link for navigation; only stamp a coord URL if there's none
    const mapUrl = place.map_url ? undefined : `https://www.google.com/maps?q=${sel.lat},${sel.lng}`
    await setManualPin(place.id, sel.lat, sel.lng, mapUrl)
    if (place.source_explore_id) await propagateExploreCoord(place.source_explore_id, sel.lat, sel.lng)
    setBusy(false)
    onFixed(sel)
    toast.success('อัปเดตพิกัดแล้ว — ล็อกไว้ ระบบจะไม่ย้ายอีก')
    onClose()
  }

  const gmapsUrl = place
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([place.name, place.city, trip?.country].filter(Boolean).join(' '))}`
    : '#'

  return (
    <Drawer open={open} onClose={onClose} title="แก้พิกัดสถานที่">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[13px]">
          <IconMapPin size={15} className="text-brand shrink-0" />
          <span className="font-medium truncate">{place?.name}</span>
        </div>

        {/* mini compare map */}
        <div ref={boxRef} className="w-full h-52 rounded-[12px] overflow-hidden" style={{ border: '0.5px solid var(--color-line)' }} />

        <div className="flex items-center justify-between gap-2">
          <a href={gmapsUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-brand-mid">
            <IconExternalLink size={14} /> เปิดใน Google Maps เพื่อเทียบ
          </a>
        </div>

        {/* paste a corrected link / coords straight from Google */}
        <div className="flex gap-2">
          <input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="วางลิงก์ Google / AMap หรือพิกัด lat,lng"
            className="hairline rounded-[9px] text-[12.5px] h-10 px-3 bg-surface flex-1 min-w-0 outline-none focus:border-brand" inputMode="url" />
          <button onClick={usePaste} disabled={pasteBusy || !paste.trim()}
            className="h-10 px-3.5 rounded-[9px] text-[12.5px] font-medium text-ink-2 shrink-0 inline-flex items-center gap-1 disabled:opacity-50" style={{ border: '0.5px solid var(--color-line)' }}>
            {pasteBusy ? <IconLoader2 size={14} className="animate-spin" /> : 'ใช้'}
          </button>
        </div>

        {/* candidate list — tap to select (marker highlights on the map) */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-ink-3">เลือกตำแหน่งที่ถูกต้อง{loading && ' · กำลังค้นหา…'}</div>
          {loading && cands.length === 0 && (
            <div className="flex items-center gap-2 py-4 text-ink-3 text-[12.5px]"><IconLoader2 size={15} className="animate-spin" /> รวบรวมตัวเลือกจากหลายแหล่ง…</div>
          )}
          {!loading && cands.length === 0 && (
            <div className="text-[12.5px] text-ink-3 py-2">หาไม่เจอจากระบบ — แตะบนแมพด้านบนเพื่อปักเอง (เทียบกับ Google Maps ได้)</div>
          )}
          {cands.map((c, i) => {
            const on = !!sel && selSource === c.source && distKm(sel, c) < 0.01
            const away = current ? distKm(current, c) : 0
            return (
              <button key={c.source} onClick={() => { setSel({ lat: c.lat, lng: c.lng }); setSelSource(c.source) }}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-[10px] text-left transition-colors"
                style={on ? { background: 'var(--color-brand-soft)', border: '1px solid var(--color-brand-border)' } : { background: 'var(--color-surface-2)', border: '1px solid transparent' }}>
                <span className="size-6 rounded-full grid place-items-center text-[11px] font-bold text-white shrink-0" style={{ background: on ? '#0270FB' : '#135fd6' }}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium">{c.label}</div>
                  <div className="text-[10.5px] text-ink-3 tabular-nums">{c.lat.toFixed(5)}, {c.lng.toFixed(5)}{away > 0.03 ? ` · ห่างจุดเดิม ${away < 1 ? `${Math.round(away * 1000)} ม.` : `${away.toFixed(1)} กม.`}` : ''}</div>
                </div>
                {on && <IconCheck size={16} className="text-brand shrink-0" />}
              </button>
            )
          })}
          {sel && selSource === 'manual' && (
            <div className="flex items-center gap-2 p-2.5 rounded-[10px]" style={{ background: 'var(--color-brand-soft)', border: '1px solid var(--color-brand-border)' }}>
              <span className="size-6 rounded-full grid place-items-center text-white shrink-0" style={{ background: '#0270FB' }}><IconCheck size={14} /></span>
              <div className="text-[12.5px] font-medium flex-1">ปักเอง (จุดที่แตะบนแมพ)</div>
            </div>
          )}
        </div>

        <button onClick={confirm} disabled={!sel || busy} className="btn-primary w-full h-11 disabled:opacity-50">
          {busy ? 'กำลังบันทึก…' : 'ยืนยันพิกัดนี้ · ล็อกไว้'}
        </button>
      </div>
    </Drawer>
  )
}
