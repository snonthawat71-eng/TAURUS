import { useEffect, useState } from 'react'
import {
  IconLoader2, IconRoute, IconBuildingStore, IconPencil, IconFlag, IconSend, IconHandStop,
} from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { addSuggestion } from '@/lib/exploreMutations'
import { toast } from '@/lib/toast'
import type { ExplorePlace, SuggestionKind } from '@/lib/database.types'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'
const area = 'hairline rounded-md text-[13px] px-3 py-2 bg-surface w-full outline-none focus:border-brand resize-none'

const KINDS: { key: SuggestionKind; label: string; icon: typeof IconRoute; desc: string }[] = [
  { key: 'route', label: 'เพิ่มเส้นทาง', icon: IconRoute, desc: 'มีอีกสาย/สถานีที่ไปได้' },
  { key: 'branch', label: 'เพิ่มสาขา', icon: IconBuildingStore, desc: 'มีสาขาใหม่ที่ยังไม่มี' },
  { key: 'edit', label: 'แก้ข้อมูล', icon: IconPencil, desc: 'ชื่อ/โน้ต/รูปไม่ตรง' },
  { key: 'report', label: 'รายงาน', icon: IconFlag, desc: 'ข้อมูลผิด/ปิดถาวร' },
]

const REPORT_REASONS = [
  { key: 'wrong', label: 'ข้อมูลผิด' },
  { key: 'closed', label: 'ปิดถาวร' },
  { key: 'duplicate', label: 'ซ้ำกับที่อื่น' },
  { key: 'other', label: 'อื่น ๆ' },
]

/**
 * Non-owners "raise a hand to help": propose an added route/branch, a general
 * edit, or report a problem on a place they didn't create. Stored as a pending
 * explore_suggestion; the owner reviews & accepts (or dismisses) in the detail.
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
  // shared fields (reused across kinds)
  const [line, setLine] = useState('')
  const [station, setStation] = useState('')
  const [label, setLabel] = useState('')
  const [mapUrl, setMapUrl] = useState('')
  const [name, setName] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [reason, setReason] = useState('wrong')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setKind('route'); setLine(''); setStation(''); setLabel(''); setMapUrl('')
    setName(''); setPhotoUrl(''); setReason('wrong'); setNote('')
  }, [open, place?.id])

  // enough info to submit?
  const ready =
    kind === 'route' ? !!(line.trim() || station.trim())
      : kind === 'branch' ? !!(label.trim() || mapUrl.trim())
        : kind === 'edit' ? !!(name.trim() || note.trim() || photoUrl.trim())
          : true // report — reason is always set

  async function submit() {
    if (!place || !user || !ready || busy) return
    setBusy(true)
    const payload: Record<string, unknown> =
      kind === 'route' ? { line: line.trim() || null, station: station.trim() || null }
        : kind === 'branch' ? { label: label.trim() || null, map_url: mapUrl.trim() || null, line: line.trim() || null, station: station.trim() || null }
          : kind === 'edit' ? { name: name.trim() || undefined, note: note.trim() || undefined, photo_url: photoUrl.trim() || undefined }
            : { reason }
    const authorName = profile?.nickname ?? user.email?.split('@')[0] ?? 'ผู้ใช้'
    const res = await addSuggestion({
      exploreId: place.id, userId: user.id, authorName, authorColor: profile?.avatar_color ?? null,
      kind, payload, note: note.trim() || null,
    })
    setBusy(false)
    if (res.error) {
      toast.error('ส่งไม่สำเร็จ — เจ้าของทริปยังไม่ได้รัน supabase/explore_suggestions.sql')
      return
    }
    onSubmitted?.()
    onClose()
    toast.success('ส่งให้เจ้าของแล้ว — รอเจ้าของกดรับ ขอบคุณที่ช่วยครับ 🙌')
  }

  return (
    <Drawer open={open} onClose={onClose} title="ช่วยแก้ / รายงาน">
      <div className="flex items-center gap-2 mb-3 text-[13px]">
        <IconHandStop size={15} className="text-brand shrink-0" />
        <span className="font-medium truncate">{place?.name}</span>
      </div>

      {/* pick what kind of help this is */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {KINDS.map((k) => {
          const Ic = k.icon
          const on = kind === k.key
          return (
            <button key={k.key} onClick={() => setKind(k.key)}
              className="rounded-[10px] p-2.5 text-left transition"
              style={on
                ? { background: 'var(--color-brand-soft)', border: '0.5px solid var(--color-brand-border)' }
                : { background: 'var(--color-surface)', border: '0.5px solid var(--color-line)' }}>
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
        {kind === 'route' && (
          <>
            <div><div className="text-[11px] text-ink-3 mb-1">สาย</div>
              <input className={field} value={line} onChange={(e) => setLine(e.target.value)} placeholder="เช่น BL Bannan Line" /></div>
            <div><div className="text-[11px] text-ink-3 mb-1">สถานี</div>
              <input className={field} value={station} onChange={(e) => setStation(e.target.value)} placeholder="เช่น Longshan Temple" /></div>
          </>
        )}

        {kind === 'branch' && (
          <>
            <div><div className="text-[11px] text-ink-3 mb-1">ชื่อสาขา</div>
              <input className={field} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="เช่น สาขาสีลม" /></div>
            <div><div className="text-[11px] text-ink-3 mb-1">ลิงก์แผนที่ (Google/AMap)</div>
              <input className={field} value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="วางลิงก์แผนที่ของสาขานี้" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><div className="text-[11px] text-ink-3 mb-1">สาย (ถ้ามี)</div>
                <input className={field} value={line} onChange={(e) => setLine(e.target.value)} placeholder="สาย" /></div>
              <div><div className="text-[11px] text-ink-3 mb-1">สถานี (ถ้ามี)</div>
                <input className={field} value={station} onChange={(e) => setStation(e.target.value)} placeholder="สถานี" /></div>
            </div>
          </>
        )}

        {kind === 'edit' && (
          <>
            <div><div className="text-[11px] text-ink-3 mb-1">ชื่อที่ถูกต้อง (ถ้าต้องแก้)</div>
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={place?.name ?? 'ชื่อสถานที่'} /></div>
            <div><div className="text-[11px] text-ink-3 mb-1">ลิงก์รูปที่ถูกต้อง (ถ้ามี)</div>
              <input className={field} value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="วาง URL รูป" /></div>
          </>
        )}

        {kind === 'report' && (
          <div><div className="text-[11px] text-ink-3 mb-1">เหตุผล</div>
            <div className="flex flex-wrap gap-1.5">
              {REPORT_REASONS.map((r) => (
                <button key={r.key} onClick={() => setReason(r.key)}
                  className={['chip', reason === r.key ? '!bg-brand-soft !text-brand-dark' : ''].join(' ')}
                  style={reason === r.key ? { border: '0.5px solid var(--color-brand-border)' } : undefined}>{r.label}</button>
              ))}
            </div>
          </div>
        )}

        <div><div className="text-[11px] text-ink-3 mb-1">{kind === 'report' ? 'รายละเอียดเพิ่มเติม' : 'โน้ตถึงเจ้าของ (ถ้ามี)'}</div>
          <textarea className={area} rows={3} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={kind === 'report' ? 'บอกเจ้าของว่าเกิดอะไรขึ้น' : 'อธิบายเพิ่มเติมให้เจ้าของเข้าใจ'} /></div>

        <button onClick={submit} disabled={!ready || busy}
          className="btn-primary w-full h-11 flex items-center justify-center gap-1.5 text-[13px] disabled:opacity-50">
          {busy ? <IconLoader2 size={16} className="animate-spin" /> : <IconSend size={16} />}
          ส่งให้เจ้าของรีวิว
        </button>
        <p className="text-[11px] text-ink-3 text-center">ข้อเสนอจะยังไม่เปลี่ยนข้อมูลจริง จนกว่าเจ้าของจะกดรับ</p>
      </div>
    </Drawer>
  )
}
