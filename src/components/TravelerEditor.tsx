import { useEffect, useState } from 'react'
import { IconTrash } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { Avatar } from './Avatar'
import { toHexColor } from '@/lib/avatars'
import type { Traveler } from '@/lib/database.types'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'

export function TravelerEditor({
  open, onClose, initial, defaultColor, onSave, onDelete,
}: {
  open: boolean
  onClose: () => void
  initial: Traveler | null
  defaultColor: string
  onSave: (fields: { nickname: string; full_name: string; avatar_color: string }) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [nickname, setNickname] = useState('')
  const [fullName, setFullName] = useState('')
  const [color, setColor] = useState(toHexColor('av1')) // free-form hex
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setNickname(initial?.nickname ?? '')
      setFullName(initial?.full_name ?? '')
      setColor(toHexColor(initial?.avatar_color ?? defaultColor))
    }
  }, [open, initial, defaultColor])

  async function save() {
    setBusy(true)
    await onSave({ nickname, full_name: fullName, avatar_color: color })
    setBusy(false)
    onClose()
  }

  async function del() {
    if (!onDelete || !confirm('ลบผู้เดินทางคนนี้?')) return
    setBusy(true)
    await onDelete()
    setBusy(false)
    onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title={initial ? 'แก้ไขผู้เดินทาง' : 'เพิ่มผู้เดินทาง'}>
      <div className="flex flex-col items-center gap-3 mb-4">
        <Avatar name={nickname || '?'} color={color} size={64} ring={false} />
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
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[11px] text-ink-3">ชื่อเล่น</label>
          <input className={field} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="เช่น Elf" />
        </div>
        <div>
          <label className="text-[11px] text-ink-3">ชื่อ-นามสกุล</label>
          <input className={field} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="เช่น Nuttaporn Saengthong" />
        </div>
        <button onClick={save} disabled={busy || !nickname} className="btn-primary w-full h-10 disabled:opacity-50">
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
