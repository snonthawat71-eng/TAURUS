import { useEffect, useRef, useState, Fragment } from 'react'
import { IconChevronDown } from '@tabler/icons-react'

export interface ComboOption { value: string; label?: string; color?: string; group?: string }

/**
 * Free-text input with a suggestion dropdown — a replacement for native
 * <datalist>, which only offers the single matching option once the field
 * already holds an exact value (forcing users to clear it to re-pick).
 * Here the full list reopens on focus/click whenever the value is empty or
 * exactly matches an option; typing filters it; any custom value is allowed.
 *
 * The list renders inline (in normal flow, right under the input) rather than
 * a floating overlay: inside a Drawer's scroll container that's far more robust
 * on mobile — it scrolls with the sheet and the on-screen keyboard can't strand
 * or detach it.
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
  const listRef = useRef<HTMLDivElement>(null)

  const q = value.trim().toLowerCase()
  const exact = options.some((o) => o.value.toLowerCase() === q)
  const filtered = !q || exact
    ? options
    : options.filter((o) => o.value.toLowerCase().includes(q) || (o.label ?? '').toLowerCase().includes(q))

  // close when tapping/clicking outside the field+list. `mousedown` (not
  // `pointerdown`) is intentional: a touch-scroll never fires mousedown, so
  // scrolling the sheet to reach an item won't dismiss the list.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // The dropdown renders inline below the input; on mobile the on-screen
  // keyboard slides up ~a frame after focus and can cover it. Scroll the list
  // into view on open, and again whenever the visual viewport resizes (the
  // keyboard finishing its animation), so the Drawer's scroll area lifts the
  // options above the keyboard instead of stranding them behind it.
  useEffect(() => {
    if (!open) return
    const reveal = () => listRef.current?.scrollIntoView({ block: 'nearest' })
    const t = setTimeout(reveal, 120)
    const vv = window.visualViewport
    vv?.addEventListener('resize', reveal)
    return () => { clearTimeout(t); vv?.removeEventListener('resize', reveal) }
  }, [open])

  function choose(v: string) {
    onChange(v)
    onPick?.(v)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
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
      </div>
      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          // keep inner scrolling contained so it doesn't drag the sheet/page
          onTouchMove={(e) => e.stopPropagation()}
          style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
          className="mt-1 max-h-56 overflow-auto rounded-md bg-surface shadow-lg hairline py-1 relative z-20">
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
        </div>
      )}
    </div>
  )
}
