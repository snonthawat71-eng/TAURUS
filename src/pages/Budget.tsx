import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlus, IconReceipt, IconArrowRight, IconPhoto, IconPencil, IconArrowLeft } from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { tripCurrency } from '@/lib/segments'
import { Avatar } from '@/components/Avatar'
import { ExpenseEditor } from '@/components/ExpenseEditor'
import { PopMenu } from '@/components/PopMenu'
import { baht } from '@/lib/format'
import { confirmDialog } from '@/lib/confirm'
import { offerUndo } from '@/lib/undo'
import { toast } from '@/lib/toast'
import { getSignedUrl, isSampleFile } from '@/lib/files'
import { settle, addExpense, updateExpense, deleteExpense } from '@/lib/budgetMutations'
import { getRateToTHB, CURRENCIES } from '@/lib/fx'
import { IconTrash } from '@tabler/icons-react'
import type { Expense } from '@/lib/database.types'

const AV = ['av1', 'av2', 'av3', 'av4']

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-3 sm:p-3.5">
      <div className="text-[10px] sm:text-[11px] text-ink-3">{label}</div>
      <div className="text-[17px] sm:text-[22px] font-medium mt-1 leading-none tabular-nums">{value}</div>
      {sub && <div className="text-[10px] sm:text-[11px] text-ink-3 mt-1.5 truncate">{sub}</div>}
    </div>
  )
}

export default function Budget() {
  const { trip, expenses, travelers, memberProfiles, reload, canEdit } = useTrip()
  const navigate = useNavigate()
  const [editor, setEditor] = useState<'new' | Expense | null>(null)
  const [equiv, setEquiv] = useState<string | null>(null)

  const person = useMemo(() => {
    const m = new Map<string, { name: string; color?: string; photo?: string | null; photoFocus?: string | null }>()
    travelers.forEach((t, i) => m.set(t.id, { name: t.nickname ?? 'ผู้เดินทาง', color: t.avatar_color ?? AV[i % 4], photo: t.avatar_url, photoFocus: t.avatar_focus }))
    memberProfiles.forEach((p) => { if (!m.has(p.id)) m.set(p.id, { name: p.nickname ?? 'ผู้ใช้', color: p.avatar_color ?? undefined, photo: p.avatar_url, photoFocus: p.avatar_focus }) })
    return m
  }, [travelers, memberProfiles])
  const personOf = (id: string) => person.get(id) ?? { name: 'ผู้ใช้', color: undefined, photo: null, photoFocus: null }

  const total = expenses.reduce((s, e) => s + (e.total ?? 0), 0)
  const distinctSplit = new Set<string>()
  expenses.forEach((e) => (e.split_user_ids ?? []).forEach((id) => distinctSplit.add(id)))
  const headCount = distinctSplit.size || travelers.length || 1
  const perPerson = total / headCount

  const settlements = useMemo(() => {
    const balances = new Map<string, number>()
    const add = (id: string, v: number) => balances.set(id, (balances.get(id) ?? 0) + v)
    for (const e of expenses) {
      const split = e.split_user_ids ?? []
      if (!e.total || split.length === 0) continue
      if (e.payer_id) add(e.payer_id, e.total)
      const share = e.total / split.length
      for (const sid of split) add(sid, -share)
    }
    return settle(balances)
  }, [expenses])

  // total in the sidebar-selected foreign currency
  useEffect(() => {
    const code = tripCurrency(trip) ?? localStorage.getItem('fx:currency') ?? 'CNY'
    const cur = CURRENCIES.find((c) => c.code === code)
    getRateToTHB(code).then((r) => {
      if (r.rate) setEquiv(`${cur?.symbol ?? ''}${Math.round(total / r.rate).toLocaleString('en-US')}`)
    })
  }, [total, trip?.currency])

  return (
    <div>
      {/* Header — back to Personal Information (budget lives there now) */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate('/info')} className="btn-icon" aria-label="กลับ" title="กลับ"><IconArrowLeft size={16} /></button>
        <h1 className="text-[16px] font-medium">Budget • ค่าใช้จ่าย</h1>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2.5">
        <Metric label="รวมทั้งทริป" value={baht(total)} sub={equiv ?? undefined} />
        <Metric label="เฉลี่ยต่อคน" value={baht(perPerson)} sub={`หาร ${headCount} คน`} />
        <Metric label="รายการ" value={String(expenses.length)} sub="บันทึกแล้ว" />
      </div>

      {/* Expense list */}
      <div className="flex items-center justify-between mt-6 mb-2.5">
        <h2 className="text-[13px] font-medium text-ink-2 flex items-center gap-1.5"><IconReceipt size={15} /> Expenses • รายการค่าใช้จ่าย</h2>
        {canEdit && <button onClick={() => setEditor('new')} className="btn-link flex items-center gap-1"><IconPlus size={14} /> เพิ่มรายการ</button>}
      </div>

      <div className="space-y-2.5">
        {expenses.length === 0 && (
          <div className="card p-8 flex flex-col items-center gap-2 text-center">
            <IconReceipt size={28} className="text-ink-3" />
            <p className="text-[13px] text-ink-2">ยังไม่มีค่าใช้จ่าย</p>
            {canEdit && <button onClick={() => setEditor('new')} className="btn-primary h-9 px-4 flex items-center gap-1.5 text-[13px] mt-1"><IconPlus size={15} /> เพิ่มค่าใช้จ่าย</button>}
          </div>
        )}
        {expenses.map((e) => {
          const payer = e.payer_id ? personOf(e.payer_id) : null
          const n = (e.split_user_ids ?? []).length || 1
          return (
            <div key={e.id} className="card p-3.5 flex items-center gap-3">
              <span className="size-9 rounded-md bg-surface-2 grid place-items-center text-ink-2 shrink-0"><IconReceipt size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium truncate">{e.name}</div>
                <div className="flex items-center gap-1.5 text-[11px] text-ink-3 mt-0.5">
                  {payer && <><Avatar name={payer.name} color={payer.color} photo={payer.photo} photoFocus={payer.photoFocus} size={16} ring={false} /> <span>จ่ายโดย {payer.name}</span></>}
                  <span>· หาร {n} คน</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[14px] font-medium tabular-nums">{baht(e.total)}</div>
                <div className="text-[11px] text-ink-3 tabular-nums">{baht((e.total ?? 0) / n)}/คน</div>
              </div>
              <SlipButton path={e.receipt_path} />
              {canEdit && (
                <PopMenu items={[
                  { label: 'แก้ไข', icon: <IconPencil size={15} />, onClick: () => setEditor(e) },
                  { label: 'ลบ', icon: <IconTrash size={15} />, onClick: async () => { if (await confirmDialog({ message: 'ลบรายการนี้?', danger: true, confirmLabel: 'ลบ' })) { await deleteExpense(e.id); await reload(); offerUndo('ลบรายการแล้ว', [{ table: 'expenses', rows: [e] }], reload) } }, danger: true },
                ]} />
              )}
            </div>
          )
        })}
      </div>

      {/* Settlement */}
      {settlements.length > 0 && (
        <div className="card p-4 mt-5">
          <h3 className="text-[13px] font-medium flex items-center gap-1.5 mb-3"><IconArrowRight size={15} /> Settlement • สรุปยอดที่ต้องเคลียร์</h3>
          <div className="space-y-2.5">
            {settlements.map((s, i) => {
              const from = personOf(s.fromId)
              const to = personOf(s.toId)
              return (
                <div key={i} className="flex items-center gap-2 text-[13px]">
                  <Avatar name={from.name} color={from.color} photo={from.photo} photoFocus={from.photoFocus} size={20} ring={false} />
                  <span className="font-medium">{from.name}</span>
                  <span className="text-ink-3">ต้องจ่ายให้</span>
                  <Avatar name={to.name} color={to.color} photo={to.photo} photoFocus={to.photoFocus} size={20} ring={false} />
                  <span className="font-medium">{to.name}</span>
                  <span className="ml-auto booking-id tabular-nums">{baht(s.amount)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <ExpenseEditor
        open={editor !== null}
        onClose={() => setEditor(null)}
        initial={editor && editor !== 'new' ? editor : null}
        onSave={async (fields) => {
          if (editor === 'new' || !editor) await addExpense(trip!.id, fields)
          else {
            const r = await updateExpense(editor.id, fields, editor.version)
            if (r.conflict) toast.error('มีคนอื่นแก้ไขรายการนี้ก่อนหน้า — โหลดข้อมูลล่าสุดให้แล้ว ลองใหม่อีกครั้ง')
          }
          await reload()
        }}
        onDelete={editor && editor !== 'new' ? async () => { await deleteExpense(editor.id); await reload() } : undefined}
      />
    </div>
  )
}

function SlipButton({ path }: { path: string | null }) {
  if (!path) return <span className="size-9 shrink-0" />
  async function view() {
    if (isSampleFile(path)) { toast.info('สลิปตัวอย่าง — อัปโหลดสลิปจริงเพื่อเปิดดู'); return }
    const url = await getSignedUrl(path!)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }
  return (
    <button onClick={view} className="btn-icon !size-9 shrink-0" aria-label="ดูสลิป"><IconPhoto size={16} /></button>
  )
}
