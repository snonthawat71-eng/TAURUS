import { useEffect, useMemo, useState } from 'react'
import { IconArrowsExchange, IconRefresh } from '@tabler/icons-react'
import { CURRENCIES, getRateToTHB, type FxResult } from '@/lib/fx'
import { useTrip } from '@/contexts/TripContext'
import { useActiveSegment } from '@/lib/segments'

const THB = { code: 'THB', symbol: '฿', flag: '🇹🇭' }

/** Currency calculator for the note panel: type a number in the trip's city
 *  currency and it's multiplied by today's rate to THB (and back). */
export function NoteFxCalc() {
  const { trip } = useTrip()
  const active = useActiveSegment(trip)
  const code = useMemo(() => {
    const c = active?.currency ?? trip?.currency ?? 'CNY'
    return CURRENCIES.some((x) => x.code === c) ? c : 'CNY'
  }, [active?.currency, trip?.currency])
  const cur = CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0]

  const [fx, setFx] = useState<FxResult | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => { let on = true; setFx(null); getRateToTHB(code).then((r) => on && setFx(r)); return () => { on = false } }, [code])
  async function refresh() { setRefreshing(true); setFx(await getRateToTHB(code, true)); setRefreshing(false) }

  // amount is always entered in the "from" currency; swap flips direction
  const [swapped, setSwapped] = useState(false) // false: city→THB, true: THB→city
  const [amount, setAmount] = useState('')
  const from = swapped ? THB : cur
  const to = swapped ? cur : THB
  const rate = fx?.rate ?? 0
  const n = parseFloat(amount.replace(',', '.'))
  const result = !Number.isFinite(n) || !rate ? null : swapped ? n / rate : n * rate
  const resultText = result == null ? '—' : result.toLocaleString('en-US', { maximumFractionDigits: 2 })
  const rateText = fx ? fx.rate.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'

  const status = !fx ? { color: 'var(--color-ink-3)', label: '…' }
    : fx.live ? { color: '#1E8E5A', label: 'วันนี้' }
    : fx.approx ? { color: '#C99A3A', label: 'ประมาณ' }
    : { color: '#C99A3A', label: 'เรตเก่า' }

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-ink-3 font-medium">💱 แปลงค่าเงิน</span>
        <button onClick={refresh} disabled={refreshing} className="flex items-center gap-1 text-[10.5px] font-medium disabled:opacity-50" style={{ color: status.color }}>
          <span className="size-1.5 rounded-full" style={{ background: status.color }} /> {status.label}
          <IconRefresh size={10} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex items-stretch gap-2">
        <label className="flex-1 min-w-0">
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
            placeholder="0" className="w-full hairline rounded-md h-11 px-3 text-[16px] font-medium bg-surface outline-none focus:border-brand tabular-nums" />
          <div className="text-[10px] text-ink-3 mt-0.5 truncate">{from.flag} {from.code}</div>
        </label>

        <button onClick={() => setSwapped((v) => !v)} className="shrink-0 self-start mt-[6px] size-8 grid place-items-center rounded-full hairline bg-surface text-ink-2 hover:bg-surface-2" aria-label="สลับสกุลเงิน" title="สลับ">
          <IconArrowsExchange size={16} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="h-11 px-3 rounded-md bg-surface-2 flex items-center text-[16px] font-semibold tabular-nums truncate">
            {to.symbol}{resultText}
          </div>
          <div className="text-[10px] text-ink-3 mt-0.5 truncate">{to.flag} {to.code}</div>
        </div>
      </div>

      <div className="text-[10px] text-ink-3 mt-2">{cur.symbol}1 = ฿{rateText}{fx && !fx.live ? ` · ${fx.approx ? 'ค่าประมาณ' : `เรต ${fx.date}`}` : ''}</div>
    </div>
  )
}
