import { IconChevronRight, IconMap2 } from '@tabler/icons-react'

/** Entry card for the trip map. A stylised map graphic (pure SVG, no tiles /
 *  no network) bleeds in from the right and the card surface fades over the
 *  left so the title stays legible. Tapping anywhere opens the full map. */
export function TripMapCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button onClick={onOpen}
      className="relative w-full mb-3 h-[124px] rounded-[16px] overflow-hidden text-left bg-surface hairline shadow-sm">
      {/* decorative map graphic */}
      <svg aria-hidden viewBox="0 0 440 124" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full">
        {/* soft blocks (city grid) */}
        <g fill="var(--color-surface-2)">
          <rect x="250" y="14" width="52" height="30" rx="4" />
          <rect x="312" y="10" width="40" height="26" rx="4" />
          <rect x="362" y="20" width="46" height="34" rx="4" />
          <rect x="266" y="76" width="44" height="30" rx="4" />
          <rect x="330" y="70" width="60" height="40" rx="4" />
          <rect x="398" y="60" width="42" height="46" rx="4" />
        </g>
        {/* a green park + a strip of water */}
        <rect x="228" y="58" width="34" height="26" rx="5" fill="#DCEBDD" opacity="0.9" />
        <path d="M300 124 L316 96 L360 84 L392 60 L440 44 L440 124 Z" fill="#CFE3F1" opacity="0.55" />
        {/* roads */}
        <g stroke="var(--color-line)" strokeWidth="5" fill="none" strokeLinecap="round">
          <path d="M220 52 L440 40" />
          <path d="M240 96 L440 104" />
          <path d="M300 0 L322 124" />
          <path d="M388 0 L372 124" />
        </g>
        <g stroke="#fff" strokeWidth="1.5" fill="none" strokeDasharray="2 5" opacity="0.8">
          <path d="M220 52 L440 40" />
          <path d="M300 0 L322 124" />
        </g>
      </svg>
      {/* the brand location pin */}
      <span className="absolute" style={{ right: 62, top: 38 }}>
        <span className="block size-9 rounded-full" style={{ background: 'var(--color-brand)', opacity: 0.16 }} />
        <svg viewBox="0 0 24 24" width="26" height="26" className="absolute" style={{ left: 5, top: -2, color: 'var(--color-brand)' }} fill="currentColor">
          <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" />
        </svg>
      </span>
      {/* fade the left back to the surface so the text stays legible */}
      <div aria-hidden className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(90deg, var(--color-surface) 0%, var(--color-surface) 42%, color-mix(in srgb, var(--color-surface) 35%, transparent) 66%, transparent 100%)' }} />
      {/* content */}
      <div className="relative h-full flex flex-col justify-center px-4 pr-28">
        <div className="flex items-center gap-1.5 text-ink">
          <IconMap2 size={20} />
          <span className="text-[16px] font-bold leading-tight">แผนที่ทริป</span>
        </div>
        <span className="text-[12.5px] text-ink-2 mt-1.5">ดูทุกสถานที่ปักหมุดตามตำแหน่งจริง</span>
        <span className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-brand mt-2.5">
          เปิดแผนที่ <IconChevronRight size={15} />
        </span>
      </div>
    </button>
  )
}
