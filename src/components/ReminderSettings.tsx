import { useEffect, useState } from 'react'
import { IconBellRinging, IconDeviceMobileMessage } from '@tabler/icons-react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/lib/toast'
import {
  LEAD_CHOICES, DEFAULT_LEAD, ensureNotifyPermission,
  reminderLead, remindersEnabled, setReminderLead, setRemindersEnabled,
} from '@/lib/planReminders'
import { getPushState, enablePush, disablePush, setLead as setPushLead, type PushState } from '@/lib/push'

function Switch({ on, onClick, disabled, label }: { on: boolean; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-pressed={on} aria-label={label}
      className="w-10 h-6 rounded-full relative transition-colors shrink-0 disabled:opacity-40"
      style={{ background: on ? 'var(--color-brand)' : 'var(--color-line-2)' }}>
      <span className="absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all"
        style={{ left: on ? 18 : 2 }} />
    </button>
  )
}

/** Personal plan-reminder settings (Itinerary page). Per device + per account —
 *  each member switches/tunes their own without affecting anyone else.
 *  Row 1: in-app reminders (always available). Row 2: Web Push so the alerts
 *  also arrive with the app closed (needs the server env setup + permission). */
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
    const next = !on
    setOn(next)
    setRemindersEnabled(id, next)
    if (!next) return
    const sys = await ensureNotifyPermission()
    toast.success(sys
      ? `เปิดเตือนแล้ว — ก่อนเวลา ${lead} นาที และตอนถึงเวลา`
      : `เปิดเตือนในแอปแล้ว (ก่อนเวลา ${lead} นาที และตอนถึงเวลา)`)
  }

  async function togglePush() {
    if (!push || busy) return
    setBusy(true)
    try {
      if (push.subscribed) {
        await disablePush()
        setPush({ ...push, subscribed: false })
        toast.info('ปิดการเตือนตอนปิดแอปของเครื่องนี้แล้ว')
      } else {
        const { error } = await enablePush(lead)
        if (error) toast.error(error)
        else {
          setPush({ ...push, subscribed: true, permission: 'granted' })
          toast.success('เปิดแล้ว — เครื่องนี้จะได้รับแจ้งเตือนแม้ปิดแอป')
        }
      }
    } finally { setBusy(false) }
  }

  function changeLead(m: number) {
    setLeadState(m)
    setReminderLead(id, m)
    if (push?.subscribed) setPushLead(m).catch(() => { /* offline — resync later */ })
  }

  const pushHint = !push ? 'กำลังตรวจสอบ…'
    : push.subscribed ? 'เปิดอยู่ — เด้งเตือนแม้ปิดแอป ตามเวลาทริป'
      : !push.supported ? 'iOS: เพิ่มแอปลงหน้าโฮมก่อน (ปุ่มแชร์ → เพิ่มลงหน้าจอโฮม)'
        : !push.configured ? 'รอตั้งค่ากุญแจบนเซิร์ฟเวอร์ (ตามขั้นตอนที่ส่งให้)'
          : 'ปิดอยู่ — เปิดเพื่อรับเตือนตอนไม่ได้เปิดแอป'

  return (
    <div className="card px-3.5 py-2.5">
      <div className="flex items-center gap-2.5">
        <IconBellRinging size={16} className={on ? 'text-brand shrink-0' : 'text-ink-3 shrink-0'} />
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-medium leading-tight">เตือนตามแพลน (ของใครของมัน)</div>
          <div className="text-[10.5px] text-ink-3 leading-tight mt-0.5">เตือนล่วงหน้า + ตรงเวลา ตามไทม์โซนทริป</div>
        </div>
        {on && (
          <select
            value={lead}
            onChange={(e) => changeLead(Number(e.target.value))}
            className="hairline rounded-md h-8 text-[12px] px-1.5 bg-surface outline-none shrink-0"
            aria-label="เตือนล่วงหน้า">
            {LEAD_CHOICES.map((m) => <option key={m} value={m}>{m} นาที</option>)}
          </select>
        )}
        <Switch on={on} onClick={toggle} label="เปิด/ปิดการเตือน" />
      </div>

      {on && (
        <div className="flex items-center gap-2.5 mt-2.5 pt-2.5" style={{ borderTop: '0.5px solid var(--color-line)' }}>
          <IconDeviceMobileMessage size={16} className={push?.subscribed ? 'text-brand shrink-0' : 'text-ink-3 shrink-0'} />
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium leading-tight">เตือนแม้ปิดแอป</div>
            <div className="text-[10.5px] text-ink-3 leading-tight mt-0.5">{pushHint}</div>
          </div>
          <Switch on={!!push?.subscribed} onClick={togglePush} label="เปิด/ปิดเตือนตอนปิดแอป"
            disabled={!push || busy || (!push.subscribed && (!push.supported || !push.configured))} />
        </div>
      )}
    </div>
  )
}
