import { useEffect, useRef, useState } from 'react'
import { IconTrash, IconPaperclip, IconLoader2, IconCheck } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { uploadImage, getSignedUrl, isSampleFile } from '@/lib/files'
import { baht } from '@/lib/format'
import type { Expense } from '@/lib/database.types'
import type { ExpenseInput } from '@/lib/budgetMutations'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'
const lbl = 'text-[11px] text-ink-3'

export function ExpenseEditor({
  open, onClose, initial, onSave, onDelete,
}: {
  open: boolean
  onClose: () => void
  initial: Expense | null
  onSave: (fields: ExpenseInput) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const { trip, travelers, memberProfiles } = useTrip()
  const { user } = useAuth()
  const payerOptions = memberProfiles.length ? memberProfiles : (user ? [{ id: user.id, nickname: 'ฉัน' }] : [])

  const [name, setName] = useState('')
  const [payer, setPayer] = useState('')
  const [total, setTotal] = useState('')
  const [split, setSplit] = useState<string[]>([])
  const [receipt, setReceipt] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const slipInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setPayer(initial?.payer_id ?? user?.id ?? '')
    setTotal(initial?.total != null ? String(initial.total) : '')
    setSplit(initial?.split_user_ids ?? travelers.map((t) => t.id))
    setReceipt(initial?.receipt_path ?? null)
  }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSplit(id: string) {
    setSplit((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  async function onSlip(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !trip) return
    setUploading(true)
    const { path } = await uploadImage(trip.id, 'receipt', file)
    if (path) setReceipt(path)
    setUploading(false)
    if (slipInput.current) slipInput.current.value = ''
  }
  async function viewSlip() {
    if (!receipt) return
    if (isSampleFile(receipt)) { alert('สลิปตัวอย่าง'); return }
    if (/^https?:\/\//.test(receipt)) { window.open(receipt, '_blank', 'noopener,noreferrer'); return }
    const url = await getSignedUrl(receipt)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  const perHead = split.length && total ? Number(total) / split.length : 0

  async function save() {
    setBusy(true)
    await onSave({ name, payer_id: payer || null, total: total ? Number(total) : null, split_user_ids: split, receipt_path: receipt })
    setBusy(false)
    onClose()
  }
  async function del() {
    if (!onDelete || !confirm('ลบรายการนี้?')) return
    setBusy(true); await onDelete(); setBusy(false); onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title={initial ? 'แก้ไขค่าใช้จ่าย' : 'เพิ่มค่าใช้จ่าย'}>
      <div className="space-y-3">
        <div><div className={lbl}>รายการ</div><input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น มื้อค่ำ Haidilao" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className={lbl}>ใครจ่าย</div>
            <select className={field} value={payer} onChange={(e) => setPayer(e.target.value)}>
              {payerOptions.map((p) => <option key={p.id} value={p.id}>{p.nickname ?? 'ผู้ใช้'}</option>)}
            </select>
          </div>
          <div><div className={lbl}>ยอดรวม (บาท)</div><input type="number" className={field} value={total} onChange={(e) => setTotal(e.target.value)} placeholder="4600" /></div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div className={lbl}>หารกับใคร ({split.length} คน)</div>
            {perHead > 0 && <span className="text-[11px] text-ink-3">≈ {baht(perHead)}/คน</span>}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {travelers.map((t) => {
              const on = split.includes(t.id)
              return (
                <button key={t.id} onClick={() => toggleSplit(t.id)}
                  className={['chip', on ? '!bg-brand-soft !text-brand-dark' : ''].join(' ')}
                  style={on ? { border: '0.5px solid var(--color-brand-border)' } : undefined}>
                  {on && <IconCheck size={12} />} {t.nickname}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => slipInput.current?.click()} disabled={uploading} className="btn-icon !w-auto px-3 gap-1.5 text-[12px] disabled:opacity-50">
            {uploading ? <IconLoader2 size={14} className="animate-spin" /> : <IconPaperclip size={14} />}
            {receipt ? 'เปลี่ยนสลิป' : 'แนบสลิป'}
          </button>
          {receipt && <button onClick={viewSlip} className="btn-link text-[12px]">ดูสลิป</button>}
          <input ref={slipInput} type="file" accept="image/*,application/pdf" hidden onChange={onSlip} />
        </div>

        <button onClick={save} disabled={busy || !name} className="btn-primary w-full h-10 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        {initial && onDelete && (
          <button onClick={del} disabled={busy} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] text-[#D85A30]"><IconTrash size={15} /> ลบรายการ</button>
        )}
      </div>
    </Drawer>
  )
}
