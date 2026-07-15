import { useEffect, useMemo, useRef, useState } from 'react'
import {
  IconLoader2, IconRoute, IconBuildingStore, IconPencil, IconFlag, IconSend, IconHandStop,
  IconCheck, IconLink, IconUpload, IconX,
} from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { Combobox, type ComboOption } from './Combobox'
import { ModePicker } from './ModePicker'
import { ColorPicker } from './ColorPicker'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { addSuggestion } from '@/lib/exploreMutations'
import { suggestionsFromText, findLine } from '@/lib/metro/suggest'
import { modeMeta } from '@/lib/transitModes'
import { nameFromMapUrl, resolveMapName, isMapLink } from '@/lib/geo'
import { uploadPublicImage } from '@/lib/files'
import { optimizeImageUrl } from '@/lib/cloudinary'
import { toast } from '@/lib/toast'
import type { ExplorePlace, ExploreRoute, PlaceBranch, SuggestionKind } from '@/lib/database.types'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'
const area = 'hairline rounded-md text-[13px] px-3 py-2 bg-surface w-full outline-none focus:border-brand resize-none'
const lbl = 'text-[11px] text-ink-3 mb-1'

function emptyRoute(): ExploreRoute { return { line: '', color: '#0270FB', station: '', mode: 'metro' } }
function emptyBranch(): PlaceBranch { return { label: '', map_url: '', line: '', color: '#185FA5', station: '' } }

const KINDS: { key: SuggestionKind; label: string; icon: typeof IconRoute; desc: string }[] = [
  { key: 'route', label: 'เพิ่มเส้นทาง', icon: IconRoute, desc: 'มีอีกสาย/สถานีที่ไปได้' },
  { key: 'branch', label: 'เพิ่มสาขา', icon: IconBuildingStore, desc: 'มีสาขาใหม่ที่ยังไม่มี' },
  { key: 'edit', label: 'แก้ข้อมูล', icon: IconPencil, desc: 'ชื่อ/รูปไม่ตรง' },
  { key: 'report', label: 'รายงาน', icon: IconFlag, desc: 'ข้อมูลผิด/ปิดถาวร' },
]
const REPORT_REASONS = [
  { key: 'wrong', label: 'ข้อมูลผิด' }, { key: 'closed', label: 'ปิดถาวร' },
  { key: 'duplicate', label: 'ซ้ำกับที่อื่น' }, { key: 'other', label: 'อื่น ๆ' },
]

/**
 * Non-owners "raise a hand to help": propose an added route/branch, a general
 * edit, or a report on a place they didn't create. Reuses the SAME building
 * blocks as the add/edit form — mode picker, line/station autocomplete scoped
 * to the place's city, colour picker, and paste-a-map-link → auto-fill.
 */
export function ExploreSuggestDialog({ place, open, onClose, onSubmitted }: {
  place: ExplorePlace | null
  open: boolean
  onClose: () => void
  onSubmitted?: () => void
}) {
  const { user } = useAuth()
  const { profile } = useTrip()
  const [kind, setKind] = useState<SuggestionKind>('route')
  const [busy, setBusy] = useState(false)

  const [route, setRoute] = useState<ExploreRoute>(emptyRoute())
  const [branch, setBranch] = useState<PlaceBranch>(emptyBranch())
  const [name, setName] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [editMapUrl, setEditMapUrl] = useState('')
  const [reason, setReason] = useState('wrong')
  const [note, setNote] = useState('')
  const [autoFilled, setAutoFilled] = useState(false)
  const [linkState, setLinkState] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle')
  const [uploading, setUploading] = useState(false)

  async function uploadFiles(files: FileList | File[]) {
    const file = Array.from(files)[0]
    if (!file || uploading) return
    setUploading(true)
    const { url } = await uploadPublicImage(file)
    if (url) setPhotoUrl(url); else toast.error('อัปโหลดรูปไม่สำเร็จ — ลองใหม่')
    setUploading(false)
  }

  useEffect(() => {
    if (!open) return
    setKind('route'); setRoute(emptyRoute()); setBranch(emptyBranch())
    setName(''); setPhotoUrl(''); setEditMapUrl(''); setReason('wrong'); setNote('')
    setAutoFilled(false); setLinkState('idle')
  }, [open, place?.id])
  useEffect(() => { setAutoFilled(false); setLinkState('idle') }, [kind])

  // built-in metro data scoped to THIS place's city/country (same as the editor)
  const metroSug = useMemo(() => suggestionsFromText(`${place?.country ?? ''} ${place?.city ?? ''}`), [place?.country, place?.city])
  const lineColorAll = useMemo(() => {
    const m: Record<string, string> = {}
    for (const l of metroSug.lines) m[l.name] = l.color
    return m
  }, [metroSug])
  const lineOptions = useMemo<ComboOption[]>(() => {
    const seen = new Set<string>(); const out: ComboOption[] = []
    for (const l of metroSug.lines) { const k = l.name.trim().toLowerCase(); if (l.name.trim() && !seen.has(k)) { seen.add(k); out.push({ value: l.name, color: l.color }) } }
    return out
  }, [metroSug])
  const allStationOptions = useMemo<ComboOption[]>(() => {
    const seen = new Set<string>(); const out: ComboOption[] = []
    for (const l of metroSug.lines) for (const s of l.stations) { const k = s.name.trim().toLowerCase(); if (s.name.trim() && !seen.has(k)) { seen.add(k); out.push({ value: s.name, label: s.num }) } }
    return out
  }, [metroSug])
  const stationOptionsFor = (line?: string | null) => {
    const known = findLine(metroSug, line ?? '')
    return known ? known.stations.map((s) => ({ value: s.name, label: s.num })) : allStationOptions
  }

  // paste a map link → auto-fill the name (edit) or branch label. Short links go
  // through /api/resolve-map; a hand-typed value is never overwritten.
  const linkUrl = kind === 'edit' ? editMapUrl : kind === 'branch' ? (branch.map_url ?? '') : ''
  const targetRef = useRef(''); targetRef.current = kind === 'edit' ? name : (branch.label ?? '')
  const autoRef = useRef(autoFilled); autoRef.current = autoFilled
  useEffect(() => {
    if (!open || (kind !== 'edit' && kind !== 'branch')) return
    let raw = linkUrl.trim()
    if (!raw) { setLinkState('idle'); return }
    if (!/^https?:\/\//i.test(raw)) {
      if (/^[\w-]+(\.[\w-]+)+\//.test(raw)) raw = `https://${raw}`
      else { setLinkState('idle'); return }
    }
    let stop = false
    const t = setTimeout(async () => {
      if (targetRef.current.trim() && !autoRef.current) { setLinkState('idle'); return }
      let got = nameFromMapUrl(raw)
      if (!got && isMapLink(raw)) { setLinkState('busy'); got = await resolveMapName(raw) }
      if (stop) return
      if (got) {
        if (kind === 'edit') setName(got); else setBranch((b) => ({ ...b, label: got as string }))
        setAutoFilled(true); setLinkState('ok')
      } else setLinkState('fail')
    }, 450)
    return () => { stop = true; clearTimeout(t) }
  }, [linkUrl, kind, open])

  const rm = modeMeta(route.mode)
  function setRouteMode(mode: string) {
    setRoute((r) => {
      const color = (!r.color || r.color === modeMeta(r.mode).color) ? modeMeta(mode).color : r.color
      return { ...r, mode, color }
    })
  }

  const ready =
    kind === 'route' ? !!(route.line?.trim() || route.station?.trim())
      : kind === 'branch' ? !!(branch.label?.trim() || branch.map_url?.trim())
        : kind === 'edit' ? !!(name.trim() || photoUrl.trim() || note.trim())
          : true

  async function submit() {
    if (!place || !user || !ready || busy) return
    setBusy(true)
    const payload: Record<string, unknown> =
      kind === 'route' ? { line: route.line?.trim() || null, color: route.color || null, station: route.station?.trim() || null, mode: route.mode }
        : kind === 'branch' ? { label: branch.label?.trim() || null, map_url: branch.map_url?.trim() || null, line: branch.line?.trim() || null, color: branch.color || null, station: branch.station?.trim() || null }
          : kind === 'edit' ? { name: name.trim() || undefined, photo_url: photoUrl.trim() || undefined, note: note.trim() || undefined }
            : { reason }
    const authorName = profile?.nickname ?? user.email?.split('@')[0] ?? 'ผู้ใช้'
    const res = await addSuggestion({
      exploreId: place.id, userId: user.id, authorName, authorColor: profile?.avatar_color ?? null,
      kind, payload, note: note.trim() || null,
    })
    setBusy(false)
    if (res.error) { toast.error('ส่งไม่สำเร็จ — เจ้าของทริปยังไม่ได้รัน supabase/explore_suggestions.sql'); return }
    onSubmitted?.()
    onClose()
    toast.success('ส่งให้เจ้าของแล้ว — รอเจ้าของกดรับ ขอบคุณที่ช่วยครับ 🙌')
  }

  const linkNote = (
    <>
      {linkState === 'busy' && <div className="flex items-center gap-1 mt-1 text-[10.5px] font-medium text-ink-3"><IconLoader2 size={12} className="animate-spin" /> กำลังอ่านชื่อจากลิงก์…</div>}
      {linkState === 'ok' && autoFilled && <div className="flex items-center gap-1 mt-1 text-[10.5px] font-medium" style={{ color: '#16A34A' }}><IconCheck size={12} /> เติมชื่อจากลิงก์ให้แล้ว — แก้ไขได้</div>}
      {linkState === 'fail' && <div className="mt-1 text-[10.5px] text-ink-3">อ่านชื่อจากลิงก์นี้ไม่ได้ — พิมพ์เองได้เลย</div>}
    </>
  )

  return (
    <Drawer open={open} onClose={onClose} title="ช่วยแก้ / รายงาน">
      <div className="flex items-center gap-2 mb-3 text-[13px]">
        <IconHandStop size={15} className="text-brand shrink-0" />
        <span className="font-medium truncate">{place?.name}</span>
      </div>

      {/* what kind of help */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {KINDS.map((k) => {
          const Ic = k.icon
          const on = kind === k.key
          return (
            <button key={k.key} onClick={() => setKind(k.key)} className="rounded-[10px] p-2.5 text-left transition"
              style={on ? { background: 'var(--color-brand-soft)', border: '0.5px solid var(--color-brand-border)' } : { background: 'var(--color-surface)', border: '0.5px solid var(--color-line)' }}>
              <div className="flex items-center gap-1.5">
                <Ic size={15} style={{ color: on ? 'var(--color-brand-mid)' : 'var(--color-ink-2)' }} />
                <span className="text-[13px] font-medium" style={on ? { color: 'var(--color-brand-dark)' } : undefined}>{k.label}</span>
              </div>
              <div className="text-[10.5px] text-ink-3 mt-0.5">{k.desc}</div>
            </button>
          )
        })}
      </div>

      <div className="space-y-2.5">
        {/* ── เพิ่มเส้นทาง — เหมือนฟอร์มเพิ่มสถานที่ (mode + สาย/สถานี autocomplete + สี) ── */}
        {kind === 'route' && (
          <div className="rounded-[10px] hairline p-2.5 space-y-2 bg-canvas">
            <ModePicker value={route.mode} onChange={setRouteMode} />
            <div className="grid grid-cols-2 gap-2">
              <Combobox className={field} value={route.line ?? ''} placeholder={rm.fields.line}
                options={rm.rail ? lineOptions : []}
                onChange={(v) => setRoute((r) => ({ ...r, line: v, ...(lineColorAll[v] ? { color: lineColorAll[v] } : {}) }))} />
              <Combobox className={field} value={route.station ?? ''} placeholder={rm.rail ? 'สถานี เช่น Namba' : rm.fields.to}
                options={rm.rail ? stationOptionsFor(route.line) : []}
                onChange={(v) => setRoute((r) => ({ ...r, station: v }))} />
            </div>
            {rm.rail && <ColorPicker value={route.color ?? '#185FA5'} onChange={(c) => setRoute((r) => ({ ...r, color: c }))} />}
          </div>
        )}

        {/* ── เพิ่มสาขา — วางลิงก์แผนที่ช่วยเติมชื่อสาขา + สาย/สถานี autocomplete ── */}
        {kind === 'branch' && (
          <div className="rounded-[10px] hairline p-2.5 space-y-2 bg-canvas">
            <div>
              <div className={lbl}><IconLink size={11} className="inline mr-1" />ลิงก์แผนที่ของสาขานี้</div>
              <input className={field} value={branch.map_url ?? ''} onChange={(e) => setBranch((b) => ({ ...b, map_url: e.target.value }))} placeholder="วางลิงก์ Google/AMap แล้วเราเติมชื่อให้" inputMode="url" />
              {linkNote}
            </div>
            <div>
              <div className={lbl}>ชื่อสาขา</div>
              <input className={field} value={branch.label ?? ''} onChange={(e) => { setBranch((b) => ({ ...b, label: e.target.value })); setAutoFilled(false) }} placeholder="เช่น สาขาสีลม" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Combobox className={field} value={branch.line ?? ''} placeholder="สาย (ถ้ามี)" options={lineOptions}
                onChange={(v) => setBranch((b) => ({ ...b, line: v, ...(lineColorAll[v] ? { color: lineColorAll[v] } : {}) }))} />
              <Combobox className={field} value={branch.station ?? ''} placeholder="สถานี (ถ้ามี)" options={stationOptionsFor(branch.line)}
                onChange={(v) => setBranch((b) => ({ ...b, station: v }))} />
            </div>
            <ColorPicker value={branch.color ?? '#185FA5'} onChange={(c) => setBranch((b) => ({ ...b, color: c }))} />
          </div>
        )}

        {/* ── แก้ข้อมูล — วางลิงก์ช่วยเติมชื่อ + รูป ── */}
        {kind === 'edit' && (
          <div className="space-y-2.5">
            <div>
              <div className={lbl}><IconLink size={11} className="inline mr-1" />ลิงก์แผนที่ (ช่วยเติมชื่อ)</div>
              <input className={field} value={editMapUrl} onChange={(e) => setEditMapUrl(e.target.value)} placeholder="https://maps... (ไม่ใส่ก็ได้)" inputMode="url" />
              {linkNote}
            </div>
            <div>
              <div className={lbl}>ชื่อที่ถูกต้อง</div>
              <input className={field} value={name} onChange={(e) => { setName(e.target.value); setAutoFilled(false) }} placeholder={place?.name ?? 'ชื่อสถานที่'} />
            </div>
            <div>
              <div className={lbl}>รูปที่ถูกต้อง (ถ้ามี)</div>
              {photoUrl ? (
                <div className="relative w-24 h-24 rounded-[10px] overflow-hidden bg-surface-2 hairline">
                  <img src={optimizeImageUrl(photoUrl, 300) ?? photoUrl} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setPhotoUrl('')} aria-label="ลบรูป"
                    className="absolute top-1 right-1 size-5 rounded-full bg-black/55 text-white grid place-items-center"><IconX size={11} /></button>
                </div>
              ) : (
                <label htmlFor="sug-photo-input" aria-disabled={uploading}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files) }}
                  className="block rounded-[12px] text-center py-5 px-3 cursor-pointer aria-disabled:opacity-50 aria-disabled:pointer-events-none [-webkit-tap-highlight-color:transparent]"
                  style={{ border: '1.5px dashed var(--color-line-2)', background: 'var(--color-canvas)' }}>
                  <span className="mx-auto mb-2 size-10 rounded-full bg-surface-2 grid place-items-center text-ink-2">
                    {uploading ? <IconLoader2 size={18} className="animate-spin" /> : <IconUpload size={18} />}
                  </span>
                  <span className="block text-[13px] font-semibold text-ink">ลากรูปมาวาง หรือแตะเพื่อเลือก</span>
                  <span className="block text-[11px] text-ink-3 mt-0.5">PNG · JPG · WebP</span>
                </label>
              )}
              <input id="sug-photo-input" type="file" accept="image/*" hidden
                onChange={(e) => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = '' }} />
              <input className={`${field} mt-2`} value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="หรือวาง URL รูป" inputMode="url" />
            </div>
          </div>
        )}

        {/* ── รายงาน ── */}
        {kind === 'report' && (
          <div>
            <div className={lbl}>เหตุผล</div>
            <div className="flex flex-wrap gap-1.5">
              {REPORT_REASONS.map((r) => (
                <button key={r.key} onClick={() => setReason(r.key)}
                  className={['chip', reason === r.key ? '!bg-brand-soft !text-brand-dark' : ''].join(' ')}
                  style={reason === r.key ? { border: '0.5px solid var(--color-brand-border)' } : undefined}>{r.label}</button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className={lbl}>{kind === 'report' ? 'รายละเอียดเพิ่มเติม' : 'โน้ตถึงเจ้าของ (ถ้ามี)'}</div>
          <textarea className={area} rows={3} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={kind === 'report' ? 'บอกเจ้าของว่าเกิดอะไรขึ้น' : 'อธิบายเพิ่มเติมให้เจ้าของเข้าใจ'} />
        </div>

        <button onClick={submit} disabled={!ready || busy}
          className="btn-primary w-full h-11 flex items-center justify-center gap-1.5 text-[13px] disabled:opacity-50">
          {busy ? <IconLoader2 size={16} className="animate-spin" /> : <IconSend size={16} />} ส่งให้เจ้าของรีวิว
        </button>
        <p className="text-[11px] text-ink-3 text-center">ข้อเสนอจะยังไม่เปลี่ยนข้อมูลจริง จนกว่าเจ้าของจะกดรับ</p>
      </div>
    </Drawer>
  )
}
