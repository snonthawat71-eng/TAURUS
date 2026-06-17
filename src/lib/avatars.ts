import type { AvatarColor } from './database.types'

// Avatar palette from design spec (bg + text pairs)
export const AVATAR_COLORS: Record<AvatarColor, { bg: string; fg: string }> = {
  av1: { bg: '#534AB7', fg: '#EEEDFE' }, // purple
  av2: { bg: '#D85A30', fg: '#FAECE7' }, // orange-red
  av3: { bg: '#1D9E75', fg: '#E1F5EE' }, // green
  av4: { bg: '#D4537E', fg: '#FBEAF0' }, // pink
  av5: { bg: '#2F6BD3', fg: '#E6EEFB' }, // blue
  av6: { bg: '#1E8E8E', fg: '#E0F4F4' }, // teal
  av7: { bg: '#C08A1E', fg: '#F8EFD9' }, // gold
  av8: { bg: '#4A5A86', fg: '#E9EDF6' }, // slate
  av9: { bg: '#C0432E', fg: '#FBE9E5' }, // red
  av10: { bg: '#8A52C7', fg: '#F1E9FB' }, // violet
}

export const ORDER: AvatarColor[] = ['av1', 'av2', 'av3', 'av4', 'av5', 'av6', 'av7', 'av8', 'av9', 'av10']

/** Is this a free-form hex colour (e.g. "#1D9E75" / "#abc")? */
export function isHex(c?: string | null): c is string {
  return !!c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)
}

/** Pick black/white text that stays readable on an arbitrary background. */
function readableFg(bg: string): string {
  let h = bg.replace('#', '')
  if (h.length === 3) h = h.split('').map((x) => x + x).join('')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.62 ? '#1F1D1A' : '#FFFFFF'
}

/** Normalise any stored colour (av-key | hex | empty) to a hex value for a wheel/input. */
export function toHexColor(c?: string | null, fallbackKey = ''): string {
  if (c && c in AVATAR_COLORS) return AVATAR_COLORS[c as AvatarColor].bg
  if (isHex(c)) return c
  return fallbackKey ? colorForKey(fallbackKey).bg : AVATAR_COLORS.av3.bg
}

/** Persisted avatar_color if present (av-key or hex), otherwise a stable color by list position. */
export function travelerColor(t: { avatar_color?: string | null }, index: number): string {
  const c = t.avatar_color
  if (c && (c in AVATAR_COLORS || isHex(c))) return c
  return ORDER[index % ORDER.length]
}

/** Deterministic color from an id/name so a person looks the same everywhere. */
export function colorForKey(key: string): { bg: string; fg: string } {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[ORDER[h % ORDER.length]]
}

export function resolveColor(c: string | null | undefined, fallbackKey: string) {
  if (c && c in AVATAR_COLORS) return AVATAR_COLORS[c as AvatarColor]
  if (isHex(c)) return { bg: c, fg: readableFg(c) }
  return colorForKey(fallbackKey)
}

/** "Elf" -> "EL", "Nak Smith" -> "NK"-ish 2 letters */
export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
