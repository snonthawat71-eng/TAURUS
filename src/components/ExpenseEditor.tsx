import { useEffect, useRef, useState } from 'react'
import { IconTrash, IconPaperclip, IconLoader2, IconCheck, IconReceipt2, IconEye, IconScan, IconChevronDown, IconUser, IconTag, IconCoin, IconUsers, IconCategory, IconArrowLeft, IconUsersGroup, IconUserOff, IconCalendar } from '@tabler/icons-react'
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

const iconField = 'hairline rounded-[9px] text-[13px] h-11 pl-9 pr-3 bg-surface w-full outline-none focus:border-brand'
const knownCat = (v?: string | null) => EXPENSE_CATS.some((c) => c.id === v)
const symbolOf = (code: string) => code === 'THB' ? '฿' : (CURRENCIES.find((c) => c.code === code)?.symbol ?? code)

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
  const editing = !!initial

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const [customCat, setCustomCat] = useState('')
  const [payer, setPayer] = useState('')
  const [total, setTotal] = useState('')
  const [currency, setCurrency] = useState('THB')
  const [date, setDate] = useState('')
  const [split, setSplit] = useState<string[]>([])
  const [receipt, setReceipt] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)
  const slipInput = useRef<HTMLInputElement>(null)
  const scanInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setStep(0)
    setName(initial?.name ?? '')
    setCat(initial?.category ? (knownCat(initial.category) ? initial.category! : 'other') : null)
    setCustomCat(initial?.category && !knownCat(initial.category) ? initial.category! : '')
    setPayer(initial?.payer_id ?? user?.id ?? '')
    setTotal(initial?.total != null ? String(initial.total) : '')
    setCurrency(initial?.currency ?? (initial ? 'THB' : (tripCurrency(trip) ?? 'THB')))
    setDate(initial?.spent_on ?? (initial?.created_at ? initial.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)))
    setSplit(initial?.split_user_ids ?? travelers.map((t) => t.id))
    setReceipt(initial?.receipt_path ?? null)
  }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSplit = (id: string) => setSplit((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
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

  // scan-to-fill: OCR on-device, fill amount (+ name if empty), keep the photo
  async function onScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !trip) return
    setScanning(true)
    try {
      const [up, parsed] = await Promise.all([uploadImage(trip.id, 'receipt', file), scanReceipt(file)])
      if (up.path) setReceipt(up.path)
      if (parsed.total != null) setTotal(String(parsed.total))
      if (parsed.name && !name.trim()) setName(parsed.name)
      toast[parsed.total != null ? 'success' : 'info'](parsed.total != null ? 'อ่านยอดจากใบเสร็จให้แล้ว — ตรวจสอบก่อนบันทึก' : 'อ่านยอดไม่เจอ — แนบรูปให้แล้ว กรอกยอดเองได้เลย')
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
    if (!nm) { toast.error('กรุณาใส่ชื่อรายการ'); setStep(STEPS.findIndex((s) => s.key === 'name')); return }
    const amount = total.trim() ? Number(total) : null
    if (amount != null && (!Number.isFinite(amount) || amount < 0)) { toast.error('ยอดรวมต้องเป็นตัวเลขไม่ติดลบ'); return }
    const category = cat === 'other' ? (customCat.trim() || 'other') : cat
    setBusy(true)
    await onSave({ name: nm, payer_id: payer || null, total: amount, split_user_ids: split, receipt_path: receipt, category, currency, spent_on: date || null })
    setBusy(false)
    onClose()
  }
  async function del() {
    if (!onDelete || !(await confirmDialog({ message: 'ลบรายการนี้?', danger: true, confirmLabel: 'ลบ' }))) return
    setBusy(true); await onDelete(); setBusy(false); onClose()
  }

  // ── field blocks (shared by the wizard steps and the edit view) ───────────
  const slipBlock = (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => scanInput.current?.click()} disabled={uploading || scanning}
          className="h-16 rounded-[12px] inline-flex flex-col items-center justify-center gap-1 text-[12.5px] font-semibold disabled:opacity-60"
          style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '1px solid var(--color-brand-border)' }}>
          {scanning ? <IconLoader2 size={20} className="animate-spin" /> : <IconScan size={20} />}
          {scanning ? 'กำลังอ่าน…' : 'สแกนใบเสร็จ'}
        </button>
        <button onClick={() => slipInput.current?.click()} disabled={uploading || scanning}
          className="h-16 rounded-[12px] inline-flex flex-col items-center justify-center gap-1 text-[12.5px] font-medium text-ink-2 disabled:opacity-50"
          style={{ border: '1px solid var(--color-line)', background: 'var(--color-surface)' }}>
          {uploading ? <IconLoader2 size={20} className="animate-spin" /> : <IconPaperclip size={20} />}
          {receipt ? 'เปลี่ยนสลิป' : 'แนบสลิปเอง'}
        </button>
      </div>
      {receipt && (
        <button onClick={viewSlip} className="w-full h-9 rounded-[9px] inline-flex items-center justify-center gap-1.5 text-[12px] font-medium text-brand-dark"
          style={{ background: 'var(--color-brand-soft)', border: '0.5px solid var(--color-brand-border)' }}>
          <IconCheck size={14} /> แนบสลิปแล้ว · <span className="inline-flex items-center gap-1 text-brand-mid"><IconEye size={13} /> ดู</span>
        </button>
      )}
      <input ref={slipInput} type="file" accept="image/*,application/pdf" hidden onChange={onSlip} />
      <input ref={scanInput} type="file" accept="image/*" capture="environment" hidden onChange={onScan} />
    </div>
  )

  const payerBlock = (
    <div className="flex flex-wrap gap-1.5">
      {payerOptions.map((p) => {
        const on = payer === p.id
        return (
          <button key={p.id} onClick={() => setPayer(p.id)}
            className="inline-flex items-center gap-1 h-10 px-4 rounded-full text-[13px] font-medium transition-colors"
            style={on ? { background: 'var(--color-brand)', color: '#fff' } : { background: 'var(--color-surface-2)', color: 'var(--color-ink-2)' }}>
            {on && <IconCheck size={14} />} {p.nickname ?? 'ผู้ใช้'}
          </button>
        )
      })}
    </div>
  )

  const nameBlock = (
    <div className="relative">
      <LeadIcon><IconTag size={15} /></LeadIcon>
      <input className={iconField} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น มื้อค่ำ Haidilao" autoFocus={!editing} />
    </div>
  )

  const categoryBlock = (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        {EXPENSE_CATS.map((c) => {
          const on = cat === c.id
          const Ic = c.icon
          return (
            <button key={c.id} onClick={() => setCat(on ? null : c.id)}
              className="h-10 rounded-[9px] inline-flex items-center justify-center gap-1.5 text-[12px] font-medium transition-colors"
              style={on ? { background: c.bg, color: c.fg, border: `1px solid ${c.fg}` } : { background: 'var(--color-surface-2)', color: 'var(--color-ink-2)', border: '1px solid transparent' }}>
              <Ic size={15} style={on ? undefined : { color: c.fg }} /> {c.label}
            </button>
          )
        })}
      </div>
      {cat === 'other' && (
        <input className="hairline rounded-[9px] text-[13px] h-11 px-3.5 bg-surface w-full outline-none focus:border-brand"
          value={customCat} onChange={(e) => setCustomCat(e.target.value)} placeholder="ระบุประเภท เช่น ค่าปรับ, ค่าทิป" autoFocus />
      )}
    </div>
  )

  const priceBlock = (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2">
        <input type="number" inputMode="decimal"
          className="hairline rounded-[9px] text-[18px] font-semibold tabular-nums h-12 px-3.5 bg-surface flex-1 min-w-0 outline-none focus:border-brand"
          value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0" aria-label="ราคา" autoFocus={!editing} />
        <div className="relative shrink-0">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="สกุลเงิน"
            className="hairline rounded-[9px] h-12 bg-surface text-[13px] font-medium pl-3 pr-8 outline-none focus:border-brand appearance-none">
            <option value="THB">🇹🇭 THB</option>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
          </select>
          <IconChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
        </div>
      </div>
    </div>
  )

  const dateBlock = (
    <div className="relative">
      <LeadIcon><IconCalendar size={15} /></LeadIcon>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="วันที่"
        className={`${iconField} appearance-none`} />
    </div>
  )

  const personal = split.length === 0
  const splitBlock = (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {/* "ทุกคน / ไม่เลือกใคร (ส่วนตัว)" — a full pill, as prominent as the names */}
        <button onClick={toggleAll}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-[13px] font-semibold transition-colors"
          style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '1px solid var(--color-brand-border)' }}>
          {allOn ? <IconUserOff size={15} /> : <IconUsersGroup size={15} />}
          {allOn ? 'ไม่เลือกใคร' : 'เลือกทุกคน'}
        </button>
        {travelers.map((t) => {
          const on = split.includes(t.id)
          return (
            <button key={t.id} onClick={() => toggleSplit(t.id)}
              className="inline-flex items-center gap-1 h-10 px-4 rounded-full text-[13px] font-medium transition-colors"
              style={on ? { background: 'var(--color-brand)', color: '#fff' } : { background: 'var(--color-surface-2)', color: 'var(--color-ink-2)' }}>
              {on && <IconCheck size={14} />} {t.nickname}
            </button>
          )
        })}
      </div>
      {personal
        ? <div className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: '#C56A1E' }}>
            <IconUserOff size={14} /> รายการส่วนตัว — ไม่หารกับใคร (นับเป็นค่าใช้จ่ายของคนจ่าย)
          </div>
        : <div className="text-[12px] text-ink-3">
            หาร {split.length} คน{perHead > 0 && <> · <span className="font-semibold text-brand-dark tabular-nums">{symbolOf(currency)}{Math.round(perHead).toLocaleString('en-US')}/คน</span></>}
          </div>}
    </div>
  )

  // ── the 6 steps, in the order the user asked for ──────────────────────────
  const STEPS = [
    { key: 'slip', icon: IconReceipt2, title: 'แนบสลิป / สแกนใบเสร็จ', hint: 'สแกนแล้วกรอกยอดให้อัตโนมัติ — หรือข้ามไปก่อนก็ได้', body: slipBlock, canNext: true },
    { key: 'payer', icon: IconUser, title: 'ใครเป็นคนจ่าย', body: payerBlock, canNext: !!payer },
    { key: 'name', icon: IconTag, title: 'รายการนี้คืออะไร', body: nameBlock, canNext: !!name.trim() },
    { key: 'category', icon: IconCategory, title: 'ประเภทค่าใช้จ่าย', hint: 'เลือกได้ 1 อย่าง (ไม่บังคับ)', body: categoryBlock, canNext: true },
    { key: 'price', icon: IconCoin, title: 'ราคาและวันที่', body: <div className="space-y-2">{priceBlock}{dateBlock}</div>, canNext: true },
    { key: 'split', icon: IconUsers, title: 'หารกับใครบ้าง', body: splitBlock, canNext: true },
  ] as const
  const cur = STEPS[step]
  const last = step === STEPS.length - 1

  return (
    <Drawer open={open} onClose={onClose} title={editing ? 'แก้ไขค่าใช้จ่าย' : 'เพิ่มค่าใช้จ่าย'}>
      {editing ? (
        // EDIT: everything on one page (no need to walk steps to fix one field)
        <div className="space-y-3.5">
          {([['รายการ', nameBlock], ['ประเภท', categoryBlock], ['ใครจ่าย', payerBlock], ['ราคา', priceBlock], ['วันที่', dateBlock], ['หารกับใคร', splitBlock], ['สลิป / ใบเสร็จ', slipBlock]] as const).map(([lbl, node]) => (
            <div key={lbl}>
              <div className="text-[11px] font-medium text-ink-3 mb-1.5">{lbl}</div>
              {node}
            </div>
          ))}
          <button onClick={save} disabled={busy || scanning || !name.trim()} className="btn-primary w-full h-11 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}</button>
          {onDelete && <button onClick={del} disabled={busy} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] text-[#D85A30]"><IconTrash size={15} /> ลบรายการ</button>}
        </div>
      ) : (
        // ADD: step-by-step wizard
        <div className="flex flex-col">
          {/* progress — tappable segments */}
          <div className="flex gap-1 mb-4">
            {STEPS.map((s, i) => (
              <button key={s.key} onClick={() => setStep(i)} aria-label={s.title}
                className="flex-1 h-1.5 rounded-full transition-colors"
                style={{ background: i <= step ? 'var(--color-brand)' : 'var(--color-surface-2)' }} />
            ))}
          </div>

          {/* step header */}
          <div className="flex items-center gap-2.5 mb-3">
            <span className="size-9 rounded-[10px] grid place-items-center shrink-0" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}>
              <cur.icon size={18} />
            </span>
            <div className="min-w-0">
              <div className="text-[10.5px] text-ink-3">ขั้นที่ {step + 1}/{STEPS.length}</div>
              <div className="text-[15px] font-semibold leading-tight">{cur.title}</div>
            </div>
          </div>

          <div className="min-h-[112px]">
            {cur.body}
            {'hint' in cur && cur.hint && <p className="text-[11px] text-ink-3 mt-2.5">{cur.hint}</p>}
          </div>

          {/* nav */}
          <div className="flex items-center gap-2 mt-5">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} className="h-11 px-4 rounded-full inline-flex items-center gap-1 text-[13px] font-medium text-ink-2" style={{ background: 'var(--color-surface-2)' }}>
                <IconArrowLeft size={16} /> ย้อนกลับ
              </button>
            )}
            {last ? (
              <button onClick={save} disabled={busy || scanning || !name.trim()} className="btn-primary flex-1 h-11 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : 'เพิ่มค่าใช้จ่าย'}</button>
            ) : (
              <button onClick={() => setStep(step + 1)} disabled={!cur.canNext} className="btn-primary flex-1 h-11 disabled:opacity-50">ถัดไป</button>
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}
