import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlus, IconReceipt, IconChevronRight } from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { ExpenseEditor } from '@/components/ExpenseEditor'
import { baht } from '@/lib/format'
import { addExpense } from '@/lib/budgetMutations'
import { getRateToTHB, CURRENCIES } from '@/lib/fx'

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-3 sm:p-3.5">
      <div className="text-[10px] sm:text-[11px] text-ink-3">{label}</div>
      <div className="text-[17px] sm:text-[22px] font-medium mt-1 leading-none tabular-nums">{value}</div>
      {sub && <div className="text-[10px] sm:text-[11px] text-ink-3 mt-1.5 truncate">{sub}</div>}
    </div>
  )
}

/**
 * Compact budget block embedded in Personal Information: the 3 summary metrics
 * plus an "add expense" affordance. The full list + settlement lives on /budget,
 * reached by tapping the "ดูรายละเอียด" card.
 */
export function BudgetSection() {
  const { trip, expenses, travelers, reload, canEdit } = useTrip()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const [equiv, setEquiv] = useState<string | null>(null)

  const total = expenses.reduce((s, e) => s + (e.total ?? 0), 0)
  const distinctSplit = new Set<string>()
  expenses.forEach((e) => (e.split_user_ids ?? []).forEach((id) => distinctSplit.add(id)))
  const headCount = distinctSplit.size || travelers.length || 1
  const perPerson = total / headCount

  // total in the trip's foreign currency (same source as the budget page)
  useEffect(() => {
    const code = trip?.currency ?? localStorage.getItem('fx:currency') ?? 'CNY'
    const cur = CURRENCIES.find((c) => c.code === code)
    getRateToTHB(code).then((r) => {
      if (r.rate) setEquiv(`${cur?.symbol ?? ''}${Math.round(total / r.rate).toLocaleString('en-US')}`)
    })
  }, [total, trip?.currency])

  return (
    <div>
      {/* 3 summary boxes */}
      <div className="grid grid-cols-3 gap-2.5">
        <Metric label="รวมทั้งทริป" value={baht(total)} sub={equiv ?? undefined} />
        <Metric label="เฉลี่ยต่อคน" value={baht(perPerson)} sub={`หาร ${headCount} คน`} />
        <Metric label="รายการ" value={String(expenses.length)} sub="บันทึกแล้ว" />
      </div>

      {/* Expense list — add inline, view details on its own page */}
      <div className="flex items-center justify-between mt-5 mb-2.5">
        <h3 className="text-[13px] font-medium text-ink-2 flex items-center gap-1.5"><IconReceipt size={15} /> รายการค่าใช้จ่าย</h3>
        {canEdit && <button onClick={() => setAdding(true)} className="btn-link flex items-center gap-1"><IconPlus size={14} /> เพิ่มรายการ</button>}
      </div>

      <button onClick={() => navigate('/budget')} className="card w-full p-3.5 flex items-center gap-3 text-left hover:bg-surface-2/30">
        <span className="size-9 rounded-md bg-surface-2 grid place-items-center text-ink-2 shrink-0"><IconReceipt size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium">ดูรายละเอียด</div>
          <div className="text-[11px] text-ink-3 mt-0.5">{expenses.length} รายการ · สรุปยอดที่ต้องเคลียร์</div>
        </div>
        <IconChevronRight size={18} className="text-ink-3 shrink-0" />
      </button>

      <ExpenseEditor
        open={adding}
        onClose={() => setAdding(false)}
        initial={null}
        onSave={async (fields) => { await addExpense(trip!.id, fields); await reload() }}
      />
    </div>
  )
}
