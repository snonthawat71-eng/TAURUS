import { IconStarFilled, IconStar } from '@tabler/icons-react'

/** 5 stars with fractional fill based on `rating` (0–5). When `empty` (no
 *  ratings yet) it renders hollow outline stars instead of a flat grey row. */
export function StarRating({ rating, size = 14, empty = false }: { rating: number; size?: number; empty?: boolean }) {
  if (empty) {
    return (
      <span className="inline-flex" style={{ lineHeight: 0, color: '#C4C8D0' }} aria-label="ยังไม่มีคะแนน">
        {[0, 1, 2, 3, 4].map((i) => <IconStar key={i} size={size} className="shrink-0" stroke={1.6} />)}
      </span>
    )
  }
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100))
  const row = [0, 1, 2, 3, 4].map((i) => <IconStarFilled key={i} size={size} className="shrink-0" />)
  return (
    <span className="relative inline-flex" style={{ lineHeight: 0 }} aria-label={`${rating} จาก 5 ดาว`}>
      <span className="inline-flex" style={{ color: '#E2E5EA' }}>{row}</span>
      <span className="absolute inset-0 inline-flex overflow-hidden" style={{ width: `${pct}%`, color: '#F5A623' }}>{row}</span>
    </span>
  )
}
