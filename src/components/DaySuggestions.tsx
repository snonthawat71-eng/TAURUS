import { useState } from 'react'
import { IconBulb, IconPlus, IconChevronDown, IconX } from '@tabler/icons-react'
import { catMeta } from '@/lib/placeMeta'
import { planBranch } from '@/lib/branches'
import { haversineM, fmtDistance } from '@/lib/placeGeo'
import type { LatLng } from '@/lib/geo'
import type { ItineraryStop, Place } from '@/lib/database.types'

/** line/station/color the plan actually uses for a place (chosen branch first) */
function planStation(p: Place) {
  const b = planBranch(p)
  return {
    line: b?.line || p.station_line,
    station: b?.station || p.station_name,
    color: b?.color || p.station_color,
  }
}

const norm = (s: string) => s.trim().toLowerCase()

export interface DaySuggestion { p: Place; distM?: number }

/** How far away a suggestion may be and still count as "ใกล้" (meters). */
const MAX_NEAR_M = 5000

/** In-plan places near ONE stop, nearest first: real link-derived distance
 *  when both sides have coordinates (within 5 km — known-far is dropped even
 *  on the same line), station/line match as the no-coords fallback. */
export function suggestForStop(
  stop: ItineraryStop, places: Place[], scheduledNames: Set<string>,
  coords?: Map<string, LatLng | null>,
): DaySuggestion[] {
  if (!stop.place_name) return []
  const byName = new Map<string, Place>()
  for (const p of places) if (p.name) byName.set(norm(p.name), p)
  const anchor = byName.get(norm(stop.place_name))
  if (!anchor) return []

  const aSt = planStation(anchor)
  const aC = coords?.get(anchor.id) ?? null
  if (!aC && !aSt.station && !aSt.line) return []

  const near: { p: Place; distM: number }[] = []
  const scored: { p: Place; score: number }[] = []
  for (const p of places) {
    if (p.id === anchor.id || !p.in_plan || !p.name || scheduledNames.has(norm(p.name))) continue
    const c = coords?.get(p.id)
    if (aC && c) {
      const d = haversineM(aC, c)
      if (d <= MAX_NEAR_M) near.push({ p, distM: d })
      continue
    }
    const st = planStation(p)
    const score = aSt.station && st.station && norm(st.station) === norm(aSt.station) ? 2
      : aSt.line && st.line && norm(st.line) === norm(aSt.line) ? 1 : 0
    if (score > 0) scored.push({ p, score })
  }
  near.sort((a, b) => a.distM - b.distM)
  scored.sort((a, b) => b.score - a.score)
  return [...near, ...scored.map((x) => ({ p: x.p }))].slice(0, 5)
}

/** Full-width colored strip across a stop card's bottom edge — "มีที่ในแพลน
 *  ใกล้ที่นี่ N ที่". Tap to expand into one-tap add cards, or ไม่สนใจ to
 *  dismiss for this stop. Rendered flush (the card clips the corners). */
export function StopSuggestions({ items, onAdd, onOpenDetail, onDismiss }: {
  items: DaySuggestion[]
  onAdd: (p: Place) => void
  onOpenDetail: (p: Place) => void
  onDismiss: () => void
}) {
  const [open, setOpen] = useState(false)
  if (!items.length) return null
  return (
    <div style={{ background: 'var(--color-brand-soft)', borderTop: '0.5px solid var(--color-brand-border)' }}>
      <div className="flex items-center gap-1 pl-3 pr-2 h-9">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left" aria-expanded={open}>
          <IconBulb size={13} className="text-brand-mid shrink-0" />
          <span className="text-[11px] font-semibold text-brand-mid truncate">Suggestion ({items.length})</span>
          <IconChevronDown size={13} className={`text-brand-mid shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <button onClick={onDismiss}
          className="shrink-0 inline-flex items-center gap-0.5 text-[10px] text-ink-3 hover:text-ink-2 px-1.5 h-6 rounded-md"
          aria-label="ไม่สนใจคำแนะนำของจุดนี้">
          <IconX size={11} /> ไม่สนใจ
        </button>
      </div>
      {open && (
        <div className="flex gap-2 px-3 pb-3 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
          {items.map(({ p, distM }) => {
            const st = planStation(p)
            const M = catMeta(p.category)
            const CatIcon = M.icon
            return (
              <div key={p.id} className="w-[160px] shrink-0 rounded-[10px] bg-surface p-2.5" style={{ border: '0.5px solid var(--color-line)' }}>
                <button onClick={() => onOpenDetail(p)} className="w-full text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="size-5 rounded-[6px] grid place-items-center shrink-0" style={{ background: M.bg, color: M.fg }}>
                      <CatIcon size={12} />
                    </span>
                    <span className="text-[11.5px] font-semibold truncate">{p.name}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[9.5px] text-ink-3 min-h-[16px]">
                    {distM != null && (
                      <span className="rounded-[5px] px-1.5 py-px font-semibold shrink-0"
                        style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-mid)', border: '0.5px solid var(--color-brand-border)' }}>
                        ≈{fmtDistance(distM)}
                      </span>
                    )}
                    {st.line && (
                      <span className="rounded-[5px] px-1.5 py-px font-semibold text-white shrink-0" style={{ background: st.color || 'var(--color-brand)' }}>{st.line}</span>
                    )}
                    <span className="truncate">{st.station || p.city || ''}</span>
                  </div>
                </button>
                <button onClick={() => onAdd(p)}
                  className="mt-2 w-full h-7 rounded-[8px] text-[10.5px] font-semibold flex items-center justify-center gap-1 bg-surface"
                  style={{ color: 'var(--color-brand-mid)', border: '0.5px solid var(--color-brand-border)' }}>
                  <IconPlus size={12} /> เพิ่มเข้าวันนี้
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
