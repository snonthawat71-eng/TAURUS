import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconQrcode, IconChevronDown } from '@tabler/icons-react'
import type { TravelerFile } from '@/lib/database.types'

/**
 * A single chip that stands in for a traveler's QR files (eSIM, Airport Express,
 * boarding pass…). Click it to drop down a quick picker and open any of them —
 * keeps the card clean instead of one chip per QR. Renders as a <span> (not a
 * button) so it can live inside the card's button without nesting.
 */
export function QrDropdown({ files, onView }: {
  files: TravelerFile[]
  onView: (f: TravelerFile) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })

  function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos({ left: r.left, top: r.bottom + 4 })
    setOpen((v) => !v)
  }

  return (
    <>
      <span ref={ref} onClick={toggle} role="button" tabIndex={0}
        className="chip hover:bg-surface-2 cursor-pointer select-none">
        <IconQrcode size={12} /> QR · {files.length}
        <IconChevronDown size={11} className={`text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </span>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={(e) => { e.stopPropagation(); setOpen(false) }} />
          <div className="fixed z-[61] card p-1 shadow-lg w-52 max-h-[60vh] overflow-y-auto"
            style={{ left: pos.left, top: pos.top }} onClick={(e) => e.stopPropagation()}>
            {files.map((f) => (
              <button key={f.id} onClick={(e) => { e.stopPropagation(); setOpen(false); onView(f) }}
                className="w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-[13px] text-ink-2 hover:bg-surface-2 text-left">
                <IconQrcode size={15} className="text-brand shrink-0" />
                <span className="truncate">{f.label || 'QR'}</span>
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
