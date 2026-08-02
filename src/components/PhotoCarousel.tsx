import { useRef, useState, type ReactNode } from 'react'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { SignedImage } from './SignedImage'
import type { PhotoRef } from './Lightbox'

/**
 * Swipeable photo strip for cards. Uses native CSS scroll-snap (so touch swipe
 * gets momentum/feel for free) and renders pagination dots when there's more than
 * one photo. `focus` (a saved crop) only applies to the first/cover photo.
 *
 * - Pass `onExpand` to make tapping a photo open it (e.g. a lightbox). Omit it to
 *   let the tap bubble to a parent click handler (e.g. open a detail view).
 * - `overlay` renders above the photos (badges, corner buttons).
 */
export function PhotoCarousel({
  photos, alt, width, focus, fallback, onExpand, overlay, priority, indicator = 'dots', indicatorDrop = 0,
}: {
  photos: PhotoRef[]
  alt?: string
  width?: number
  focus?: string | null
  fallback?: ReactNode
  onExpand?: (index: number) => void
  overlay?: ReactNode
  /** eager-load the first slide (above-the-fold hero) */
  priority?: boolean
  /** how to show there are multiple photos: pagination dots (default), or a
   *  "1 / N" counter pill in the top-right (better on tall immersive heroes
   *  where centre-bottom dots collide with overlaid text) */
  indicator?: 'dots' | 'count'
  /** push the "1 / N" pill this far further down, to clear a corner button the
   *  page has already put in the top-right */
  indicatorDrop?: number
}) {
  const [active, setActive] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)

  if (photos.length === 0) return <>{fallback ?? null}</>

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    setActive((prev) => (prev === i ? prev : i))
  }
  const jump = (i: number) => {
    const el = scroller.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }
  const step = (dir: number) => jump((active + dir + photos.length) % photos.length)

  return (
    <div className="group relative w-full h-full">
      <div ref={scroller} onScroll={onScroll}
        className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar">
        {photos.map((p, i) => (
          <div key={i} className="w-full h-full shrink-0 snap-center"
            onClick={onExpand ? (e) => { e.stopPropagation(); onExpand(i) } : undefined}
            style={onExpand ? { cursor: 'zoom-in' } : undefined}>
            <SignedImage url={p.url} path={p.path} alt={alt} width={width}
              focus={i === 0 ? focus : null} eager={priority && i === 0}
              className="w-full h-full object-cover pointer-events-none" fallback={fallback} />
          </div>
        ))}
      </div>

      {overlay}

      {/* desktop arrows (no drag-to-swipe with a mouse — show on hover) */}
      {photos.length > 1 && (
        <>
          <button aria-label="ก่อนหน้า" onClick={(e) => { e.stopPropagation(); step(-1) }}
            className="hidden md:grid place-items-center absolute left-1.5 top-1/2 -translate-y-1/2 z-20 size-7 rounded-full bg-black/35 hover:bg-black/55 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <IconChevronLeft size={16} />
          </button>
          <button aria-label="ถัดไป" onClick={(e) => { e.stopPropagation(); step(1) }}
            className="hidden md:grid place-items-center absolute right-1.5 top-1/2 -translate-y-1/2 z-20 size-7 rounded-full bg-black/35 hover:bg-black/55 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <IconChevronRight size={16} />
          </button>
        </>
      )}

      {photos.length > 1 && indicator === 'count' && (
        <div className="absolute z-20 rounded-full bg-black/45 text-white text-[11px] font-semibold px-2 py-1 leading-none backdrop-blur-sm tabular-nums pointer-events-none"
          style={{ top: `calc(env(safe-area-inset-top,0px) + ${12 + indicatorDrop}px)`, right: 12 }}>
          {active + 1} / {photos.length}
        </div>
      )}

      {photos.length > 1 && indicator === 'dots' && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
          {photos.map((_, i) => (
            <button key={i} aria-label={`รูปที่ ${i + 1}`} onClick={(e) => { e.stopPropagation(); jump(i) }}
              className="rounded-full transition-all duration-200"
              style={{
                width: i === active ? 7 : 5,
                height: i === active ? 7 : 5,
                background: i === active ? '#fff' : 'rgba(255,255,255,0.6)',
                boxShadow: '0 0 3px rgba(0,0,0,0.35)',
              }} />
          ))}
        </div>
      )}
    </div>
  )
}
