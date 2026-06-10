import { initials, resolveColor } from '@/lib/avatars'

interface AvatarProps {
  name: string | null | undefined
  /** avatar_color token if known (e.g. profile.avatar_color) */
  color?: string | null
  size?: number
  ring?: boolean
}

export function Avatar({ name, color, size = 24, ring = true }: AvatarProps) {
  const c = resolveColor(color, name ?? '?')
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-medium shrink-0"
      style={{
        width: size,
        height: size,
        background: c.bg,
        color: c.fg,
        fontSize: Math.round(size * 0.42),
        border: ring ? '2px solid #fff' : undefined,
      }}
      title={name ?? ''}
    >
      {initials(name)}
    </span>
  )
}

interface StackItem {
  name: string | null | undefined
  color?: string | null
}

export function AvatarStack({ people, size = 24, max = 5 }: { people: StackItem[]; size?: number; max?: number }) {
  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span key={i} style={{ marginLeft: i === 0 ? 0 : -7 }}>
          <Avatar name={p.name} color={p.color} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-surface-2 text-ink-2 font-medium"
          style={{ width: size, height: size, marginLeft: -7, border: '2px solid #fff', fontSize: Math.round(size * 0.38) }}
        >
          +{extra}
        </span>
      )}
    </div>
  )
}
