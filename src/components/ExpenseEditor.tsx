import { useEffect, useRef, useState } from 'react'
import { IconTrash, IconPaperclip, IconLoader2, IconCheck, IconReceipt2, IconUser, IconCoin, IconUsers, IconEye } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { uploadImage, getSignedUrl, isSampleFile } from '@/lib/files'
import { confirmDialog } from '@/lib/confirm'
import { toast } from '@/lib/toast'
import type { Expense } from '@/lib/database.types'
import type { ExpenseInput } from '@/lib/budgetMutations'

// Match StopEditor's "leading-icon fields inside one card" look: the icon says
// what the field is, everything fits one screen, no heavy text labels.
const iconField = 'hairline rounded-[9px] text-[13px] h-11 pl-9 pr-3 bg-surface w-full outline-none focus:border-brand'

function LeadIcon({ children }: { children: React.ReactNode }) {
  return <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none">{children}</span>
}

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
  const unit = trip?.currency?.trim() || 'บาท'

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
  const allOn = travelers.length > 0 && split.length === travelers.length
  function toggleAll() {
    setSplit(allOn ? [] : travelers.map((t) => t.id))
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
    if (isSampleFile(receipt)) { toast.info('สลิปตัวอย่าง — อัปโหลดสลิปจริงเพื่อเปิดดู'); return }
    if (/^https?:\/\//.test(receipt)) { window.open(receipt, '_blank', 'noopener,noreferrer'); return }
    const url = await getSignedUrl(receipt)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  const perHead = split.length && total ? Number(total) / split.length : 0

  async function save() {
    const nm = name.trim()
    if (!nm) { toast.error('กรุณาใส่ชื่อรายการ'); return }
    const amount = total.trim() ? Number(total) : null
    if (amount != null && (!Number.isFinite(amount) || amount < 0)) { toast.error('ยอดรวมต้องเป็นตัวเลขไม่ติดลบ'); return }
    setBusy(true)
    await onSave({ name: nm, payer_id: payer || null, total: amount, split_user_ids: split, receipt_path: receipt })
    setBusy(false)
    onClose()
  }
  async function del() {
    if (!onDelete || !(await confirmDialog({ message: 'ลบรายการนี้?', danger: true, confirmLabel: 'ลบ' }))) return
    setBusy(true); await onDelete(); setBusy(false); onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title={initial ? 'แก้ไขค่าใช้จ่าย' : 'เพิ่มค่าใช้จ่าย'}>
      <div className="space-y-3">
        {/* one card, leading-icon fields — mirrors the itinerary/place editors */}
        <div className="rounded-[13px] bg-surface p-3 space-y-2.5" style={{ border: '0.5px solid var(--color-line)' }}>
          {/* รายการ */}
          <div className="relative">
            <LeadIcon><IconReceipt2 size={15} /></LeadIcon>
            <input className={iconField} value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อรายการ เช่น มื้อค่ำ Haidilao" autoFocus />
          </div>

          {/* ใครจ่าย + ยอดรวม */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <LeadIcon><IconUser size={15} /></LeadIcon>
              <select className={`${iconField} appearance-none pr-7`} value={payer} onChange={(e) => setPayer(e.target.value)} aria-label="ใครจ่าย">
                {payerOptions.map((p) => <option key={p.id} value={p.id}>{p.nickname ?? 'ผู้ใช้'}</option>)}
              </select>
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none text-[10px]">▼</span>
            </div>
            <div className="relative flex-1 min-w-0">
              <LeadIcon><IconCoin size={15} /></LeadIcon>
              <input type="number" inputMode="decimal"
                className="hairline rounded-[9px] text-[15px] font-semibold tabular-nums h-11 pl-9 pr-12 bg-surface w-full outline-none focus:border-brand"
                value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0" aria-label="ยอดรวม" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-3 pointer-events-none">{unit}</span>
            </div>
          </div>

          {/* หารกับใคร */}
          <div className="rounded-[10px] p-2.5" style={{ background: 'var(--color-surface-2)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
                <IconUsers size={14} className="text-ink-3" /> หารกับใคร · {split.length} คน
              </div>
              {perHead > 0
                ? <span className="text-[12px] font-semibold text-brand-dark tabular-nums">{Math.round(perHead).toLocaleString('en-US')} {unit}/คน</span>
                : travelers.length > 0 && <button onClick={toggleAll} className="text-[11px] text-brand-mid font-medium">{allOn ? 'ไม่เลือกใคร' : 'เลือกทุกคน'}</button>}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {travelers.map((t) => {
                const on = split.includes(t.id)
                return (
                  <button key={t.id} onClick={() => toggleSplit(t.id)}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-full text-[12px] font-medium transition-colors"
                    style={on
                      ? { background: 'var(--color-brand)', color: '#fff' }
                      : { background: 'var(--color-surface)', color: 'var(--color-ink-2)', border: '0.5px solid var(--color-line)' }}>
                    {on && <IconCheck size={12} />} {t.nickname}
                  </button>
                )
              })}
            </div>
            {perHead > 0 && travelers.length > 0 && (
              <button onClick={toggleAll} className="text-[11px] text-brand-mid font-medium mt-2">{allOn ? 'ไม่เลือกใคร' : 'เลือกทุกคน'}</button>
            )}
          </div>

          {/* สลิป */}
          <div className="flex items-center gap-2">
            <button onClick={() => slipInput.current?.click()} disabled={uploading}
              className="flex-1 h-10 rounded-[9px] inline-flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-ink-2 disabled:opacity-50"
              style={{ border: '0.5px solid var(--color-line)', background: 'var(--color-surface)' }}>
              {uploading ? <IconLoader2 size={14} className="animate-spin" /> : <IconPaperclip size={14} />}
              {receipt ? 'เปลี่ยนสลิป' : 'แนบสลิป'}
            </button>
            {receipt && (
              <button onClick={viewSlip}
                className="h-10 px-3.5 rounded-[9px] inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-dark"
                style={{ border: '0.5px solid var(--color-brand-border)', background: 'var(--color-brand-soft)' }}>
                <IconEye size={14} /> ดูสลิป
              </button>
            )}
            <input ref={slipInput} type="file" accept="image/*,application/pdf" hidden onChange={onSlip} />
          </div>
        </div>

        <button onClick={save} disabled={busy || !name.trim()} className="btn-primary w-full h-11 disabled:opacity-50">
          {busy ? 'กำลังบันทึก...' : initial ? 'บันทึกการแก้ไข' : 'เพิ่มค่าใช้จ่าย'}
        </button>
        {initial && onDelete && (
          <button onClick={del} disabled={busy} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] text-[#D85A30]"><IconTrash size={15} /> ลบรายการ</button>
        )}
      </div>
    </Drawer>
  )
}
