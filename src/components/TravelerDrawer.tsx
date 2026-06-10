import { useEffect, useRef, useState } from 'react'
import {
  IconId, IconQrcode, IconFileText, IconPlane, IconClipboardCheck, IconPaperclip,
  IconExternalLink, IconLoader2,
} from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { Avatar } from './Avatar'
import { supabase } from '@/lib/supabase'
import { getSignedUrl, uploadTravelerFile } from '@/lib/files'
import type { Traveler, TravelerFile, TravelerFileKind } from '@/lib/database.types'

const KIND_META: Record<string, { label: string; icon: typeof IconId }> = {
  passport: { label: 'พาสปอร์ต', icon: IconId },
  arrival_card: { label: 'Arrival card', icon: IconClipboardCheck },
  visa: { label: 'Visa', icon: IconFileText },
  ticket: { label: 'ตั๋ว / QR', icon: IconQrcode },
  other: { label: 'อื่นๆ', icon: IconPaperclip },
}

export function TravelerDrawer({
  traveler, tripId, open, onClose,
}: {
  traveler: Traveler | null
  tripId: string
  open: boolean
  onClose: () => void
}) {
  const [files, setFiles] = useState<TravelerFile[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploadKind, setUploadKind] = useState<TravelerFileKind>('arrival_card')

  useEffect(() => {
    if (!open || !traveler) return
    supabase
      .from('traveler_files')
      .select('*')
      .eq('traveler_id', traveler.id)
      .order('created_at')
      .then(({ data }) => setFiles((data ?? []) as TravelerFile[]))
  }, [open, traveler])

  async function viewFile(f: TravelerFile) {
    setBusyId(f.id)
    const url = await getSignedUrl(f.storage_path)
    setBusyId(null)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !traveler) return
    setUploading(true)
    const { error } = await uploadTravelerFile({
      tripId, travelerId: traveler.id, kind: uploadKind,
      label: KIND_META[uploadKind].label, file,
    })
    if (!error) {
      const { data } = await supabase
        .from('traveler_files').select('*').eq('traveler_id', traveler.id).order('created_at')
      setFiles((data ?? []) as TravelerFile[])
    }
    setUploading(false)
    if (fileInput.current) fileInput.current.value = ''
  }

  if (!traveler) return null
  const last4 = traveler.passport_last4

  return (
    <Drawer open={open} onClose={onClose} title="ข้อมูลผู้เดินทาง">
      <div className="flex items-center gap-3">
        <Avatar name={traveler.nickname} size={44} ring={false} />
        <div>
          <div className="text-[15px] font-medium">{traveler.full_name || traveler.nickname}</div>
          {traveler.nickname && traveler.full_name && (
            <div className="text-[12px] text-ink-3">{traveler.nickname}</div>
          )}
        </div>
      </div>

      {/* Passport quick reference */}
      <div className="card p-3 mt-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] text-ink-3">พาสปอร์ต (4 ตัวท้าย)</div>
          <div className="text-[15px] font-medium tracking-widest mt-0.5">
            {last4 ? `•••• •••• ${last4}` : '— ยังไม่ได้บันทึก'}
          </div>
        </div>
        <IconId size={22} className="text-ink-3" />
      </div>

      {/* Secret files — quick access at immigration */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-medium text-ink-2">ไฟล์ลับ</span>
          <span className="text-[10px] text-ink-3">เปิดผ่านลิงก์ชั่วคราว ~10 นาที</span>
        </div>

        {files.length === 0 ? (
          <div className="card p-4 text-center text-[12px] text-ink-3">
            ยังไม่มีไฟล์ — แนบ QR / Arrival card / Visa / พาสปอร์ต ไว้เปิดเร็วตอนผ่าน ตม.
          </div>
        ) : (
          <div className="space-y-1.5">
            {files.map((f) => {
              const meta = KIND_META[f.kind ?? 'other'] ?? KIND_META.other
              return (
                <button
                  key={f.id}
                  onClick={() => viewFile(f)}
                  className="card w-full flex items-center gap-3 p-3 text-left hover:bg-surface-2/50"
                >
                  <meta.icon size={18} className="text-ink-2 shrink-0" />
                  <span className="flex-1 text-[13px]">{f.label || meta.label}</span>
                  {busyId === f.id ? (
                    <IconLoader2 size={15} className="animate-spin text-ink-3" />
                  ) : (
                    <IconExternalLink size={15} className="text-ink-3" />
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Upload */}
        <div className="flex items-center gap-2 mt-3">
          <select
            value={uploadKind}
            onChange={(e) => setUploadKind(e.target.value as TravelerFileKind)}
            className="hairline rounded-md text-[12px] h-9 px-2 bg-surface"
          >
            {Object.entries(KIND_META).map(([k, m]) => (
              <option key={k} value={k}>{m.label}</option>
            ))}
          </select>
          <button
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="btn-link flex items-center gap-1.5 disabled:opacity-50"
          >
            {uploading ? <IconLoader2 size={15} className="animate-spin" /> : <IconPaperclip size={15} />}
            แนบไฟล์
          </button>
          <input ref={fileInput} type="file" accept="image/*,application/pdf" hidden onChange={onPick} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-[11px] text-ink-3">
        <IconPlane size={13} /> ไฟล์เก็บแบบส่วนตัว เปิดดูได้เฉพาะสมาชิกทริปนี้
      </div>
    </Drawer>
  )
}
