import { supabase } from './supabase'
import { updateWithVersion } from './concurrency'

export interface ExpenseInput {
  name?: string | null
  payer_id?: string | null
  total?: number | null
  split_user_ids?: string[] | null
  receipt_path?: string | null
}

export async function addExpense(trip_id: string, input: ExpenseInput) {
  return supabase.from('expenses').insert({ id: crypto.randomUUID(), trip_id, ...input })
}
export async function updateExpense(id: string, fields: ExpenseInput, expectedVersion?: number) {
  return updateWithVersion('expenses', id, { ...fields }, expectedVersion)
}
export async function deleteExpense(id: string) {
  return supabase.from('expenses').delete().eq('id', id)
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
