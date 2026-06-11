import { useRef, useState } from 'react'
import { IconPaperclip, IconLoader2, IconFileCheck } from '@tabler/icons-react'
import { uploadEntityFile, getSignedUrl, isSampleFile } from '@/lib/files'
import { useTrip } from '@/contexts/TripContext'

export function AttachLink({
  table, id, tripId, storagePath, attachLabel = 'แนบไฟล์จอง', viewLabel = 'ดูไฟล์จอง',
}: {
  table: 'flights' | 'hotels'
  id: string
  tripId: string
  storagePath: string | null
  attachLabel?: string
  viewLabel?: string
}) {
  const { reload } = useTrip()
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const hasFile = !!storagePath

  async function view() {
    if (isSampleFile(storagePath)) {
      alert('ไฟล์ตัวอย่าง — อัปโหลดไฟล์จริงเพื่อเปิดดู')
      return
    }
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

  return (
    <>
      <button
        onClick={() => (hasFile ? view() : input.current?.click())}
        disabled={busy}
        className="btn-link flex items-center gap-1 text-[12px] disabled:opacity-50"
      >
        {busy ? <IconLoader2 size={14} className="animate-spin" /> : hasFile ? <IconFileCheck size={14} /> : <IconPaperclip size={14} />}
        {hasFile ? viewLabel : attachLabel}
      </button>
      <input ref={input} type="file" accept="image/*,application/pdf" hidden onChange={onPick} />
    </>
  )
}
