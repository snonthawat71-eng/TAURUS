import { useState } from 'react'
import { IconStar, IconStarFilled } from '@tabler/icons-react'

/**
 * Tappable 1–5 star input. Unlike `StarRating` (read-only, fractional fill)
 * this is the thing people actually press, so the targets are generous and the
 * hovered/pressed state previews the score before it's committed.
 */
export function StarInput({ value, onChange, size = 30, disabled = false, label }: {
  value: number | null | undefined
  onChange: (stars: number) => void
  size?: number
  disabled?: boolean
  /** accessible name for the whole group, e.g. "ให้คะแนนร้านนี้" */
  label?: string
}) {
  const [hover, setHover] = useState(0)
  const shown = hover || value || 0
  return (
    <div role="radiogroup" aria-label={label ?? 'ให้คะแนน 1 ถึง 5 ดาว'}
      className="inline-flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= shown
        return (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ดาว`}
            disabled={disabled}
            onMouseEnter={() => !disabled && setHover(n)}
            onClick={() => !disabled && onChange(n)}
            className="grid place-items-center rounded-full transition-transform active:scale-90 disabled:opacity-40"
            style={{ width: size + 8, height: size + 8, color: on ? '#F5A623' : '#C4C8D0' }}>
            {on ? <IconStarFilled size={size} /> : <IconStar size={size} stroke={1.6} />}
          </button>
        )
      })}
    </div>
  )
}
