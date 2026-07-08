import { useEffect, useMemo, useState } from 'react'
import { IconArrowsExchange, IconRefresh, IconChevronDown, IconCheck } from '@tabler/icons-react'
import { CURRENCIES, getRateToTHB, type FxResult } from '@/lib/fx'
import { useTrip } from '@/contexts/TripContext'
import { useActiveSegment } from '@/lib/segments'

const THB = { code: 'THB', symbol: '฿', flag: '🇹🇭' }

/** Currency calculator for the note panel: type a number in the trip's city
 *  currency and it's multiplied by today's rate to THB (and back). Tap the
 *  currency chip to switch — the trip's plan currencies are offered first. */
export function NoteFxCalc() {
  const { trip } = useTrip()
  const active = useActiveSegment(trip)
  const autoCode = useMemo(() => {
    const c = active?.currency ?? trip?.currency ?? 'CNY'
    return CURRENCIES.some((x) => x.code === c) ? c : 'CNY'
  }, [active?.currency, trip?.currency])

  // currencies used across the trip's plan (segments) — offered first in the picker
  const planCodes = useMemo(() => {
    const set = new Set<string>()
    for (const s of trip?.segments ?? []) if (s?.currency) set.add(s.currency)
    if (trip?.currency) set.add(trip.currency)
    return [...set].filter((c) => c !== 'THB' && CURRENCIES.some((x) => x.code === c))
  }, [trip?.segments, trip?.currency])

  // manual override (null = follow the active plan segment)
  const [override, setOverride] = useState<string | null>(null)
  const code = override ?? autoCode
  const cur = CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0]
  const [pickOpen, setPickOpen] = useState(false)

  const [fx, setFx] = useState<FxResult | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => { let on = true; setFx(null); getRateToTHB(code).then((r) => on && setFx(r)); return () => { on = false } }, [code])
  async function refresh() { setRefreshing(true); setFx(await getRateToTHB(code, true)); setRefreshing(false) }

  const [swapped, setSwapped] = useState(false) // false: city→THB, true: THB→city
  const [amount, setAmount] = useState('')
  const from = swapped ? THB : cur
  const to = swapped ? cur : THB
  const rate = fx?.rate ?? 0
  const n = parseFloat(amount.replace(',', '.'))
  const result = !Number.isFinite(n) || !rate ? null : swapped ? n / rate : n * rate
  const resultText = result == null ? '—' : result.toLocaleString('en-US', { maximumFractionDigits: 2 })
  const rateText = fx ? fx.rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'

  const status = !fx ? { color: 'var(--color-ink-3)', label: '…' }
    : fx.live ? { color: '#1E8E5A', label: 'วันนี้' }
    : fx.approx ? { color: '#C99A3A', label: 'ประมาณ' }
    : { color: '#C99A3A', label: 'เรตเก่า' }

  function pick(c: string) { setOverride(c); setPickOpen(false) }

  return (
    <div className="card p-3 relative">
      <div className="flex items-center justify-between mb-2">
        {/* currency picker chip */}
        <div className="relative">
          <button onClick={() => setPickOpen((v) => !v)} className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-2 h-6 pl-1.5 pr-2 rounded-full bg-surface-2">
            <span>{cur.flag}</span> {cur.code} <IconChevronDown size={12} className="text-ink-3" />
          </button>
          {pickOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPickOpen(false)} />
              <div className="absolute left-0 bottom-full mb-1.5 w-48 max-h-64 overflow-y-auto card p-1 shadow-lg z-50">
                {planCodes.length > 0 && <div className="px-2 pt-1 pb-0.5 text-[10px] text-ink-3">ค่าเงินตามแพลน</div>}
                {planCodes.map((c) => <CurRow key={`p${c}`} c={c} sel={c === code} onPick={pick} />)}
                {planCodes.length > 0 && <div className="my-1" style={{ borderTop: '0.5px solid var(--color-line)' }} />}
                {CURRENCIES.map((c) => <CurRow key={c.code} c={c.code} sel={c.code === code} onPick={pick} />)}
              </div>
            </>
          )}
        </div>
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

function CurRow({ c, sel, onPick }: { c: string; sel: boolean; onPick: (c: string) => void }) {
  const meta = CURRENCIES.find((x) => x.code === c)
  if (!meta) return null
  return (
    <button onClick={() => onPick(c)} className={['w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-[12px] hover:bg-surface-2', sel ? 'text-ink font-medium' : 'text-ink-2'].join(' ')}>
      <span>{meta.flag}</span>
      <span className="flex-1 text-left truncate">{meta.name}</span>
      {sel ? <IconCheck size={14} className="text-brand" /> : <span className="text-ink-3">{meta.code}</span>}
    </button>
  )
}
