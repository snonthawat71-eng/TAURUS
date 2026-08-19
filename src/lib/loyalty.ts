// Loyalty tiers for Explore contributions. A tier needs BOTH volume (places
// shared) and quality (saves + likes received from other people), so sharing
// spam alone can't rank up. Purely derived — no storage; thresholds/labels can
// be tuned here without a migration.
export interface LoyaltyTier {
  key: 'new' | 'explorer' | 'guru' | 'legend'
  label: string
  /** places shared into Explore */
  minShared: number
  /** saves + likes received from others across those places */
  minEngage: number
  color: string // text/accent
  bg: string    // chip background
  icon: 'seedling' | 'compass' | 'star' | 'crown'
}

export const LOYALTY_TIERS: LoyaltyTier[] = [
  { key: 'new', label: 'Newbie', minShared: 0, minEngage: 0, color: '#6B7280', bg: '#F3F4F6', icon: 'seedling' },
  { key: 'explorer', label: 'Explorer', minShared: 10, minEngage: 5, color: '#16A34A', bg: '#ECFDF3', icon: 'compass' },
  { key: 'guru', label: 'Route Guru', minShared: 50, minEngage: 25, color: '#135FD6', bg: '#E7F0FF', icon: 'star' },
  { key: 'legend', label: 'Legend', minShared: 100, minEngage: 60, color: '#7C3AED', bg: '#F3E8FF', icon: 'crown' },
]

/** Current tier for the given contribution stats + what the next tier needs. */
export function loyaltyTier(shared: number, engage = 0): {
  tier: LoyaltyTier
  next: LoyaltyTier | null
  /** how many more shares / saves+likes the next tier still needs */
  toNextShared: number
  toNextEngage: number
} {
  let tier = LOYALTY_TIERS[0]
  for (const t of LOYALTY_TIERS) if (shared >= t.minShared && engage >= t.minEngage) tier = t
  const idx = LOYALTY_TIERS.indexOf(tier)
  const next = LOYALTY_TIERS[idx + 1] ?? null
  return {
    tier, next,
    toNextShared: next ? Math.max(0, next.minShared - shared) : 0,
    toNextEngage: next ? Math.max(0, next.minEngage - engage) : 0,
  }
}
