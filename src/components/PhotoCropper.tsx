import { useRef, type ReactNode } from 'react'
import { IconArrowsMove, IconZoomIn } from '@tabler/icons-react'
import { SignedImage } from './SignedImage'
import { DEFAULT_FOCUS, parseFocus, serializeFocus } from '@/lib/photoFocus'

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * Drag-to-reposition + zoom cropper for a place photo. The frame matches the
 * card's crop ratio so what you see here is what shows on the card/detail.
 * Emits the stored focus string ("x y scale", or null for the default crop).
 */
export function PhotoCropper({ url, path, focus, fallback, onChange }: {
  url?: string | null
  path?: string | null
  focus: string | null
  fallback?: ReactNode
  onChange: (focus: string | null) => void
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ px: number; py: number; fx: number; fy: number } | null>(null)
  const f = parseFocus(focus) ?? DEFAULT_FOCUS

  function onPointerDown(e: React.PointerEvent) {
    frameRef.current?.setPointerCapture(e.pointerId)
    drag.current = { px: e.clientX, py: e.clientY, fx: f.x, fy: f.y }
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    const rect = frameRef.current?.getBoundingClientRect()
    if (!d || !rect) return
    // dragging the image right reveals more of its left edge → object-position X falls.
    const nx = clamp(d.fx - ((e.clientX - d.px) / rect.width) * 100 / f.scale, 0, 100)
    const ny = clamp(d.fy - ((e.clientY - d.py) / rect.height) * 100 / f.scale, 0, 100)
    onChange(serializeFocus({ ...f, x: nx, y: ny }))
  }
  function onPointerUp() { drag.current = null }

  return (
    <div className="space-y-2">
      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchMove={(e) => e.stopPropagation()} // don't let the Drawer swipe-to-close steal the drag
        className="relative w-full aspect-[16/10] rounded-lg overflow-hidden bg-surface-2 cursor-grab active:cursor-grabbing touch-none select-none">
        <SignedImage url={url} path={path} focus={focus} className="w-full h-full object-cover pointer-events-none" width={800} fallback={fallback} />
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-black/55 text-white pointer-events-none">
          <IconArrowsMove size={12} /> ลากเพื่อจัดตำแหน่ง
        </span>
      </div>
      <div className="flex items-center gap-2">
        <IconZoomIn size={15} className="text-ink-3 shrink-0" />
        <input
          type="range" min={1} max={3} step={0.01} value={f.scale}
          onChange={(e) => onChange(serializeFocus({ ...f, scale: Number(e.target.value) }))}
          className="w-full accent-brand" aria-label="ซูมรูป" />
      </div>
    </div>
  )
}
