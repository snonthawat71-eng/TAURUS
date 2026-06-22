import { createPortal } from 'react-dom'
import { IconX } from '@tabler/icons-react'

/** Full-screen image viewer. Renders nothing when `src` is null. */
export function Lightbox({ src, alt, onClose }: {
  src: string | null
  alt?: string
  onClose: () => void
}) {
  if (!src) return null
  return createPortal(
    <div className="fixed inset-0 z-[130] bg-black/85 grid place-items-center p-4" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/90" aria-label="ปิด"><IconX size={24} /></button>
      <img src={src} alt={alt ?? ''} className="max-w-full max-h-[88dvh] rounded-lg" onClick={(e) => e.stopPropagation()} />
    </div>,
    document.body,
  )
}
