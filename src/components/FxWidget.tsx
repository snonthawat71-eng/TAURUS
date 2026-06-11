import { useEffect, useState } from 'react'
import { IconChevronDown } from '@tabler/icons-react'
import { CURRENCIES, getRateToTHB, type FxResult } from '@/lib/fx'

const CUR_KEY = 'fx:currency'

export function FxWidget() {
  const [code, setCode] = useState(() => localStorage.getItem(CUR_KEY) ?? 'CNY')
  const [fx, setFx] = useState<FxResult | null>(null)
  const [open, setOpen] = useState(false)

  const cur = CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0]

  useEffect(() => {
    let active = true
    setFx(null)
    getRateToTHB(code).then((r) => active && setFx(r))
    return () => { active = false }
  }, [code])

  function pick(c: string) {
    localStorage.setItem(CUR_KEY, c)
    setCode(c)
    setOpen(false)
  }

  return (
    <div className="m-3 card p-3 relative">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between text-[11px] text-ink-3">
        <span className="flex items-center gap-1">{cur.flag} อัตราแลกเปลี่ยน</span>
        <span className="flex items-center gap-0.5">
          {fx ? (fx.live ? 'วันนี้' : 'ออฟไลน์') : '...'}
          <IconChevronDown size={12} />
        </span>
      </button>
      <div className="text-[18px] font-medium mt-0.5 tabular-nums">
        {cur.symbol}1 = ฿{fx ? fx.rate.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
      </div>
      <div className="text-[10px] text-ink-3 mt-0.5">
        {fx?.live ? `อัปเดตจากเว็บ · ${fx.date}` : 'ค่าประมาณ (เชื่อมเน็ตไม่ได้)'}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-3 right-3 bottom-full mb-1 card p-1 shadow-lg z-50 max-h-64 overflow-y-auto">
            {CURRENCIES.map((c) => (
              <button key={c.code} onClick={() => pick(c.code)}
                className={['w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-[12px] hover:bg-surface-2', c.code === code ? 'text-ink font-medium' : 'text-ink-2'].join(' ')}>
                <span>{c.flag}</span>
                <span className="flex-1 text-left">{c.name}</span>
                <span className="text-ink-3">{c.code}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
