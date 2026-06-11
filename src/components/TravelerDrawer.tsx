import { useEffect, useRef, useState } from 'react'
import {
  IconId, IconQrcode, IconFileText, IconClipboardCheck, IconPaperclip,
  IconTrash, IconLoader2, IconPencil, IconTicket, IconX, IconPlane,
  IconShieldCheck, IconBuildingCastle, IconBuildingCarousel, IconZoomScan, IconPlus,
} from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { Avatar } from './Avatar'
import { supabase } from '@/lib/supabase'
import { uploadTravelerFile, isSampleFile, getSignedUrl } from '@/lib/files'
import { useTrip } from '@/contexts/TripContext'
import type { Traveler, TravelerFile, TravelerFileKind } from '@/lib/database.types'

export const KIND_META: Record<string, { label: string; icon: typeof IconId }> = {
  arrival_card: { label: 'Arrival Card', icon: IconClipboardCheck },
  visa: { label: 'Visa', icon: IconFileText },
  passport: { label: 'พาสปอร์ต', icon: IconId },
  ticket: { label: 'QR / ตั๋ว', icon: IconQrcode },
  boarding_pass: { label: 'Boarding pass', icon: IconTicket },
  flight_ticket: { label: 'Flight Ticket', icon: IconPlane },
  travel_insurance: { label: 'Travel Insurance', icon: IconShieldCheck },
  admission_ticket: { label: 'Admission Ticket', icon: IconTicket },
  disney: { label: 'Disney Land', icon: IconBuildingCastle },
  universal: { label: 'Universal Studio', icon: IconBuildingCarousel },
  other: { label: 'อื่นๆ', icon: IconPaperclip },
}

// dropdown options for the "attached files" uploader
const ATTACH_KINDS = ['arrival_card', 'visa', 'flight_ticket', 'travel_insurance', 'admission_ticket', 'disney', 'universal', 'other']
const QUICK_KINDS = new Set(['ticket', 'boarding_pass'])

function isImage(path: string) {
  return /\.(png|jpe?g|webp|gif|heic)$/i.test(path)
}

/** Quick QR tile — renders the actual image so it can be scanned at a glance. */
function QrTile({ file, onOpen }: { file: TravelerFile; onOpen: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const sample = isSampleFile(file.storage_path)
  useEffect(() => {
    let active = true
    if (!sample && isImage(file.storage_path)) getSignedUrl(file.storage_path).then((u) => active && setUrl(u))
    return () => { active = false }
  }, [file.storage_path, sample])

  return (
    <button onClick={() => (url ? onOpen(url) : alert('นี่เป็นตัวอย่าง — อัปโหลด QR จริงเพื่อแสดงเต็มจอ'))}
      className="card overflow-hidden text-left">
      <div className="aspect-square bg-surface-2 grid place-items-center">
        {url ? <img src={url} alt={file.label ?? ''} className="w-full h-full object-contain bg-white" />
          : <IconQrcode size={40} className="text-ink-3" />}
      </div>
      <div className="px-2.5 py-1.5 text-[11px] font-medium truncate">{file.label || 'QR'}{sample && ' · ตัวอย่าง'}</div>
    </button>
  )
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
  const [uploadKind, setUploadKind] = useState<string>('arrival_card')
  const [customLabel, setCustomLabel] = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const qrInput = useRef<HTMLInputElement>(null)

  async function openDoc(f: TravelerFile) {
    if (isSampleFile(f.storage_path)) { alert('นี่เป็นไฟล์ตัวอย่าง — อัปโหลดไฟล์จริงเพื่อเปิดดู'); return }
    const url = await getSignedUrl(f.storage_path)
    if (!url) return
    if (isImage(f.storage_path)) setLightbox(url)
    else window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function uploadFile(kind: TravelerFileKind, label: string, file: File) {
    setUploading(true)
    await uploadTravelerFile({ tripId, travelerId: traveler!.id, kind, label, file })
    setUploading(false)
    await reload()
  }
  async function onPickAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !traveler) return
    const label = uploadKind === 'other' ? (customLabel.trim() || 'อื่นๆ') : KIND_META[uploadKind].label
    await uploadFile(uploadKind as TravelerFileKind, label, file)
    if (fileInput.current) fileInput.current.value = ''
    setCustomLabel('')
  }
  async function onPickQr(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !traveler) return
    await uploadFile('ticket', 'QR', file)
    if (qrInput.current) qrInput.current.value = ''
  }
  async function remove(f: TravelerFile) {
    if (!confirm('ลบไฟล์นี้?')) return
    if (!isSampleFile(f.storage_path)) await supabase.storage.from('trip-files').remove([f.storage_path])
    await supabase.from('traveler_files').delete().eq('id', f.id)
    await reload()
  }

  if (!traveler) return null
  const quick = files.filter((f) => QUICK_KINDS.has(f.kind ?? ''))
  const attached = files.filter((f) => !QUICK_KINDS.has(f.kind ?? ''))

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

      {/* Quick QR — shown as images for instant scanning */}
      <div className="flex items-center justify-between mt-5 mb-1.5">
        <span className="text-[12px] font-medium text-ink-2">QR Code · เอกสารด่วน</span>
        <button onClick={() => qrInput.current?.click()} disabled={uploading} className="btn-link flex items-center gap-1 text-[12px] disabled:opacity-50">
          {uploading ? <IconLoader2 size={13} className="animate-spin" /> : <IconPlus size={13} />} อัปโหลด QR
        </button>
      </div>
      <div className="flex items-center gap-1 text-[11px] text-ink-3 mb-2"><IconZoomScan size={13} /> แตะเพื่อแสดงเต็มจอ</div>
      {quick.length === 0 ? (
        <div className="card p-3 text-center text-[12px] text-ink-3">ยังไม่มี QR — กด "อัปโหลด QR" เพื่อเพิ่ม</div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {quick.map((f) => <QrTile key={f.id} file={f} onOpen={setLightbox} />)}
        </div>
      )}
      <input ref={qrInput} type="file" accept="image/*" hidden onChange={onPickQr} />

      {/* Attached files */}
      <div className="flex items-center justify-between mt-5 mb-2">
        <span className="text-[12px] font-medium text-ink-2">ไฟล์แนบ · Attachments</span>
        <span className="text-[10px] text-ink-3">ลิงก์ชั่วคราว ~10 นาที</span>
      </div>
      {attached.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {attached.map((f) => {
            const meta = KIND_META[f.kind ?? 'other'] ?? KIND_META.other
            return (
              <div key={f.id} className="card flex items-center gap-3 p-3">
                <meta.icon size={18} className="text-ink-2 shrink-0" />
                <button onClick={() => openDoc(f)} className="flex-1 text-left text-[13px] hover:text-brand-mid truncate">
                  {f.label || meta.label}{isSampleFile(f.storage_path) && <span className="text-ink-3 text-[11px]"> · ตัวอย่าง</span>}
                </button>
                <button onClick={() => remove(f)} className="text-ink-3 hover:text-[#D85A30]"><IconTrash size={15} /></button>
              </div>
            )
          })}
        </div>
      )}

      {/* Attached uploader (dropdown) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <select value={uploadKind} onChange={(e) => setUploadKind(e.target.value)} className="hairline rounded-md text-[12px] h-9 px-2 bg-surface flex-1">
            {ATTACH_KINDS.map((k) => <option key={k} value={k}>{KIND_META[k].label}</option>)}
          </select>
          <button onClick={() => fileInput.current?.click()} disabled={uploading || (uploadKind === 'other' && !customLabel.trim())}
            className="btn-icon !w-auto px-3 gap-1.5 text-[12px] disabled:opacity-50">
            {uploading ? <IconLoader2 size={14} className="animate-spin" /> : <IconPaperclip size={14} />} แนบไฟล์
          </button>
        </div>
        {uploadKind === 'other' && (
          <input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="ระบุชื่อเอกสาร"
            className="hairline rounded-md text-[13px] h-9 px-3 bg-surface w-full outline-none focus:border-brand" />
        )}
        <input ref={fileInput} type="file" accept="image/*,application/pdf" hidden onChange={onPickAttach} />
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
