import { useEffect, useLayoutEffect, useRef, useState, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { IconChevronDown } from '@tabler/icons-react'

export interface ComboOption { value: string; label?: string; color?: string; group?: string }

/**
 * Free-text input with a suggestion dropdown — a replacement for native
 * <datalist>, which only offers the single matching option once the field
 * already holds an exact value (forcing users to clear it to re-pick).
 * Here the full list reopens on focus/click whenever the value is empty or
 * exactly matches an option; typing filters it; any custom value is allowed.
 * The list is portaled to <body> so a Drawer's scroll container can't clip it.
 */
export function Combobox({
  value, onChange, onPick, options, placeholder, className, disabled,
}: {
  value: string
  onChange: (v: string) => void
  onPick?: (v: string) => void
  options: ComboOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null)

  const q = value.trim().toLowerCase()
  const exact = options.some((o) => o.value.toLowerCase() === q)
  const filtered = !q || exact
    ? options
    : options.filter((o) => o.value.toLowerCase().includes(q) || (o.label ?? '').toLowerCase().includes(q))

  function place() {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setRect({ left: r.left, top: r.bottom + 4, width: r.width })
  }
  useLayoutEffect(() => { if (open) place() }, [open])
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false) }
    const onMove = () => place()
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open])

  function choose(v: string) {
    onChange(v)
    onPick?.(v)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        className={className}
        style={options.length ? { paddingRight: 28 } : undefined}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
      />
      {options.length > 0 && (
        <button type="button" tabIndex={-1} aria-label="แสดงตัวเลือก"
          onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); inputRef.current?.focus() }}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2 p-1">
          <IconChevronDown size={15} />
        </button>
      )}
      {open && rect && filtered.length > 0 && createPortal(
        <div
          style={{ position: 'fixed', left: rect.left, top: rect.top, width: rect.width, zIndex: 200 }}
          className="max-h-56 overflow-auto rounded-md bg-surface shadow-lg hairline py-1">
          {(() => {
            // only show group headers/dividers when more than one group is present
            const groups = new Set(filtered.map((o) => o.group).filter((g) => g !== undefined))
            const showHeaders = groups.size > 1
            let last: string | undefined
            return filtered.map((o, idx) => {
              const header = showHeaders && o.group !== undefined && o.group !== last
              last = o.group
              return (
                <Fragment key={`${o.group ?? ''}::${o.value}`}>
                  {header && (
                    <div className={`px-3 pb-1 text-[10px] font-medium uppercase tracking-wide text-ink-3 ${idx === 0 ? 'pt-1' : 'pt-2 mt-1 border-t border-line'}`}>{o.group}</div>
                  )}
                  <button type="button"
                    onMouseDown={(e) => { e.preventDefault(); choose(o.value) }}
                    className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-surface-2 flex items-center gap-2">
                    {o.color && <span className="size-2.5 rounded-full shrink-0" style={{ background: o.color }} />}
                    <span className="truncate">{o.value}</span>
                    {o.label && <span className="text-ink-3 text-[11px] ml-auto shrink-0">{o.label}</span>}
                  </button>
                </Fragment>
              )
            })
          })()}
        </div>,
        document.body,
      )}
    </div>
  )
}
