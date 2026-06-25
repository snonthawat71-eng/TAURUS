import { useState, type ReactNode } from 'react'
import { IconDots } from '@tabler/icons-react'

export interface PopMenuItem {
  label: string
  icon: ReactNode
  onClick: () => void
  danger?: boolean
}

export function PopMenu({ items, size = 28, buttonClassName = '' }: { items: PopMenuItem[]; size?: number; buttonClassName?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative shrink-0">
      <button className={`btn-icon !border-0 ${buttonClassName}`} style={{ width: size, height: size }} onClick={() => setOpen((v) => !v)} aria-label="เมนู">
        <IconDots size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-40 card p-1 shadow-lg z-50">
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
        </>
      )}
    </div>
  )
}
