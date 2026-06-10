import type { AvatarColor } from './database.types'

// Avatar palette from design spec (bg + text pairs)
export const AVATAR_COLORS: Record<AvatarColor, { bg: string; fg: string }> = {
  av1: { bg: '#534AB7', fg: '#EEEDFE' }, // purple
  av2: { bg: '#D85A30', fg: '#FAECE7' }, // orange-red
  av3: { bg: '#1D9E75', fg: '#E1F5EE' }, // green
  av4: { bg: '#D4537E', fg: '#FBEAF0' }, // pink
}

const ORDER: AvatarColor[] = ['av1', 'av2', 'av3', 'av4']

/** Deterministic color from an id/name so a person looks the same everywhere. */
export function colorForKey(key: string): { bg: string; fg: string } {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[ORDER[h % ORDER.length]]
}

export function resolveColor(c: string | null | undefined, fallbackKey: string) {
  if (c && c in AVATAR_COLORS) return AVATAR_COLORS[c as AvatarColor]
  return colorForKey(fallbackKey)
}

/** "Elf" -> "EL", "Nak Smith" -> "NK"-ish 2 letters */
export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
