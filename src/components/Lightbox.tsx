import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react'
import { photoFullUrl } from '@/lib/files'

export type PhotoRef = { url?: string | null; path?: string | null }

/**
 * Full-screen image viewer. Pass a single resolved `src` for one image, or a
 * `photos` array + starting `index` for a swipeable gallery (←/→ arrows,
 * keyboard, and touch swipe — no need to close and reopen per photo).
 * Renders nothing when there's nothing to show.
 */
export function Lightbox({ src, photos, index = 0, alt, onClose }: {
  src?: string | null
  photos?: PhotoRef[]
  index?: number
  alt?: string
  onClose: () => void
}) {
  const items: PhotoRef[] = photos?.length ? photos : src ? [{ url: src }] : []
  const open = items.length > 0
  const many = items.length > 1
  const [cur, setCur] = useState(index)
  const [resolved, setResolved] = useState<Record<number, string | null>>({})
  const touchX = useRef<number | null>(null)

  // start at the requested photo whenever the viewer (re)opens
  useEffect(() => { setCur(index) }, [index])

  const go = useCallback((dir: number) => {
    setCur((c) => (c + dir + items.length) % items.length)
  }, [items.length])

  // resolve the current + neighbouring photos to full-size URLs on demand
  useEffect(() => {
    if (!open) return
    let active = true
    for (const i of [cur, cur + 1, cur - 1]) {
      const j = (i + items.length) % items.length
      if (resolved[j] !== undefined) continue
      const it = items[j]
      photoFullUrl(it.url, it.path).then((u) => { if (active) setResolved((r) => ({ ...r, [j]: u })) })
    }
    return () => { active = false }
  }, [open, cur, items, resolved])

  // keyboard: Esc to close, ←/→ to navigate
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    // lock body scroll while open (also keeps pull-to-refresh from firing behind it)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, go, onClose])

  if (!open) return null
  const url = resolved[cur]
  return createPortal(
    <div className="fixed inset-0 z-[130] bg-black/85 grid place-items-center p-4"
      onClick={onClose}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (many && Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
      }}>
      <button className="absolute top-4 right-4 text-white/90 z-10" aria-label="ปิด"><IconX size={24} /></button>
      {many && (
        <>
          <button className="absolute left-2 top-1/2 -translate-y-1/2 text-white/90 bg-black/30 rounded-full p-2 z-10"
            aria-label="ก่อนหน้า" onClick={(e) => { e.stopPropagation(); go(-1) }}><IconChevronLeft size={24} /></button>
          <button className="absolute right-2 top-1/2 -translate-y-1/2 text-white/90 bg-black/30 rounded-full p-2 z-10"
            aria-label="ถัดไป" onClick={(e) => { e.stopPropagation(); go(1) }}><IconChevronRight size={24} /></button>
        </>
      )}
      {url
        ? <img src={url} alt={alt ?? ''} className="max-w-full max-h-[88dvh] rounded-lg select-none"
            draggable={false} onClick={(e) => e.stopPropagation()} />
        : <div className="text-white/70 text-[13px]" onClick={(e) => e.stopPropagation()}>กำลังโหลด…</div>}
      {many && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/85 text-[12px] bg-black/35 rounded-full px-2.5 py-0.5"
          onClick={(e) => e.stopPropagation()}>{cur + 1} / {items.length}</div>
      )}
    </div>,
    document.body,
  )
}
