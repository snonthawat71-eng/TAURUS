import { useEffect, useState } from 'react'
import { IconBellRinging } from '@tabler/icons-react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/lib/toast'
import {
  LEAD_CHOICES, DEFAULT_LEAD, leadLabel, ensureNotifyPermission,
  reminderLead, remindersEnabled, setReminderLead, setRemindersEnabled,
} from '@/lib/planReminders'
import { getPushState, enablePush, disablePush, setLead as setPushLead, type PushState } from '@/lib/push'

/** Personal plan-reminder settings (Itinerary page) — one switch. Turning it on
 *  enables everything at once: in-app alerts AND closed-app push on this
 *  device (best-effort — a hint shows when the device can't do push yet).
 *  Per device + per account: each member tunes their own. */
export function ReminderSettings() {
  const { user } = useAuth()
  const uid = user?.id ?? null
  const [on, setOn] = useState(() => (uid ? remindersEnabled(uid) : true))
  const [lead, setLeadState] = useState(() => (uid ? reminderLead(uid) : DEFAULT_LEAD))
  const [push, setPush] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { getPushState().then(setPush) }, [])
  if (!uid) return null
  const id: string = uid // narrowed for the closures below

  async function toggle() {
    if (busy) return
    setBusy(true)
    try {
      const next = !on
      setOn(next)
      setRemindersEnabled(id, next)
      if (!next) {
        // off = silence everywhere for this device
        try { await disablePush() } catch { /* not subscribed */ }
        setPush((p) => (p ? { ...p, subscribed: false } : p))
        return
      }
      await ensureNotifyPermission()
      let state = push
      if (!state) { state = await getPushState(); setPush(state) }
      if (state.supported && state.configured) {
        const { error } = await enablePush(lead)
        if (!error) {
          setPush({ ...state, subscribed: true, permission: 'granted' })
          toast.success('เปิดเตือนแล้ว — เด้งแม้ปิดแอป ตามเวลาทริป')
          return
        }
        toast.error(error)
      }
      toast.success('เปิดเตือนในแอปแล้ว')
    } finally { setBusy(false) }
  }

  function changeLead(m: number) {
    setLeadState(m)
    setReminderLead(id, m)
    if (push?.subscribed) setPushLead(m).catch(() => { /* offline — resync later */ })
    if (on) toast.info(m === 0 ? 'จะเตือนตอนถึงเวลาพอดี' : `จะเตือนล่วงหน้า ${leadLabel(m)} และตอนถึงเวลา`)
  }

  const sub = !on ? 'ปิดอยู่'
    : !push ? 'กำลังตรวจสอบ…'
      : push.subscribed ? 'เด้งเตือนแม้ปิดแอป ตามไทม์โซนทริป'
        : !push.supported ? 'เตือนตอนเปิดแอป · เพิ่มลงหน้าโฮมเพื่อเด้งตอนปิดแอป'
          : !push.configured ? 'เตือนตอนเปิดแอป (เซิร์ฟเวอร์ยังไม่พร้อม)'
            : 'เตือนตอนเปิดแอป · ปิด-เปิดใหม่เพื่อรับเด้งตอนปิดแอป'

  return (
    <div className="card px-3.5 py-2.5 flex items-center gap-2.5">
      <IconBellRinging size={16} className={on ? 'text-brand shrink-0' : 'text-ink-3 shrink-0'} />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium leading-tight">เตือนตามแพลน (ของใครของมัน)</div>
        <div className="text-[10.5px] text-ink-3 leading-tight mt-0.5 truncate">{sub}</div>
      </div>
      {on && (
        <select
          value={lead}
          onChange={(e) => changeLead(Number(e.target.value))}
          className="hairline rounded-md h-8 text-[12px] px-1.5 bg-surface outline-none shrink-0"
          aria-label="เวลาแจ้งเตือน">
          {LEAD_CHOICES.map((m) => <option key={m} value={m}>{leadLabel(m)}</option>)}
        </select>
      )}
      <button onClick={toggle} disabled={busy} aria-pressed={on} aria-label="เปิด/ปิดการเตือน"
        className="w-10 h-6 rounded-full relative transition-colors shrink-0 disabled:opacity-40"
        style={{ background: on ? 'var(--color-brand)' : 'var(--color-line-2)' }}>
        <span className="absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all"
          style={{ left: on ? 18 : 2 }} />
      </button>
    </div>
  )
}
