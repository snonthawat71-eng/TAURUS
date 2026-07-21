import { supabase } from './supabase'
import { updateWithVersion } from './concurrency'
import { runOrQueue } from './offlineQueue'

export interface ExpenseInput {
  name?: string | null
  payer_id?: string | null
  total?: number | null
  split_user_ids?: string[] | null
  receipt_path?: string | null
  category?: string | null
  currency?: string | null
  spent_on?: string | null
}

// category/currency/spent_on are optional columns (supabase/expense_extras.sql)
// — strip whichever the API reports as unknown so older databases still work.
const OPTIONAL = ['category', 'currency', 'spent_on']
function stripUnknown(payload: Record<string, unknown>, msg: string) {
  const copy = { ...payload }
  let changed = false
  for (const k of OPTIONAL) if (k in copy && msg.includes(k)) { delete copy[k]; changed = true }
  return changed ? copy : null
}

export async function addExpense(trip_id: string, input: ExpenseInput) {
  const payload: Record<string, unknown> = { id: crypto.randomUUID(), trip_id, ...input }
  return runOrQueue(async () => {
    let r = await supabase.from('expenses').insert(payload)
    if (r.error) { const s = stripUnknown(payload, r.error.message); if (s) r = await supabase.from('expenses').insert(s) }
    return r
  }, { kind: 'insert', table: 'expenses', payload })
}
export async function updateExpense(id: string, fields: ExpenseInput, expectedVersion?: number) {
  return updateWithVersion('expenses', id, { ...fields }, expectedVersion, (p, msg) => stripUnknown(p, msg))
}
export async function deleteExpense(id: string) {
  return runOrQueue(() => supabase.from('expenses').delete().eq('id', id), { kind: 'delete', table: 'expenses', id })
}

// ---- settlement maths ----

export interface Settlement { fromId: string; toId: string; amount: number }

/** Greedy "who pays whom" given each person's net balance (>0 = is owed). */
export function settle(balances: Map<string, number>): Settlement[] {
  const creditors: { id: string; amt: number }[] = []
  const debtors: { id: string; amt: number }[] = []
  for (const [id, bal] of balances) {
    if (bal > 0.5) creditors.push({ id, amt: bal })
    else if (bal < -0.5) debtors.push({ id, amt: -bal })
  }
  creditors.sort((a, b) => b.amt - a.amt)
  debtors.sort((a, b) => b.amt - a.amt)

  const result: Settlement[] = []
  let ci = 0
  let di = 0
  while (ci < creditors.length && di < debtors.length) {
    const pay = Math.min(creditors[ci].amt, debtors[di].amt)
    result.push({ fromId: debtors[di].id, toId: creditors[ci].id, amount: pay })
    creditors[ci].amt -= pay
    debtors[di].amt -= pay
    if (creditors[ci].amt < 0.5) ci++
    if (debtors[di].amt < 0.5) di++
  }
  return result
}
