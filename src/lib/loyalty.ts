// Loyalty tiers for how many places a user has shared into the Explore pool.
// Purely derived from the shared count — no storage. Thresholds/labels can be
// tuned later without a migration.
export interface LoyaltyTier {
  key: 'new' | 'explorer' | 'guru' | 'legend'
  label: string
  min: number
  color: string // text/accent
  bg: string    // chip background
  icon: 'seedling' | 'compass' | 'star' | 'crown'
}

export const LOYALTY_TIERS: LoyaltyTier[] = [
  { key: 'new', label: 'นักเดินทางใหม่', min: 0, color: '#6B7280', bg: '#F3F4F6', icon: 'seedling' },
  { key: 'explorer', label: 'นักสำรวจ', min: 10, color: '#16A34A', bg: '#ECFDF3', icon: 'compass' },
  { key: 'guru', label: 'กูรูเส้นทาง', min: 50, color: '#135FD6', bg: '#E7F0FF', icon: 'star' },
  { key: 'legend', label: 'ตำนานนักเดินทาง', min: 100, color: '#7C3AED', bg: '#F3E8FF', icon: 'crown' },
]

/** Current tier for `shared` places + the next tier and how many more to reach it. */
export function loyaltyTier(shared: number): { tier: LoyaltyTier; next: LoyaltyTier | null; toNext: number } {
  let tier = LOYALTY_TIERS[0]
  for (const t of LOYALTY_TIERS) if (shared >= t.min) tier = t
  const next = LOYALTY_TIERS.find((t) => t.min > shared) ?? null
  return { tier, next, toNext: next ? next.min - shared : 0 }
}
