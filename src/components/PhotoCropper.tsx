import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IconArrowsMove, IconZoomIn } from '@tabler/icons-react'
import { SignedImage } from './SignedImage'
import { DEFAULT_FOCUS, parseFocus, serializeFocus } from '@/lib/photoFocus'

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * Drag-to-reposition + zoom cropper for a place photo. The frame matches the
 * card's crop ratio so what you see here is what shows on the card/detail.
 * Emits the stored focus string ("x y scale", or null for the default crop).
 */
export function PhotoCropper({ url, path, focus, fallback, onChange, aspect = '16 / 10', round = false }: {
  url?: string | null
  path?: string | null
  focus: string | null
  fallback?: ReactNode
  onChange: (focus: string | null) => void
  /** crop-frame aspect ratio (CSS aspect-ratio value). Use '1 / 1' for avatars. */
  aspect?: string
  /** show a circular frame (avatars) instead of a rounded rectangle */
  round?: boolean
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ px: number; py: number; fx: number; fy: number } | null>(null)
  const f = parseFocus(focus) ?? DEFAULT_FOCUS
  // rule-of-thirds guides, shown only while the crop is being moved or zoomed —
  // they're there to line the subject up, not to sit on top of the photo
  const [guides, setGuides] = useState(false)
  const [stuck, setStuck] = useState(false)
  const hide = useRef<number | null>(null)
  useEffect(() => () => { if (hide.current) clearTimeout(hide.current) }, [])
  function flashGuides() {
    setGuides(true)
    if (hide.current) clearTimeout(hide.current)
    hide.current = window.setTimeout(() => setGuides(false), 700)
  }

  /**
   * How far the photo travels, in pixels, for a full 0→100 sweep of the focus
   * percentage — the number that makes the drag follow the finger.
   *
   * `object-cover` only leaves room to pan on the axis where the photo spills
   * out of the frame, and zooming adds a frame's worth of room on both. A wide
   * photo in a wide frame spills by a few percent, so treating the frame width
   * as the travel (which is what this used to do) moved the photo by a tenth of
   * the drag and read as "it isn't moving".
   */
  function travel() {
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect) return null
    const img = frameRef.current?.querySelector('img')
    const iw = img?.naturalWidth ?? 0
    const ih = img?.naturalHeight ?? 0
    // photo not decoded yet → assume it spills a frame's worth, so an early
    // drag still does something instead of reading as "stuck"
    if (!iw || !ih) return { x: -rect.width * f.scale, y: -rect.height * f.scale }
    // cover scale → how much of the photo hangs outside the frame
    const cover = Math.max(rect.width / iw, rect.height / ih)
    const spillX = iw * cover - rect.width
    const spillY = ih * cover - rect.height
    return {
      x: rect.width - f.scale * (spillX + rect.width),
      y: rect.height - f.scale * (spillY + rect.height),
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    frameRef.current?.setPointerCapture(e.pointerId)
    drag.current = { px: e.clientX, py: e.clientY, fx: f.x, fy: f.y }
    if (hide.current) clearTimeout(hide.current)
    setGuides(true)
    const t = travel()
    // nothing spills out and no zoom → there is no crop to choose yet
    setStuck(!!t && Math.abs(t.x) < 1 && Math.abs(t.y) < 1)
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    const t = travel()
    if (!d || !t) return
    // a frozen axis (no spill, no zoom) keeps its value instead of dividing by ~0
    const nx = Math.abs(t.x) < 1 ? d.fx : clamp(d.fx + ((e.clientX - d.px) / t.x) * 100, 0, 100)
    const ny = Math.abs(t.y) < 1 ? d.fy : clamp(d.fy + ((e.clientY - d.py) / t.y) * 100, 0, 100)
    onChange(serializeFocus({ ...f, x: nx, y: ny }))
  }
  function onPointerUp() { drag.current = null; setStuck(false); flashGuides() }

  return (
    <div className="space-y-2">
      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchMove={(e) => e.stopPropagation()} // don't let the Drawer swipe-to-close steal the drag
        style={{ aspectRatio: aspect, ...(round ? { maxWidth: 220, marginInline: 'auto' } : {}) }}
        className={['relative w-full overflow-hidden bg-surface-2 cursor-grab active:cursor-grabbing touch-none select-none', round ? 'rounded-full' : 'rounded-lg'].join(' ')}>
        <SignedImage url={url} path={path} focus={focus} className="w-full h-full object-cover pointer-events-none" width={800} fallback={fallback} />
        <div aria-hidden
          className={['absolute inset-0 rounded-[inherit] pointer-events-none transition-opacity duration-150', guides ? 'opacity-100' : 'opacity-0'].join(' ')}>
          {[1, 2].map((i) => (
            <span key={`v${i}`} className="absolute inset-y-0 w-px bg-white/75"
              style={{ left: `${(i * 100) / 3}%`, boxShadow: '0 0 2px rgba(0,0,0,0.5)' }} />
          ))}
          {[1, 2].map((i) => (
            <span key={`h${i}`} className="absolute inset-x-0 h-px bg-white/75"
              style={{ top: `${(i * 100) / 3}%`, boxShadow: '0 0 2px rgba(0,0,0,0.5)' }} />
          ))}
          <span className="absolute inset-0 rounded-[inherit] border border-white/40" />
        </div>
        <span className={['absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-black/55 text-white pointer-events-none transition-opacity duration-150',
          guides && !stuck ? 'opacity-0' : 'opacity-100'].join(' ')}>
          {stuck
            ? <><IconZoomIn size={12} /> รูปพอดีกรอบแล้ว — ซูมเข้าก่อนถึงจะเลื่อนได้</>
            : <><IconArrowsMove size={12} /> ลากเพื่อจัดตำแหน่ง</>}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <IconZoomIn size={15} className="text-ink-3 shrink-0" />
        <input
          type="range" min={1} max={3} step={0.01} value={f.scale}
          onChange={(e) => { flashGuides(); onChange(serializeFocus({ ...f, scale: Number(e.target.value) })) }}
          className="w-full accent-brand" aria-label="ซูมรูป" />
      </div>
    </div>
  )
}
