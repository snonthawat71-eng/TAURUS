import { useEffect, useState } from 'react'
import { IconTrash, IconCamera, IconLoader2 } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { Avatar } from './Avatar'
import { toHexColor } from '@/lib/avatars'
import { uploadPublicImage } from '@/lib/files'
import { confirmDialog } from '@/lib/confirm'
import type { Traveler } from '@/lib/database.types'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'

export function TravelerEditor({
  open, onClose, initial, defaultColor, onSave, onDelete,
}: {
  open: boolean
  onClose: () => void
  initial: Traveler | null
  defaultColor: string
  onSave: (fields: { nickname: string; full_name: string; avatar_color: string; avatar_url: string | null }) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [nickname, setNickname] = useState('')
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [color, setColor] = useState(toHexColor('av1')) // free-form hex
  const [photo, setPhoto] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setNickname(initial?.nickname ?? '')
      // split the stored full name back into first / last (first word = ชื่อจริง)
      const parts = (initial?.full_name ?? '').trim().split(/\s+/).filter(Boolean)
      setFirst(parts[0] ?? '')
      setLast(parts.slice(1).join(' '))
      setColor(toHexColor(initial?.avatar_color ?? defaultColor))
      setPhoto(initial?.avatar_url ?? null)
    }
  }, [open, initial, defaultColor])

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    const { url } = await uploadPublicImage(file)
    if (url) setPhoto(url)
    setUploading(false)
  }

  async function save() {
    const nick = nickname.trim()
    if (!nick) return
    setBusy(true)
    const fullName = [first.trim(), last.trim()].filter(Boolean).join(' ')
    await onSave({ nickname: nick, full_name: fullName, avatar_color: color, avatar_url: photo })
    setBusy(false)
    onClose()
  }

  async function del() {
    if (!onDelete || !(await confirmDialog({ message: 'ลบผู้เดินทางคนนี้?', danger: true, confirmLabel: 'ลบ' }))) return
    setBusy(true)
    await onDelete()
    setBusy(false)
    onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title={initial ? 'แก้ไขผู้เดินทาง' : 'เพิ่มผู้เดินทาง'}>
      <div className="flex flex-col items-center gap-3 mb-4">
        {/* tap the avatar to upload a photo (falls back to initials + colour) */}
        <label htmlFor="trav-photo-input" className="relative cursor-pointer" title="ใส่รูปโปรไฟล์">
          <Avatar name={nickname || '?'} color={color} photo={photo} size={72} ring={false} />
          <span className="absolute -bottom-0.5 -right-0.5 size-6 rounded-full grid place-items-center text-white"
            style={{ background: 'var(--color-brand)', border: '2px solid var(--color-surface)' }}>
            {uploading ? <IconLoader2 size={12} className="animate-spin" /> : <IconCamera size={12} />}
          </span>
        </label>
        <input id="trav-photo-input" type="file" accept="image/*" hidden onChange={onPickPhoto} />
        <div className="flex items-center gap-2">
          {/* single colour wheel — pick any colour */}
          <label className="flex items-center gap-2 cursor-pointer rounded-full pl-1.5 pr-3 h-9 bg-surface-2 text-[12px] font-medium text-ink-2"
            title="เลือกสีจากวงล้อสี">
            <span className="size-7 rounded-full grid place-items-center relative overflow-hidden shrink-0"
              style={{ background: 'conic-gradient(red, orange, yellow, lime, aqua, blue, magenta, red)' }}>
              <span className="size-4 rounded-full" style={{ background: color, boxShadow: '0 0 0 2px #fff' }} />
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
            </span>
            เลือกสีเอง
          </label>
          {photo && (
            <button onClick={() => setPhoto(null)} className="inline-flex items-center gap-1 text-[12px] text-[#D85A30] h-9 px-2">
              <IconTrash size={13} /> ลบรูป
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[11px] text-ink-3">ชื่อเล่น</label>
          <input className={field} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="เช่น Elf" />
        </div>
        {/* ชื่อจริง / นามสกุล แยกช่อง — ให้ตรงกับหน้าสร้างทริป */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-ink-3">ชื่อจริง</label>
            <input className={field} value={first} onChange={(e) => setFirst(e.target.value)} placeholder="เช่น Nuttaporn" />
          </div>
          <div>
            <label className="text-[11px] text-ink-3">นามสกุล</label>
            <input className={field} value={last} onChange={(e) => setLast(e.target.value)} placeholder="เช่น Saengthong" />
          </div>
        </div>
        <button onClick={save} disabled={busy || !nickname.trim()} className="btn-primary w-full h-10 disabled:opacity-50">
          {busy ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
        {initial && onDelete && (
          <button onClick={del} disabled={busy} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] text-[#D85A30]">
            <IconTrash size={15} /> ลบผู้เดินทาง
          </button>
        )}
      </div>
    </Drawer>
  )
}
