import { useState } from 'react'
import { IconBellRinging } from '@tabler/icons-react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/lib/toast'
import {
  LEAD_CHOICES, DEFAULT_LEAD, ensureNotifyPermission,
  reminderLead, remindersEnabled, setReminderLead, setRemindersEnabled,
} from '@/lib/planReminders'

/** One-line personal reminder settings (Itinerary page). Per device + per
 *  account — each member switches/tunes their own without affecting others. */
export function ReminderSettings() {
  const { user } = useAuth()
  const uid = user?.id ?? null
  const [on, setOn] = useState(() => (uid ? remindersEnabled(uid) : true))
  const [lead, setLead] = useState(() => (uid ? reminderLead(uid) : DEFAULT_LEAD))
  if (!uid) return null
  const id: string = uid // narrowed for the closures below

  async function toggle() {
    const next = !on
    setOn(next)
    setRemindersEnabled(id, next)
    if (!next) return
    const sys = await ensureNotifyPermission()
    toast.success(sys
      ? `เปิดเตือนแล้ว — เด้งก่อนถึงเวลาแพลน ${lead} นาที`
      : `เปิดเตือนในแอปแล้ว (ก่อนเวลา ${lead} นาที)`)
  }

  return (
    <div className="card px-3.5 py-2.5 flex items-center gap-2.5">
      <IconBellRinging size={16} className={on ? 'text-brand shrink-0' : 'text-ink-3 shrink-0'} />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium leading-tight">เตือนก่อนถึงเวลาแพลน</div>
        <div className="text-[10.5px] text-ink-3 leading-tight mt-0.5">ของใครของมัน — เตือนบนเครื่องนี้ตอนเปิดแอปอยู่</div>
      </div>
      {on && (
        <select
          value={lead}
          onChange={(e) => { const m = Number(e.target.value); setLead(m); setReminderLead(id, m) }}
          className="hairline rounded-md h-8 text-[12px] px-1.5 bg-surface outline-none shrink-0"
          aria-label="เตือนล่วงหน้า">
          {LEAD_CHOICES.map((m) => <option key={m} value={m}>{m} นาที</option>)}
        </select>
      )}
      <button onClick={toggle} aria-pressed={on} aria-label="เปิด/ปิดการเตือน"
        className="w-10 h-6 rounded-full relative transition-colors shrink-0"
        style={{ background: on ? 'var(--color-brand)' : 'var(--color-line-2)' }}>
        <span className="absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all"
          style={{ left: on ? 18 : 2 }} />
      </button>
    </div>
  )
}
