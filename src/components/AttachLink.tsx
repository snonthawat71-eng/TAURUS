import { useRef, useState } from 'react'
import { IconPaperclip, IconLoader2, IconFileCheck, IconEye, IconRefresh, IconTrash } from '@tabler/icons-react'
import { uploadEntityFile, getSignedUrl, isSampleFile, removeEntityFile } from '@/lib/files'
import { confirmDialog } from '@/lib/confirm'
import { toast } from '@/lib/toast'
import { useTrip } from '@/contexts/TripContext'
import { PopMenu } from './PopMenu'

export function AttachLink({
  table, id, tripId, storagePath, attachLabel = 'แนบไฟล์จอง', viewLabel = 'ไฟล์จอง', canEdit = true,
}: {
  table: 'flights' | 'hotels' | 'trains'
  id: string
  tripId: string
  storagePath: string | null
  attachLabel?: string
  viewLabel?: string
  canEdit?: boolean
}) {
  const { reload } = useTrip()
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const hasFile = !!storagePath

  async function view() {
    if (isSampleFile(storagePath)) { toast.info('ไฟล์ตัวอย่าง — อัปโหลดไฟล์จริงเพื่อเปิดดู'); return }
    if (!storagePath) return
    setBusy(true)
    const url = await getSignedUrl(storagePath)
    setBusy(false)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    await uploadEntityFile({ table, id, tripId, file })
    setBusy(false)
    if (input.current) input.current.value = ''
    await reload()
  }
  async function del() {
    if (!storagePath || !(await confirmDialog({ message: 'ลบไฟล์จองนี้?', danger: true, confirmLabel: 'ลบ' }))) return
    setBusy(true)
    await removeEntityFile(table, id, storagePath)
    setBusy(false)
    await reload()
  }

  if (!canEdit && !hasFile) return null
  return (
    <span className="inline-flex items-center gap-1">
      {hasFile ? (
        <>
          <button onClick={view} disabled={busy} className="btn-link flex items-center gap-1 text-[12px] disabled:opacity-50">
            {busy ? <IconLoader2 size={14} className="animate-spin" /> : <IconFileCheck size={14} />} {viewLabel}
          </button>
          {canEdit && (
            <PopMenu size={24} items={[
              { label: 'เปิดดู', icon: <IconEye size={15} />, onClick: view },
              { label: 'เปลี่ยนไฟล์', icon: <IconRefresh size={15} />, onClick: () => input.current?.click() },
              { label: 'ลบไฟล์', icon: <IconTrash size={15} />, onClick: del, danger: true },
            ]} />
          )}
        </>
      ) : (
        <button onClick={() => input.current?.click()} disabled={busy} className="btn-link flex items-center gap-1 text-[12px] disabled:opacity-50">
          {busy ? <IconLoader2 size={14} className="animate-spin" /> : <IconPaperclip size={14} />} {attachLabel}
        </button>
      )}
      <input ref={input} type="file" accept="image/*,application/pdf" hidden onChange={onPick} />
    </span>
  )
}
