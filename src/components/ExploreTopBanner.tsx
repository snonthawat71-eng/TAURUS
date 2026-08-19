import { useEffect, useMemo, useRef, useState } from 'react'
import { IconChevronRight } from '@tabler/icons-react'
import { SignedImage } from './SignedImage'
import { TOP_LABEL, type TopList } from '@/lib/exploreTop'

const AUTO_MS = 15000
/** how far a finger has to travel before it counts as a swipe, not a tap */
const SWIPE_PX = 40

/**
 * The "ที่เด็ด" banner under the search box: one card per country, sliding on
 * its own. Tapping opens that country's full shortlist.
 *
 * It advances every few seconds but stops the moment a finger lands on it, and
 * doesn't resume until the finger leaves — an auto-slider that keeps moving
 * while you're reading it is the thing everyone hates about them. The dots live
 * inside the card so the row costs no extra height.
 */
export function ExploreTopBanner({ lists, onOpen }: {
  lists: TopList[]
  onOpen: (list: TopList) => void
}) {
  const [i, setI] = useState(0)
  const [held, setHeld] = useState(false)
  const startX = useRef<number | null>(null)
  const moved = useRef(0)

  // Shuffled, so the same country isn't always the one on top — but a country
  // keeps the number it drew for as long as the banner is mounted, or a
  // realtime reload would deal a new hand while you're looking at it.
  const rank = useRef(new Map<string, number>())
  const shown = useMemo(() => {
    for (const l of lists) if (!rank.current.has(l.key)) rank.current.set(l.key, Math.random())
    return [...lists].sort((a, b) => rank.current.get(a.key)! - rank.current.get(b.key)!)
  }, [lists])

  // a changed filter can shrink the list under us
  useEffect(() => { setI((n) => (n < shown.length ? n : 0)) }, [shown.length])

  useEffect(() => {
    if (held || shown.length < 2) return
    const t = setTimeout(() => setI((n) => (n + 1) % shown.length), AUTO_MS)
    return () => clearTimeout(t)
  }, [i, held, shown.length])

  if (!shown.length) return null
  const cur = shown[Math.min(i, shown.length - 1)]

  const go = (d: number) => setI((n) => (n + d + shown.length) % shown.length)

  return (
    <div
      onPointerDown={(e) => { startX.current = e.clientX; moved.current = 0; setHeld(true) }}
      onPointerMove={(e) => { if (startX.current != null) moved.current = e.clientX - startX.current }}
      onPointerUp={() => {
        if (Math.abs(moved.current) >= SWIPE_PX) go(moved.current < 0 ? 1 : -1)
        else if (startX.current != null) onOpen(cur)
        startX.current = null
        setHeld(false)
      }}
      onPointerCancel={() => { startX.current = null; setHeld(false) }}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(cur) }}
      className="relative h-[184px] rounded-[16px] overflow-hidden mb-3 cursor-pointer select-none touch-pan-y"
      style={{ background: 'linear-gradient(135deg,#8fa8c9,#2f4a72)', boxShadow: '0 8px 22px rgba(10,40,90,.15)' }}>

      {/* the city photo, swapped with a soft cross-fade */}
      {shown.map((l, n) => (
        <div key={l.key} className="absolute inset-0 transition-opacity duration-500"
          style={{ opacity: n === i ? 1 : 0 }}>
          {l.photo && <SignedImage url={l.photo} alt="" className="w-full h-full object-cover" width={800} />}
        </div>
      ))}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(95deg,rgba(4,18,38,.9) 0%,rgba(4,18,38,.6) 44%,rgba(4,18,38,.06) 82%)',
      }} />

      <div className="absolute inset-0 p-4 flex flex-col justify-center pointer-events-none">
        <div className="text-[9.5px] font-bold uppercase text-white/70 mb-2" style={{ letterSpacing: '.16em' }}>
          {cur.flag} {cur.cities.length > 1 ? `${cur.cities.length} เมือง` : cur.cities[0]?.name}
        </div>
        <h3 className="text-white text-[24px] font-extrabold leading-[1.15]" style={{ letterSpacing: '-.5px' }}>
          {TOP_LABEL}<br />{cur.country}
        </h3>
      </div>

      <span className="absolute right-4 bottom-4 inline-flex items-center gap-1.5 text-white text-[12px] font-bold pointer-events-none">
        ดูทั้งหมด
        <span className="size-[19px] rounded-full grid place-items-center" style={{ border: '1px solid rgba(255,255,255,.5)' }}>
          <IconChevronRight size={11} />
        </span>
      </span>

      {shown.length > 1 && (
        <div className="absolute left-4 bottom-[19px] flex gap-1.5 pointer-events-none">
          {shown.map((l, n) => (
            <span key={l.key} className="h-[5px] rounded-full transition-all duration-300"
              style={{ width: n === i ? 16 : 5, background: n === i ? '#fff' : 'rgba(255,255,255,.45)' }} />
          ))}
        </div>
      )}
    </div>
  )
}
