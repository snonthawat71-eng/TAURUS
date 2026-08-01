import { useEffect, useRef, useState } from 'react'
import { IconChevronRight } from '@tabler/icons-react'
import { SignedImage } from './SignedImage'
import { TOP_LABEL, type TopList } from '@/lib/exploreTop'

const AUTO_MS = 15000
/** how far a finger has to travel before it counts as a swipe, not a tap */
const SWIPE_PX = 40

/**
 * The "ที่เด็ด" banner under the search box: one card per city, sliding on its
 * own. Tapping opens that city's full shortlist.
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

  // a changed filter can shrink the list under us
  useEffect(() => { setI((n) => (n < lists.length ? n : 0)) }, [lists.length])

  useEffect(() => {
    if (held || lists.length < 2) return
    const t = setTimeout(() => setI((n) => (n + 1) % lists.length), AUTO_MS)
    return () => clearTimeout(t)
  }, [i, held, lists.length])

  if (!lists.length) return null
  const cur = lists[Math.min(i, lists.length - 1)]

  const go = (d: number) => setI((n) => (n + d + lists.length) % lists.length)

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
      {lists.map((l, n) => (
        <div key={l.key} className="absolute inset-0 transition-opacity duration-500"
          style={{ opacity: n === i ? 1 : 0 }}>
          {l.photo && <SignedImage url={l.photo} alt="" className="w-full h-full object-cover" width={800} />}
        </div>
      ))}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(95deg,rgba(4,18,38,.9) 0%,rgba(4,18,38,.6) 44%,rgba(4,18,38,.06) 82%)',
      }} />

      <div className="absolute inset-0 p-4 flex flex-col justify-center pointer-events-none">
        <h3 className="text-white text-[24px] font-extrabold leading-[1.15]" style={{ letterSpacing: '-.5px' }}>
          {TOP_LABEL}<br />{cur.city}
        </h3>
      </div>

      <span className="absolute right-4 bottom-4 inline-flex items-center gap-1.5 text-white text-[12px] font-bold pointer-events-none">
        ดูทั้งหมด
        <span className="size-[19px] rounded-full grid place-items-center" style={{ border: '1px solid rgba(255,255,255,.5)' }}>
          <IconChevronRight size={11} />
        </span>
      </span>

      {lists.length > 1 && (
        <div className="absolute left-4 bottom-[19px] flex gap-1.5 pointer-events-none">
          {lists.map((l, n) => (
            <span key={l.key} className="h-[5px] rounded-full transition-all duration-300"
              style={{ width: n === i ? 16 : 5, background: n === i ? '#fff' : 'rgba(255,255,255,.45)' }} />
          ))}
        </div>
      )}
    </div>
  )
}
