import type { CSSProperties } from 'react'

/**
 * How a place photo is cropped inside its fixed-ratio frame. Stored as a compact
 * "x y scale" string on `places.photo_focus` (x/y = focal point in percent,
 * scale = zoom ≥ 1). The same values drive the card, the detail header and the
 * editor preview, so cropping is WYSIWYG everywhere.
 */
export interface PhotoFocus {
  x: number // 0–100, object-position X
  y: number // 0–100, object-position Y
  scale: number // ≥ 1, zoom
}

export const DEFAULT_FOCUS: PhotoFocus = { x: 50, y: 50, scale: 1 }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function parseFocus(s: string | null | undefined): PhotoFocus | null {
  if (!s) return null
  const [x, y, scale] = s.trim().split(/\s+/).map(Number)
  if ([x, y, scale].some((n) => !Number.isFinite(n))) return null
  return { x: clamp(x, 0, 100), y: clamp(y, 0, 100), scale: clamp(scale, 1, 4) }
}

/** Round-trip a focus back to its stored string, or null when it's the default. */
export function serializeFocus(f: PhotoFocus): string | null {
  const x = Math.round(clamp(f.x, 0, 100))
  const y = Math.round(clamp(f.y, 0, 100))
  const scale = Math.round(clamp(f.scale, 1, 4) * 100) / 100
  if (x === 50 && y === 50 && scale === 1) return null // default crop → store nothing
  return `${x} ${y} ${scale}`
}

/** CSS for an `object-cover` <img> that honours a stored crop (pan + zoom). */
export function focusStyle(s: string | null | undefined): CSSProperties {
  const f = parseFocus(s)
  if (!f) return {}
  const pos = `${f.x}% ${f.y}%`
  return {
    objectPosition: pos,
    ...(f.scale > 1.001 ? { transform: `scale(${f.scale})`, transformOrigin: pos } : {}),
  }
}
