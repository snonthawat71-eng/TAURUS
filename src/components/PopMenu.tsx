import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconDots } from '@tabler/icons-react'

export interface PopMenuItem {
  label: string
  icon: ReactNode
  onClick: () => void
  danger?: boolean
}

// keep the menu clear of the top bar and the mobile bottom nav
const SAFE_TOP = 12
const SAFE_BOTTOM = 84
const ITEM_H = 36 // h-9
const PAD = 8 // p-1 top+bottom
const GAP = 4 // gap between button and menu

type Placement = { right: number; maxHeight: number } & ({ top: number } | { bottom: number })

export function PopMenu({ items, size = 28, buttonClassName = '' }: { items: PopMenuItem[]; size?: number; buttonClassName?: string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Placement | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  function openMenu() {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const vh = window.innerHeight
    const right = Math.max(8, window.innerWidth - r.right)
    const wanted = items.length * ITEM_H + PAD // estimated full height
    const spaceBelow = vh - SAFE_BOTTOM - (r.bottom + GAP)
    const spaceAbove = r.top - GAP - SAFE_TOP
    // flip up when it wouldn't fit below AND there's more room above —
    // then clamp maxHeight to the chosen side so it never runs off-screen
    if (wanted > spaceBelow && spaceAbove > spaceBelow) {
      setPos({ right, bottom: vh - r.top + GAP, maxHeight: Math.max(120, Math.min(wanted, spaceAbove)) })
    } else {
      setPos({ right, top: r.bottom + GAP, maxHeight: Math.max(120, Math.min(wanted, spaceBelow)) })
    }
    setOpen(true)
  }

  // dropdown is portaled (see below) so it can't be clipped by a card's
  // overflow-hidden — but that means its position is a snapshot, so close it
  // if the page scrolls or resizes underneath instead of drifting stale
  useLayoutEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  return (
    <div className="relative shrink-0">
      <button ref={btnRef} className={`btn-icon !border-0 ${buttonClassName}`} style={{ width: size, height: size }} onClick={() => (open ? setOpen(false) : openMenu())} aria-label="เมนู">
        <IconDots size={16} />
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed w-40 card p-1 shadow-lg z-50 overflow-y-auto"
            style={{
              right: pos.right,
              maxHeight: pos.maxHeight,
              ...('top' in pos ? { top: pos.top } : { bottom: pos.bottom }),
            }}
          >
            {items.map((it, i) => (
              <button
                key={i}
                onClick={() => { setOpen(false); it.onClick() }}
                className={[
                  'w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-[13px] hover:bg-surface-2',
                  it.danger ? 'text-[#D85A30]' : 'text-ink-2',
                ].join(' ')}
              >
                {it.icon} {it.label}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}
