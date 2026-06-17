import { useEffect, useState } from 'react'
import { IconChevronDown, IconRefresh } from '@tabler/icons-react'
import { CURRENCIES, getRateToTHB, type FxResult } from '@/lib/fx'
import { useTrip } from '@/contexts/TripContext'

const CUR_KEY = 'fx:currency'

export function FxWidget({ variant = 'card' }: { variant?: 'card' | 'bar' }) {
  const { trip } = useTrip()
  const [code, setCode] = useState(() => localStorage.getItem(CUR_KEY) ?? 'CNY')
  const [fx, setFx] = useState<FxResult | null>(null)
  const [open, setOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // follow the current trip's chosen currency
  useEffect(() => {
    if (trip?.currency && CURRENCIES.some((c) => c.code === trip.currency)) setCode(trip.currency)
  }, [trip?.currency])

  const cur = CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0]

  useEffect(() => {
    let active = true
    setFx(null)
    getRateToTHB(code).then((r) => active && setFx(r))
    return () => { active = false }
  }, [code])

  async function refresh() {
    setRefreshing(true)
    const r = await getRateToTHB(code, true)
    setFx(r)
    setRefreshing(false)
  }

  function pick(c: string) {
    localStorage.setItem(CUR_KEY, c)
    setCode(c)
    setOpen(false)
  }

  const rateText = fx ? fx.rate.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'

  // status badge: today's live rate (green) vs. a stale/approx rate (amber)
  const status = !fx
    ? { color: 'var(--color-ink-3)', label: '...' }
    : fx.live
      ? { color: '#1E8E5A', label: 'วันนี้' }
      : fx.approx
        ? { color: '#C99A3A', label: 'ประมาณ' }
        : { color: '#C99A3A', label: 'เรตเก่า' }
  const detail = !fx ? ''
    : fx.live ? `อัปเดตจากเว็บ · ${fx.date}`
    : fx.approx ? 'ค่าประมาณ (เชื่อมเน็ตไม่ได้)'
    : `เรตวันที่ ${fx.date} · แตะรีเฟรชเพื่ออัปเดต`

  const currencyList = (
    <div className="max-h-64 overflow-y-auto">
      {CURRENCIES.map((c) => (
        <button key={c.code} onClick={() => pick(c.code)}
          className={['w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-[12px] hover:bg-surface-2', c.code === code ? 'text-ink font-medium' : 'text-ink-2'].join(' ')}>
          <span>{c.flag}</span>
          <span className="flex-1 text-left">{c.name}</span>
          <span className="text-ink-3">{c.code}</span>
        </button>
      ))}
    </div>
  )

  // compact pill for the mobile top bar — opens a panel downward
  if (variant === 'bar') {
    return (
      <div className="relative">
        <button onClick={() => setOpen((v) => !v)} title="อัตราแลกเปลี่ยน"
          className="btn-icon !w-auto px-2.5 gap-1.5 text-[12px] font-medium tabular-nums">
          <span>{cur.flag}</span>
          <span>฿{rateText}</span>
          <span className="size-1.5 rounded-full" style={{ background: status.color }} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1.5 w-60 card p-3 shadow-lg z-50">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium">{cur.flag} อัตราแลกเปลี่ยน</span>
                <button onClick={refresh} disabled={refreshing} className="flex items-center gap-1 text-[11px] font-medium disabled:opacity-50" style={{ color: status.color }}>
                  <span className="size-1.5 rounded-full" style={{ background: status.color }} />
                  {status.label}
                  <IconRefresh size={11} className={refreshing ? 'animate-spin' : ''} />
                </button>
              </div>
              <div className="text-[18px] font-medium mt-0.5 tabular-nums">{cur.symbol}1 = ฿{rateText}</div>
              <div className="text-[10px] text-ink-3 mt-0.5 mb-2">{detail}</div>
              <div style={{ borderTop: '0.5px solid var(--color-line)' }} className="pt-1">{currencyList}</div>
            </div>
          </>
        )}
      </div>
    )
  }

  // full card for the sidebar
  return (
    <div className="m-3 card p-3 relative">
      <div className="flex items-center justify-between">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-[11px] text-ink-3">
          <span className="flex items-center gap-1">{cur.flag} อัตราแลกเปลี่ยน</span>
          <IconChevronDown size={12} />
        </button>
        <button onClick={refresh} disabled={refreshing} className="flex items-center gap-1 text-[11px] font-medium disabled:opacity-50" style={{ color: status.color }} title="รีเฟรชอัตราแลกเปลี่ยน">
          <span className="size-1.5 rounded-full" style={{ background: status.color }} />
          {status.label}
          <IconRefresh size={11} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="text-[18px] font-medium mt-0.5 tabular-nums">
        {cur.symbol}1 = ฿{rateText}
      </div>
      <div className="text-[10px] text-ink-3 mt-0.5">{detail}</div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-3 right-3 bottom-full mb-1 card p-1 shadow-lg z-50">{currencyList}</div>
        </>
      )}
    </div>
  )
}
