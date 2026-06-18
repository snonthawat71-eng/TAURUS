import { useLayoutEffect, useRef, useState, Fragment } from 'react'
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
  const [rect, setRect] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null)

  const q = value.trim().toLowerCase()
  const exact = options.some((o) => o.value.toLowerCase() === q)
  const filtered = !q || exact
    ? options
    : options.filter((o) => o.value.toLowerCase().includes(q) || (o.label ?? '').toLowerCase().includes(q))

  // Anchor the portaled list to the input. Uses the *visual* viewport so the
  // on-screen keyboard (which shifts/shrinks the viewport on iOS) is accounted
  // for, and flips the list above the field when there isn't room below.
  function place() {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vv = window.visualViewport
    const viewTop = vv ? vv.offsetTop : 0
    const viewBottom = viewTop + (vv ? vv.height : window.innerHeight)
    const GAP = 4, MAXH = 224, MIN = 132
    const below = viewBottom - r.bottom - GAP
    const above = r.top - viewTop - GAP
    const up = below < MIN && above > below
    const maxHeight = Math.max(MIN, Math.min(MAXH, up ? above : below))
    const top = up ? Math.max(viewTop + GAP, r.top - GAP - maxHeight) : r.bottom + GAP
    const next = { left: r.left, top, width: r.width, maxHeight }
    setRect((prev) => (prev && prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.maxHeight === next.maxHeight ? prev : next))
  }

  // While open, keep it glued to the input every frame — robust against the
  // iOS focus-scroll, keyboard animation and the Drawer's own scrolling.
  useLayoutEffect(() => {
    if (!open) return
    let raf = 0
    const tick = () => { place(); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    const onDoc = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => { cancelAnimationFrame(raf); document.removeEventListener('mousedown', onDoc) }
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
          // Stop touch events from bubbling (React portals bubble through the
          // React tree) into a parent Drawer's swipe-to-close handler, and keep
          // the scroll contained so dragging the list never moves the page/sheet.
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          style={{ position: 'fixed', left: rect.left, top: rect.top, width: rect.width, maxHeight: rect.maxHeight, zIndex: 200, overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          className="overflow-auto rounded-md bg-surface shadow-lg hairline py-1">
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
