import { useRef, useState } from 'react'
import {
  IconId, IconQrcode, IconFileText, IconClipboardCheck, IconPaperclip,
  IconTrash, IconLoader2, IconExternalLink, IconPencil, IconTicket, IconX,
} from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { Avatar } from './Avatar'
import { supabase } from '@/lib/supabase'
import { uploadTravelerFile, isSampleFile, getSignedUrl } from '@/lib/files'
import { useTrip } from '@/contexts/TripContext'
import type { Traveler, TravelerFile, TravelerFileKind } from '@/lib/database.types'

export const KIND_META: Record<string, { label: string; icon: typeof IconId }> = {
  arrival_card: { label: 'Arrival card', icon: IconClipboardCheck },
  visa: { label: 'Visa', icon: IconFileText },
  passport: { label: 'พาสปอร์ต', icon: IconId },
  ticket: { label: 'ตั๋ว / QR', icon: IconQrcode },
  boarding_pass: { label: 'Boarding pass', icon: IconTicket },
  other: { label: 'อื่นๆ', icon: IconPaperclip },
}

// kinds that are typically a QR/barcode needed instantly at a gate/counter
const QUICK_KINDS = new Set(['ticket', 'boarding_pass'])

function isImage(path: string) {
  return /\.(png|jpe?g|webp|gif|heic)$/i.test(path)
}

export function TravelerDrawer({
  traveler, tripId, files, color, open, onClose, onEdit,
}: {
  traveler: Traveler | null
  tripId: string
  files: TravelerFile[]
  color?: string
  open: boolean
  onClose: () => void
  onEdit?: () => void
}) {
  const { reload } = useTrip()
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [uploadKind, setUploadKind] = useState<TravelerFileKind>('boarding_pass')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function openDoc(f: TravelerFile) {
    if (isSampleFile(f.storage_path)) {
      alert('นี่เป็นไฟล์ตัวอย่าง — อัปโหลดไฟล์จริง (รูป QR / Boarding pass) เพื่อเปิดดูเต็มจอ')
      return
    }
    setBusyId(f.id)
    const url = await getSignedUrl(f.storage_path)
    setBusyId(null)
    if (!url) return
    if (isImage(f.storage_path)) setLightbox(url)
    else window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !traveler) return
    setUploading(true)
    await uploadTravelerFile({ tripId, travelerId: traveler.id, kind: uploadKind, label: KIND_META[uploadKind].label, file })
    setUploading(false)
    if (fileInput.current) fileInput.current.value = ''
    await reload()
  }

  async function remove(f: TravelerFile) {
    if (!confirm('ลบไฟล์นี้?')) return
    if (!isSampleFile(f.storage_path)) await supabase.storage.from('trip-files').remove([f.storage_path])
    await supabase.from('traveler_files').delete().eq('id', f.id)
    await reload()
  }

  if (!traveler) return null
  const quick = files.filter((f) => QUICK_KINDS.has(f.kind ?? ''))

  return (
    <Drawer open={open} onClose={onClose} title="ข้อมูลผู้เดินทาง">
      <div className="flex items-center gap-3">
        <Avatar name={traveler.nickname} color={color} size={42} ring={false} />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-medium">{traveler.nickname}</div>
          {traveler.full_name && <div className="text-[12px] text-ink-3 truncate">{traveler.full_name}</div>}
        </div>
        {onEdit && <button onClick={onEdit} className="btn-icon !size-8" aria-label="แก้ไขข้อมูล"><IconPencil size={15} /></button>}
      </div>

      {/* Quick docs — instant access at immigration/gate */}
      <div className="flex items-center justify-between mt-5 mb-2">
        <span className="text-[12px] font-medium text-ink-2">เอกสารด่วน (QR)</span>
        <span className="text-[10px] text-ink-3">แตะเพื่อแสดงเต็มจอ</span>
      </div>
      {quick.length === 0 ? (
        <div className="card p-3 text-center text-[12px] text-ink-3">ยังไม่มี — แนบ Boarding pass / ตั๋ว QR ไว้เปิดเร็ว</div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {quick.map((f) => {
            const meta = KIND_META[f.kind ?? 'other'] ?? KIND_META.other
            return (
              <button key={f.id} onClick={() => openDoc(f)}
                className="card p-3 flex flex-col items-center gap-1.5 hover:bg-surface-2/50">
                <span className="size-9 rounded-md bg-brand-soft grid place-items-center text-brand-dark"><meta.icon size={18} /></span>
                <span className="text-[12px] font-medium text-center leading-tight">{f.label || meta.label}</span>
                {isSampleFile(f.storage_path) && <span className="text-[10px] text-ink-3">ตัวอย่าง</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* All attached files */}
      <div className="flex items-center justify-between mt-5 mb-2">
        <span className="text-[12px] font-medium text-ink-2">ไฟล์แนบทั้งหมด</span>
        <span className="text-[10px] text-ink-3">ลิงก์ชั่วคราว ~10 นาที</span>
      </div>
      {files.length === 0 ? (
        <div className="card p-4 text-center text-[12px] text-ink-3">ยังไม่มีไฟล์</div>
      ) : (
        <div className="space-y-1.5">
          {files.map((f) => {
            const meta = KIND_META[f.kind ?? 'other'] ?? KIND_META.other
            return (
              <div key={f.id} className="card flex items-center gap-3 p-3">
                <meta.icon size={18} className="text-ink-2 shrink-0" />
                <button onClick={() => openDoc(f)} className="flex-1 text-left text-[13px] hover:text-brand-mid">
                  {f.label || meta.label}
                  {isSampleFile(f.storage_path) && <span className="text-ink-3 text-[11px]"> · ตัวอย่าง</span>}
                </button>
                {busyId === f.id ? <IconLoader2 size={15} className="animate-spin text-ink-3" /> : <IconExternalLink size={15} className="text-ink-3" />}
                <button onClick={() => remove(f)} className="text-ink-3 hover:text-[#D85A30]"><IconTrash size={15} /></button>
              </div>
            )
          })}
        </div>
      )}

      {/* Upload */}
      <div className="flex items-center gap-2 mt-3">
        <select value={uploadKind} onChange={(e) => setUploadKind(e.target.value as TravelerFileKind)}
          className="hairline rounded-md text-[12px] h-9 px-2 bg-surface">
          {Object.entries(KIND_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
        <button onClick={() => fileInput.current?.click()} disabled={uploading} className="btn-link flex items-center gap-1.5 disabled:opacity-50">
          {uploading ? <IconLoader2 size={15} className="animate-spin" /> : <IconPaperclip size={15} />} แนบไฟล์
        </button>
        <input ref={fileInput} type="file" accept="image/*,application/pdf" hidden onChange={onPick} />
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[60] bg-black/80 grid place-items-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/90" aria-label="ปิด"><IconX size={24} /></button>
          <img src={lightbox} alt="" className="max-w-full max-h-[85dvh] rounded-lg bg-white" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </Drawer>
  )
}
