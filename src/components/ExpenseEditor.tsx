import { useEffect, useRef, useState } from 'react'
import { IconTrash, IconPaperclip, IconLoader2, IconCheck, IconReceipt2, IconUsers, IconEye, IconScan, IconChevronDown } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { uploadImage, getSignedUrl, isSampleFile } from '@/lib/files'
import { confirmDialog } from '@/lib/confirm'
import { toast } from '@/lib/toast'
import { EXPENSE_CATS } from '@/lib/expenseMeta'
import { CURRENCIES } from '@/lib/fx'
import { scanReceipt } from '@/lib/receiptScan'
import { tripCurrency } from '@/lib/segments'
import type { Expense } from '@/lib/database.types'
import type { ExpenseInput } from '@/lib/budgetMutations'

// Same look as the place/hotel editors: one bordered card, leading-icon inputs.
const iconField = 'hairline rounded-[9px] text-[13px] h-11 pl-9 pr-3 bg-surface w-full outline-none focus:border-brand'

function LeadIcon({ children }: { children: React.ReactNode }) {
  return <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none">{children}</span>
}

const symbolOf = (code: string) => code === 'THB' ? '฿' : (CURRENCIES.find((c) => c.code === code)?.symbol ?? code)

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
  const [cat, setCat] = useState<string | null>(null)
  const [payer, setPayer] = useState('')
  const [total, setTotal] = useState('')
  const [currency, setCurrency] = useState('THB')
  const [split, setSplit] = useState<string[]>([])
  const [receipt, setReceipt] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)
  const slipInput = useRef<HTMLInputElement>(null)
  const scanInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setCat(initial?.category ?? null)
    setPayer(initial?.payer_id ?? user?.id ?? '')
    setTotal(initial?.total != null ? String(initial.total) : '')
    setCurrency(initial?.currency ?? (initial ? 'THB' : (tripCurrency(trip) ?? 'THB')))
    setSplit(initial?.split_user_ids ?? travelers.map((t) => t.id))
    setReceipt(initial?.receipt_path ?? null)
  }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSplit(id: string) {
    setSplit((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }
  const allOn = travelers.length > 0 && split.length === travelers.length
  const toggleAll = () => setSplit(allOn ? [] : travelers.map((t) => t.id))

  async function onSlip(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !trip) return
    setUploading(true)
    const { path } = await uploadImage(trip.id, 'receipt', file)
    if (path) setReceipt(path)
    setUploading(false)
    if (slipInput.current) slipInput.current.value = ''
  }

  // 📷 scan-to-fill: OCR the photo on-device, fill the amount (+ name if empty),
  // AND keep the photo attached as the receipt — one shot does both.
  async function onScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !trip) return
    setScanning(true)
    try {
      const [up, parsed] = await Promise.all([uploadImage(trip.id, 'receipt', file), scanReceipt(file)])
      if (up.path) setReceipt(up.path)
      if (parsed.total != null) setTotal(String(parsed.total))
      if (parsed.name && !name.trim()) setName(parsed.name)
      if (parsed.total != null) toast.success('อ่านยอดจากใบเสร็จให้แล้ว — ตรวจสอบก่อนบันทึก')
      else toast.info('อ่านยอดไม่เจอ — แนบรูปให้แล้ว กรอกยอดเองได้เลย')
    } catch {
      toast.error('สแกนไม่สำเร็จ — ลองรูปที่ชัดขึ้น หรือกรอกเอง')
    }
    setScanning(false)
    if (scanInput.current) scanInput.current.value = ''
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
    await onSave({ name: nm, payer_id: payer || null, total: amount, split_user_ids: split, receipt_path: receipt, category: cat, currency })
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
        <div className="rounded-[13px] bg-surface p-3 space-y-3" style={{ border: '0.5px solid var(--color-line)' }}>
          {/* 1) ชื่อรายการ */}
          <div className="relative">
            <LeadIcon><IconReceipt2 size={15} /></LeadIcon>
            <input className={iconField} value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อรายการ เช่น มื้อค่ำ Haidilao" />
          </div>

          {/* 2) ประเภท — icon pills (ทุกตัวเลือกเห็นพร้อมกัน แตะทีเดียว ดีกว่า
                dropdown ที่ซ่อนไว้หลังการกด) */}
          <div className="flex flex-wrap gap-1.5">
            {EXPENSE_CATS.map((c) => {
              const on = cat === c.id
              const Ic = c.icon
              return (
                <button key={c.id} onClick={() => setCat(on ? null : c.id)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-medium transition-colors"
                  style={on
                    ? { background: c.bg, color: c.fg, border: `1px solid ${c.fg}` }
                    : { background: 'var(--color-surface-2)', color: 'var(--color-ink-2)', border: '1px solid transparent' }}>
                  <Ic size={14} style={on ? undefined : { color: c.fg }} /> {c.label}
                </button>
              )
            })}
          </div>

          {/* 3) ใครจ่าย */}
          <div>
            <div className="text-[11px] text-ink-3 mb-1.5">ใครจ่าย</div>
            <div className="flex flex-wrap gap-1.5">
              {payerOptions.map((p) => {
                const on = payer === p.id
                return (
                  <button key={p.id} onClick={() => setPayer(p.id)}
                    className="inline-flex items-center gap-1 h-9 px-3.5 rounded-full text-[12.5px] font-medium transition-colors"
                    style={on
                      ? { background: 'var(--color-brand)', color: '#fff' }
                      : { background: 'var(--color-surface-2)', color: 'var(--color-ink-2)' }}>
                    {on && <IconCheck size={13} />} {p.nickname ?? 'ผู้ใช้'}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 4) ราคา + สกุลเงิน */}
          <div className="flex items-stretch gap-2">
            <div className="relative flex-1 min-w-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-ink-3 pointer-events-none">{symbolOf(currency)}</span>
              <input type="number" inputMode="decimal"
                className="hairline rounded-[9px] text-[17px] font-semibold tabular-nums h-12 pl-10 pr-3 bg-surface w-full outline-none focus:border-brand"
                value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0" aria-label="ราคา" />
            </div>
            <div className="relative shrink-0">
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="สกุลเงิน"
                className="hairline rounded-[9px] h-12 bg-surface text-[13px] font-medium pl-3 pr-8 outline-none focus:border-brand appearance-none">
                <option value="THB">🇹🇭 THB</option>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
              </select>
              <IconChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
            </div>
          </div>

          {/* 5) หารกับใคร */}
          <div className="rounded-[10px] p-2.5" style={{ background: 'var(--color-surface-2)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
                <IconUsers size={14} className="text-ink-3" /> หารกับใคร · {split.length} คน
              </div>
              <div className="flex items-center gap-2.5">
                {perHead > 0 && <span className="text-[12px] font-semibold text-brand-dark tabular-nums">{symbolOf(currency)}{Math.round(perHead).toLocaleString('en-US')}/คน</span>}
                {travelers.length > 0 && <button onClick={toggleAll} className="text-[11px] text-brand-mid font-medium">{allOn ? 'ไม่เลือกใคร' : 'ทุกคน'}</button>}
              </div>
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
          </div>

          {/* 6) สลิป: แนบ | สแกนกรอกให้ | ดู */}
          <div className="flex items-center gap-2">
            <button onClick={() => slipInput.current?.click()} disabled={uploading || scanning}
              className="flex-1 h-10 rounded-[9px] inline-flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-ink-2 disabled:opacity-50"
              style={{ border: '0.5px solid var(--color-line)', background: 'var(--color-surface)' }}>
              {uploading ? <IconLoader2 size={14} className="animate-spin" /> : <IconPaperclip size={14} />}
              {receipt ? 'เปลี่ยนสลิป' : 'แนบสลิป'}
            </button>
            <button onClick={() => scanInput.current?.click()} disabled={uploading || scanning}
              className="flex-1 h-10 rounded-[9px] inline-flex items-center justify-center gap-1.5 text-[12.5px] font-semibold disabled:opacity-60"
              style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }}>
              {scanning ? <IconLoader2 size={14} className="animate-spin" /> : <IconScan size={14} />}
              {scanning ? 'กำลังอ่าน…' : 'สแกนใบเสร็จ'}
            </button>
            {receipt && (
              <button onClick={viewSlip} className="h-10 px-3 rounded-[9px] inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2"
                style={{ border: '0.5px solid var(--color-line)', background: 'var(--color-surface)' }}>
                <IconEye size={14} />
              </button>
            )}
            <input ref={slipInput} type="file" accept="image/*,application/pdf" hidden onChange={onSlip} />
            <input ref={scanInput} type="file" accept="image/*" capture="environment" hidden onChange={onScan} />
          </div>
          {scanning && <p className="text-[10.5px] text-ink-3 -mt-1">อ่านตัวเลขจากรูปบนเครื่องของคุณ (ครั้งแรกอาจใช้เวลาสักครู่)</p>}
        </div>

        <button onClick={save} disabled={busy || scanning || !name.trim()} className="btn-primary w-full h-11 disabled:opacity-50">
          {busy ? 'กำลังบันทึก...' : initial ? 'บันทึกการแก้ไข' : 'เพิ่มค่าใช้จ่าย'}
        </button>
        {initial && onDelete && (
          <button onClick={del} disabled={busy} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] text-[#D85A30]"><IconTrash size={15} /> ลบรายการ</button>
        )}
      </div>
    </Drawer>
  )
}
