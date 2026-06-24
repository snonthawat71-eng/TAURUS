import { useEffect, useState } from 'react'
import { IconBell, IconLoader2, IconCheck, IconClock } from '@tabler/icons-react'
import { getPushState, enablePush, disablePush, setLead, type PushState } from '@/lib/push'
import { toast } from '@/lib/toast'
import { Drawer } from './Drawer'

const LEADS = [
  { v: 0, label: 'ตรงเวลา', desc: 'เด้งแจ้งเตือนพอดีเวลากิจกรรม' },
  { v: 5, label: 'ก่อน 5 นาที', desc: 'เด้งล่วงหน้า 5 นาที' },
  { v: 15, label: 'ก่อน 15 นาที', desc: 'เด้งล่วงหน้า 15 นาที' },
  { v: 30, label: 'ก่อน 30 นาที', desc: 'เด้งล่วงหน้า 30 นาที' },
]

export function NotificationSettings() {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [choosing, setChoosing] = useState(false)

  useEffect(() => { getPushState().then(setState) }, [])

  // Hide entirely if the device can't do push or the server has no VAPID key —
  // no point showing a control that can never work.
  if (!state || !state.supported || !state.configured) return null

  async function toggle() {
    if (!state) return
    if (state.subscribed) {
      setBusy(true)
      await disablePush()
      toast.info('ปิดการแจ้งเตือนแล้ว')
      setState(await getPushState())
      setBusy(false)
    } else {
      // Ask how the user wants to be reminded BEFORE subscribing.
      setChoosing(true)
    }
  }

  // Called from the chooser. Runs inside the tap so iOS allows the permission prompt.
  async function confirmEnable(v: number) {
    setChoosing(false)
    setBusy(true)
    const { error } = await enablePush(v)
    if (error) toast.error(error)
    else toast.success(`เปิดการแจ้งเตือนแล้ว · ${LEADS.find((l) => l.v === v)?.label ?? `${v} นาที`}`)
    setState(await getPushState())
    setBusy(false)
  }

  async function pickLead(v: number) {
    if (!state) return
    setState({ ...state, leadMinutes: v })
    if (state.subscribed) { await setLead(v); toast.success('อัปเดตเวลาแจ้งเตือนแล้ว') }
  }

  return (
    <div className="card p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="size-9 rounded-md grid place-items-center shrink-0" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}>
            <IconBell size={18} />
          </span>
          <div className="min-w-0">
            <div className="text-[14px] font-medium">แจ้งเตือนเมื่อถึงเวลาตามแพลน</div>
            <div className="text-[11px] text-ink-3">เด้งบนมือถือก่อนถึงกิจกรรมในแผนการเดินทาง</div>
          </div>
        </div>
        <button onClick={toggle} disabled={busy} role="switch" aria-checked={state.subscribed}
          className="relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50"
          style={{ background: state.subscribed ? 'var(--color-brand)' : 'var(--color-line-2)' }}>
          <span className="absolute top-0.5 size-5 rounded-full bg-white shadow transition-all" style={{ left: state.subscribed ? '22px' : '2px' }}>
            {busy && <IconLoader2 size={14} className="animate-spin absolute inset-0 m-auto text-ink-3" />}
          </span>
        </button>
      </div>

      {/* Once on, the chosen lead time can be changed here too. */}
      {state.subscribed && (
        <div className="mt-3 pt-3" style={{ borderTop: '0.5px solid var(--color-line)' }}>
          <div className="text-[11px] text-ink-3 mb-1.5">เตือนล่วงหน้า</div>
          <div className="flex gap-1.5 flex-wrap">
            {LEADS.map((o) => (
              <button key={o.v} onClick={() => pickLead(o.v)}
                className={['chip', state.leadMinutes === o.v ? '!bg-brand-soft !text-brand-dark' : ''].join(' ')}
                style={state.leadMinutes === o.v ? { border: '0.5px solid var(--color-brand-border)' } : undefined}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {state.permission === 'denied' && (
        <p className="text-[11px] text-[#D85A30] mt-2">เบราว์เซอร์บล็อกการแจ้งเตือนไว้ — เปิดสิทธิ์ในตั้งค่าเบราว์เซอร์ก่อน</p>
      )}

      {/* Ask-on-enable chooser */}
      <Drawer open={choosing} onClose={() => setChoosing(false)} title="ตั้งค่าการแจ้งเตือนตามแพลน">
        <p className="text-[12px] text-ink-3 -mt-1 mb-3">อยากให้เด้งเตือนล่วงหน้ากี่นาทีก่อนถึงเวลากิจกรรม?</p>
        <div className="space-y-2">
          {LEADS.map((o) => (
            <button key={o.v} onClick={() => confirmEnable(o.v)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hairline bg-surface hover:bg-surface-2 text-left">
              <span className="size-9 rounded-md grid place-items-center shrink-0" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}>
                <IconClock size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium">{o.label}</div>
                <div className="text-[11px] text-ink-3">{o.desc}</div>
              </div>
              {state.leadMinutes === o.v && <IconCheck size={18} className="text-brand shrink-0" />}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-ink-3 mt-3">เลือกแล้วระบบจะขอสิทธิ์แจ้งเตือนจากเบราว์เซอร์ต่อ</p>
      </Drawer>
    </div>
  )
}
