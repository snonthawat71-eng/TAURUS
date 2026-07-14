import { useState } from 'react'
import { IconBulb, IconPlus } from '@tabler/icons-react'
import { catMeta } from '@/lib/placeMeta'
import { planBranch } from '@/lib/branches'
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

/** In-list places worth adding to this day, ranked by closeness to the stops
 *  already in it: same station (3) → same line (2) → same city (1). Places with
 *  no relation to the day are left out; a day with no located stops shows nothing. */
export function suggestForDay(dayStops: ItineraryStop[], places: Place[], scheduledNames: Set<string>): Place[] {
  const byName = new Map<string, Place>()
  for (const p of places) if (p.name) byName.set(norm(p.name), p)

  const stations = new Set<string>()
  const lines = new Set<string>()
  const cities = new Set<string>()
  for (const s of dayStops) {
    const p = s.place_name ? byName.get(norm(s.place_name)) : undefined
    if (!p) continue
    const st = planStation(p)
    if (st.station) stations.add(norm(st.station))
    if (st.line) lines.add(norm(st.line))
    if (p.city) cities.add(norm(p.city))
  }
  if (!stations.size && !lines.size && !cities.size) return []

  const scored: { p: Place; score: number }[] = []
  for (const p of places) {
    if (!p.in_plan || !p.name || scheduledNames.has(norm(p.name))) continue
    const st = planStation(p)
    const score = st.station && stations.has(norm(st.station)) ? 3
      : st.line && lines.has(norm(st.line)) ? 2
        : p.city && cities.has(norm(p.city)) ? 1 : 0
    if (score > 0) scored.push({ p, score })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 10).map((x) => x.p)
}

/** "💡 ในลิสต์ที่อยู่ใกล้แพลนวันนี้" — a horizontal strip under a day's stops
 *  offering one-tap adds from the Places List. Hidden per session via ซ่อน. */
export function DaySuggestions({ places, onAdd, onOpenDetail }: {
  places: Place[]
  onAdd: (p: Place) => void
  onOpenDetail: (p: Place) => void
}) {
  const [hidden, setHidden] = useState(false)
  if (!places.length || hidden) return null
  return (
    <div className="rounded-[10px] p-2.5" style={{ background: 'linear-gradient(180deg, #f2f8ff, var(--color-surface))', border: '0.5px solid var(--color-brand-border)' }}>
      <div className="flex items-center gap-1.5">
        <IconBulb size={14} className="text-brand-mid shrink-0" />
        <span className="text-[11.5px] font-semibold text-brand-mid">ในลิสต์ที่อยู่ใกล้แพลนวันนี้</span>
        <button onClick={() => setHidden(true)} className="ml-auto text-[10.5px] text-ink-3 hover:text-ink-2 shrink-0">ซ่อน</button>
      </div>
      <div className="flex gap-2 mt-2 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
        {places.map((p) => {
          const st = planStation(p)
          const M = catMeta(p.category)
          const CatIcon = M.icon
          return (
            <div key={p.id} className="w-[160px] shrink-0 rounded-[11px] bg-surface p-2.5" style={{ border: '0.5px solid var(--color-line)' }}>
              <button onClick={() => onOpenDetail(p)} className="w-full text-left">
                <div className="flex items-center gap-1.5">
                  <span className="size-5 rounded-[6px] grid place-items-center shrink-0" style={{ background: M.bg, color: M.fg }}>
                    <CatIcon size={12} />
                  </span>
                  <span className="text-[11.5px] font-semibold truncate">{p.name}</span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-[9.5px] text-ink-3 min-h-[16px]">
                  {st.line && (
                    <span className="rounded-[5px] px-1.5 py-px font-semibold text-white shrink-0" style={{ background: st.color || 'var(--color-brand)' }}>{st.line}</span>
                  )}
                  <span className="truncate">{st.station || p.city || ''}</span>
                </div>
              </button>
              <button onClick={() => onAdd(p)}
                className="mt-2 w-full h-7 rounded-[8px] text-[10.5px] font-semibold flex items-center justify-center gap-1"
                style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-mid)', border: '0.5px solid var(--color-brand-border)' }}>
                <IconPlus size={12} /> เพิ่มเข้าวันนี้
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
