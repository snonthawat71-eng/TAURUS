import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { IconLoader2, IconCheck, IconExternalLink, IconMapPin, IconClipboard, IconRefresh } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { useTrip } from '@/contexts/TripContext'
import { setManualPin } from '@/lib/placeMutations'
import { lockExploreCoord } from '@/lib/exploreMutations'
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

/** Fix a place's wrong pin. Its ONE job: take the map link the user saved (the
 *  real place they got off Google/AMap) and resolve it back to the true
 *  coordinate. The link is ground truth — so we re-resolve it (retryable, since
 *  Google's redirect is non-deterministic), auto-pick the link-derived point,
 *  and let the user confirm. Manual paste / tap-the-map exist only as a fallback
 *  when the link genuinely can't be resolved. Locks the result (pinned) while
 *  keeping map_url intact for navigation, and propagates to Explore copies. */
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
  const [diag, setDiag] = useState('')
  const [diagBusy, setDiagBusy] = useState(false)

  /** Show exactly what the resolver gets back for this link — so a link that
   *  won't resolve is never a mystery. Google often blocks datacenter IPs on
   *  ?g_st=ic share links; this reveals the hop count / status / any address it
   *  did manage to read. */
  async function diagnose() {
    if (!place?.map_url) { setDiag('สถานที่นี้ไม่มีลิงก์แมพ'); return }
    setDiagBusy(true); setDiag('')
    try {
      const lg = localLang(trip?.country)
      const r = await fetch(`/api/resolve-map?url=${encodeURIComponent(place.map_url)}&debug=1&v=6${lg ? `&lang=${encodeURIComponent(lg)}` : ''}&fresh=${Date.now()}`)
      const j = await r.json()
      setDiag(JSON.stringify({ status: j.status, coords: j.coords ?? null, src: j.src ?? null, name: j.name ?? null, address: j.address ?? null, hops: j.hops, finalUrl: j.finalUrl, bodyLen: j.len, snippet: (j.snippet || '').slice(0, 240) }, null, 2))
    } catch (e) { setDiag('เรียก API ไม่ได้: ' + String((e as Error)?.message || e)) }
    setDiagBusy(false)
  }

  /** Resolve the saved link → real coordinate (+ address/name geocode as
   *  backups) and auto-select the link-derived point. `fresh` re-asks the
   *  resolver bypassing every cache — Google's redirect is flaky, so a retry
   *  often lands the coordinate the first pass missed. */
  async function search(fresh = false) {
    if (!place) return
    setLoading(true)
    if (fresh) { setCands([]); setSel(null); setSelSource('') }
    const c = await geoCandidates({ name: place.name, mapUrl: place.map_url, city: place.city, country: trip?.country, near: current, fresh })
    setCands(c)
    // auto-pick the most trustworthy point: the one straight from the user's
    // link, else a national-DB hit — so they can confirm without choosing
    const hero = c.find((x) => x.source === 'link') ?? c.find((x) => x.source === 'official')
    if (hero) { setSel({ lat: hero.lat, lng: hero.lng }); setSelSource(hero.source) }
    setLoading(false)
    if (fresh) {
      if (c.some((x) => x.source === 'link')) toast.success('เจอพิกัดจากลิงก์ของคุณแล้ว')
      else if (c.length) toast.success(`เจอ ${c.length} ตัวเลือก — เลือกด้านล่าง`)
      else toast.error('ยังหาพิกัดจากลิงก์ไม่ได้ — ลองอีกครั้ง หรือคัดลอกพิกัดเอง')
    }
  }

  // read the clipboard on tap (works after a user gesture over HTTPS) and feed
  // it straight through usePaste — one tap: copy a coordinate in Google Maps,
  // come back, tap "วางพิกัด".
  async function pasteFromClipboard() {
    try {
      const txt = (await navigator.clipboard.readText())?.trim()
      if (!txt) { toast.error('คลิปบอร์ดว่าง — คัดลอกพิกัดจาก Google Maps ก่อน'); return }
      setPaste(txt)
      await usePaste(txt)
    } catch { toast.error('อ่านคลิปบอร์ดไม่ได้ — วางในช่องเอง') }
  }

  async function usePaste(raw?: string) {
    const t = (raw ?? paste).trim()
    if (!t) return
    setPasteBusy(true)
    // 1) a bare "lat,lng" or an inline @lat,lng — the guaranteed path: use as-is
    let p = latLngFromUrl(t)
    // 2) a short / redirect map link that carries a coordinate — resolve it
    if (!p && isMapLink(t)) p = await resolveMapUrl(t, localLang(trip?.country))
    if (p) {
      setSel(p); setSelSource('manual'); setPaste('')
      mapRef.current?.setView([p.lat, p.lng], 16)
      setPasteBusy(false)
      return
    }
    // 3) the link has NO coordinate (e.g. an iOS ?g_st=ic share link) but may
    //    carry a name/address Google can geocode — run the full candidate
    //    search on THIS link and surface whatever it finds as choices
    if (/^https?:\/\//i.test(t)) {
      const more = await geoCandidates({ name: place?.name, mapUrl: t, city: place?.city, country: trip?.country, near: current })
      if (more.length) {
        setCands((prev) => {
          const merged = [...prev]
          for (const c of more) if (!merged.some((d) => d.source === c.source || distKm(d, c) < 0.04)) merged.push(c)
          return merged
        })
        setPaste(''); setPasteBusy(false)
        toast.success(`เจอ ${more.length} ตัวเลือกจากลิงก์ — เลือกด้านล่าง`)
        return
      }
    }
    setPasteBusy(false)
    toast.error('อ่านจากลิงก์ไม่ได้ — เปิดใน Google Maps กดค้างที่หมุด คัดลอกพิกัด (เช่น 25.13,121.75) มาวาง')
  }

  // resolve the link → coordinate the moment the dialog opens
  useEffect(() => {
    if (!open || !place) return
    setCands([]); setSel(null); setSelSource(''); setPaste('')
    search(false)
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
    const mapUrl = place.map_url ? undefined : `https://www.google.com/maps/search/?api=1&query=${sel.lat},${sel.lng}`
    await setManualPin(place.id, sel.lat, sel.lng, mapUrl)
    // one lock corrects this place EVERYWHERE — the Explore source + every copy
    // in every trip (all users), so nobody has to re-fix the same pin
    if (place.source_explore_id) await lockExploreCoord(place.source_explore_id, sel.lat, sel.lng)
    setBusy(false)
    onFixed(sel)
    toast.success('อัปเดตพิกัดแล้ว — ล็อกไว้ ระบบจะไม่ย้ายอีก')
    onClose()
  }

  // fallback reference only: open the EXACT place the user saved (their link) so
  // they can eyeball the real spot / long-press to copy its coordinate
  const gmapsUrl = place?.map_url
    ? place.map_url
    : place
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([place.name, place.city, trip?.country].filter(Boolean).join(' '))}`
    : '#'
  const gotLink = cands.some((c) => c.source === 'link')

  return (
    <Drawer open={open} onClose={onClose} title="ค้นหาพิกัดที่ถูกต้อง">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[13px]">
          <IconMapPin size={15} className="text-brand shrink-0" />
          <span className="font-medium truncate">{place?.name}</span>
        </div>

        {/* mini compare map */}
        <div ref={boxRef} className="w-full h-52 rounded-[12px] overflow-hidden" style={{ border: '0.5px solid var(--color-line)' }} />

        {/* HERO — re-resolve the user's saved link to its real coordinate */}
        <button onClick={() => search(true)} disabled={loading || busy} className="btn-primary w-full h-11 inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {loading
            ? <><IconLoader2 size={16} className="animate-spin" /> กำลังค้นหาพิกัดจากลิงก์…</>
            : <><IconRefresh size={16} /> ค้นหาพิกัดจากลิงก์อีกครั้ง</>}
        </button>
        {!loading && !gotLink && cands.length > 0 && (
          <div className="text-[11px] text-ink-3 -mt-1">ลิงก์ยังแกะพิกัดตรงๆ ไม่ได้ (Google ตอบไม่แน่นอน) — กดค้นอีกครั้ง หรือเลือกจากตัวเลือกด้านล่าง</div>
        )}

        {/* candidate list — tap to select (marker highlights on the map) */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-ink-3">ตัวเลือกพิกัด{loading && ' · กำลังค้นหา…'}</div>
          {loading && cands.length === 0 && (
            <div className="flex items-center gap-2 py-4 text-ink-3 text-[12.5px]"><IconLoader2 size={15} className="animate-spin" /> กำลังแกะพิกัดจากลิงก์ของคุณ…</div>
          )}
          {!loading && cands.length === 0 && (
            <div className="text-[12.5px] text-ink-3 py-2 leading-relaxed">
              ยังหาไม่เจอ — กด <span className="font-medium">“ค้นหาพิกัดจากลิงก์อีกครั้ง”</span> ด้านบน หรือแก้เองด้านล่าง
            </div>
          )}
          {cands.map((c, i) => {
            const on = !!sel && selSource === c.source && distKm(sel, c) < 0.01
            const away = current ? distKm(current, c) : 0
            const fromLink = c.source === 'link'
            return (
              <button key={c.source} onClick={() => { setSel({ lat: c.lat, lng: c.lng }); setSelSource(c.source) }}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-[10px] text-left transition-colors"
                style={on ? { background: 'var(--color-brand-soft)', border: '1px solid var(--color-brand-border)' } : { background: 'var(--color-surface-2)', border: '1px solid transparent' }}>
                <span className="size-6 rounded-full grid place-items-center text-[11px] font-bold text-white shrink-0" style={{ background: on ? '#0270FB' : fromLink ? '#0270FB' : '#135fd6' }}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium flex items-center gap-1.5">
                    {c.label}
                    {fromLink && <span className="text-[9.5px] font-semibold text-white px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-brand)' }}>ตรงลิงก์</span>}
                  </div>
                  <div className="text-[10.5px] text-ink-3 tabular-nums">{c.lat.toFixed(5)}, {c.lng.toFixed(5)}{away > 0.03 ? ` · ห่างจุดเดิม ${away < 1 ? `${Math.round(away * 1000)} ม.` : `${away.toFixed(1)} กม.`}` : ''}</div>
                </div>
                {on && <IconCheck size={16} className="text-brand shrink-0" />}
              </button>
            )
          })}
          {sel && selSource === 'manual' && (
            <div className="flex items-center gap-2 p-2.5 rounded-[10px]" style={{ background: 'var(--color-brand-soft)', border: '1px solid var(--color-brand-border)' }}>
              <span className="size-6 rounded-full grid place-items-center text-white shrink-0" style={{ background: '#0270FB' }}><IconCheck size={14} /></span>
              <div className="text-[12.5px] font-medium flex-1">ปักเอง (จุดที่แตะบนแมพ / วางพิกัด)</div>
            </div>
          )}
        </div>

        {/* FALLBACK — only if the link won't resolve: eyeball it & set by hand */}
        <details className="rounded-[12px] overflow-hidden" style={{ border: '0.5px solid var(--color-line)' }}>
          <summary className="list-none cursor-pointer select-none px-3 h-10 flex items-center text-[12px] font-medium text-ink-2" style={{ background: 'var(--color-surface-2)' }}>
            ยังไม่ถูก? แก้เอง
          </summary>
          <div className="p-3 space-y-2.5">
            <div className="text-[11.5px] text-ink-3 leading-relaxed">
              เปิดลิงก์สถานที่ดูจุดจริง → <span className="font-medium">กดค้าง</span>ที่หมุดเพื่อคัดลอกพิกัด → กลับมาแตะ “วางพิกัด” (หรือ<span className="font-medium">แตะบนแมพด้านบน</span>เพื่อปักเอง)
            </div>
            <div className="flex gap-2">
              <a href={gmapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex-1 h-10 rounded-[9px] text-[12.5px] font-medium text-brand-mid inline-flex items-center justify-center gap-1.5" style={{ border: '0.5px solid var(--color-brand-border)', background: 'var(--color-brand-soft)' }}>
                <IconExternalLink size={15} /> เปิดลิงก์สถานที่
              </a>
              <button onClick={pasteFromClipboard} disabled={pasteBusy}
                className="flex-1 h-10 rounded-[9px] text-[12.5px] font-medium text-brand-mid inline-flex items-center justify-center gap-1.5 disabled:opacity-50" style={{ border: '0.5px solid var(--color-brand-border)', background: 'var(--color-brand-soft)' }}>
                {pasteBusy ? <IconLoader2 size={14} className="animate-spin" /> : <><IconClipboard size={15} /> วางพิกัด</>}
              </button>
            </div>
            <div className="flex gap-2">
              <input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="หรือพิมพ์เอง 25.13,121.75"
                className="hairline rounded-[9px] text-[12px] h-9 px-3 bg-surface flex-1 min-w-0 outline-none focus:border-brand" inputMode="text" />
              <button onClick={() => usePaste()} disabled={pasteBusy || !paste.trim()}
                className="h-9 px-3.5 rounded-[9px] text-[12px] font-medium text-ink-2 shrink-0 inline-flex items-center gap-1 disabled:opacity-50" style={{ border: '0.5px solid var(--color-line)' }}>
                {pasteBusy ? <IconLoader2 size={14} className="animate-spin" /> : 'ใช้'}
              </button>
            </div>
          </div>
        </details>

        {/* diagnostics — reveals what the resolver actually reads from the link */}
        <details className="rounded-[12px] overflow-hidden" style={{ border: '0.5px solid var(--color-line)' }}>
          <summary className="list-none cursor-pointer select-none px-3 h-9 flex items-center text-[11.5px] font-medium text-ink-3" style={{ background: 'var(--color-surface-2)' }}>
            🛠 ตรวจสาเหตุ (debug)
          </summary>
          <div className="p-3 space-y-2">
            <button onClick={diagnose} disabled={diagBusy}
              className="h-9 px-3 rounded-[9px] text-[12px] font-medium text-ink-2 inline-flex items-center gap-1.5 disabled:opacity-50" style={{ border: '0.5px solid var(--color-line)' }}>
              {diagBusy ? <IconLoader2 size={14} className="animate-spin" /> : 'ดูว่าลิงก์ resolve ได้อะไร'}
            </button>
            {diag && (
              <pre className="text-[10px] leading-snug bg-surface rounded-[8px] p-2 overflow-x-auto whitespace-pre-wrap break-all" style={{ border: '0.5px solid var(--color-line)' }}>{diag}</pre>
            )}
          </div>
        </details>

        <button onClick={confirm} disabled={!sel || busy} className="btn-primary w-full h-11 disabled:opacity-50">
          {busy ? 'กำลังบันทึก…' : 'ยืนยันพิกัดนี้ · ล็อกไว้'}
        </button>
      </div>
    </Drawer>
  )
}
