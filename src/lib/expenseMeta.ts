// Spending categories for Budget expenses — same idea as placeMeta: one place
// that maps a category id to its label, icon and colors, shared by the editor
// pills and the expense-list rows.
import { IconToolsKitchen2, IconBus, IconBed, IconShoppingBag, IconTicket, IconDots, type Icon } from '@tabler/icons-react'

export interface ExpenseCat {
  id: string
  label: string
  icon: Icon
  bg: string
  fg: string
}

export const EXPENSE_CATS: ExpenseCat[] = [
  { id: 'food', label: 'อาหาร', icon: IconToolsKitchen2, bg: '#FDF0E6', fg: '#C56A1E' },
  { id: 'transport', label: 'เดินทาง', icon: IconBus, bg: '#E8F1FE', fg: '#0270FB' },
  { id: 'hotel', label: 'ที่พัก', icon: IconBed, bg: '#EEF0FB', fg: '#5B67D8' },
  { id: 'shopping', label: 'ช้อปปิ้ง', icon: IconShoppingBag, bg: '#FBECE9', fg: '#D85A30' },
  { id: 'ticket', label: 'ตั๋ว/เข้าชม', icon: IconTicket, bg: '#E6F4EE', fg: '#1E8E5A' },
  { id: 'other', label: 'อื่นๆ', icon: IconDots, bg: '#EEF1F4', fg: '#5B6573' },
]

/** Meta for a stored category value. Known ids get their pill look; a freeform
 *  "other" label (e.g. "ค่าปรับ") falls back to the neutral "other" look. */
export function expenseCat(id?: string | null): ExpenseCat {
  return EXPENSE_CATS.find((c) => c.id === id)
    ?? { id: 'other', label: 'อื่นๆ', icon: IconDots, bg: '#EEF1F4', fg: '#5B6573' }
}

/** Human label for a stored category value — a known category's Thai word, or
 *  the freeform text the user typed for "อื่นๆ". null when unset. */
export function expenseCatLabel(value?: string | null): string | null {
  if (!value) return null
  return EXPENSE_CATS.find((c) => c.id === value)?.label ?? value
}
