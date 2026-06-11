import { useState } from 'react'
import { IconPin, IconPinFilled } from '@tabler/icons-react'

const KEY = 'trip:pinnedColors'
const DEFAULTS = ['#185FA5', '#378ADD', '#EF9F27', '#7F77DD', '#888780']

function loadPins(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) { const a = JSON.parse(raw); if (Array.isArray(a) && a.length) return a.slice(0, 5) }
  } catch { /* ignore */ }
  return DEFAULTS
}

/** Color picker: pinned swatches (max 5 recent) + a colour wheel to pick new. */
export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [pins, setPins] = useState<string[]>(loadPins)
  const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
  const isPinned = pins.some((p) => eq(p, value))

  function pin() {
    setPins((prev) => {
      const next = [value, ...prev.filter((p) => !eq(p, value))].slice(0, 5)
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  return (
    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
      {pins.map((p) => (
        <button key={p} onClick={() => onChange(p)} title={p}
          className="size-7 rounded-full" style={{ background: p, outline: eq(p, value) ? '2px solid var(--color-ink)' : 'none', outlineOffset: 2 }} />
      ))}

      {/* colour wheel (native picker) */}
      <label className="size-7 rounded-full grid place-items-center cursor-pointer relative overflow-hidden shrink-0" title="เลือกสีจากวงล้อสี"
        style={{ background: 'conic-gradient(red, orange, yellow, lime, aqua, blue, magenta, red)' }}>
        <span className="size-4 rounded-full" style={{ background: value, boxShadow: '0 0 0 2px #fff' }} />
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
      </label>

      {/* pin current colour */}
      <button onClick={pin} title="ปักหมุดสีนี้ไว้ใช้ซ้ำ"
        className="size-7 rounded-full grid place-items-center text-ink-3 hover:text-brand" style={{ border: '0.5px solid var(--color-line)' }}>
        {isPinned ? <IconPinFilled size={14} className="text-brand" /> : <IconPin size={14} />}
      </button>
    </div>
  )
}
