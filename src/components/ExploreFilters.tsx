import { useMemo } from 'react'
import { IconWorldSearch, IconMapPin, IconFlame, IconSearch, IconX } from '@tabler/icons-react'
import { SignedImage } from './SignedImage'
import { hscroll } from '@/lib/hscroll'
import { cityImage } from '@/lib/cityImages'
import { PLACE_TABS, FOOD_TABS } from '@/lib/placeMeta'
import type { ExploreFilterState } from '@/lib/exploreFilter'
import type { ExplorePlace } from '@/lib/database.types'

/** A city is flagged "new" when it has a place added within this window. */
const NEW_CITY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

/** Search box + group / sort / category / city filters shared by the Explore
 *  and "my shares" pages. City chips are derived from the items passed in. */
export function ExploreFilters({ items, f, set, showSort = true }: {
  items: ExplorePlace[]
  f: ExploreFilterState
  set: (patch: Partial<ExploreFilterState>) => void
  /** show the "sort by popularity" toggle (hidden on the manage page) */
  showSort?: boolean
}) {
  const cities = useMemo(() => {
    const now = Date.now()
    const m = new Map<string, { sample: ExplorePlace; isNew: boolean }>()
    for (const e of items) {
      if (!e.city) continue
      const fresh = !!e.created_at && now - new Date(e.created_at).getTime() < NEW_CITY_WINDOW_MS
      const cur = m.get(e.city)
      if (!cur) m.set(e.city, { sample: e, isNew: fresh })
      else if (fresh) cur.isNew = true
    }
    return Array.from(m.entries()).map(([name, v]) => ({ name, photo: cityImage(name) ?? v.sample.photo_url, isNew: v.isNew }))
  }, [items])

  const catTabs = f.group === 'place' ? PLACE_TABS : f.group === 'food' ? FOOD_TABS : []

  return (
    <>
      {/* search */}
      <div className="flex items-center gap-2 rounded-md hairline px-3 h-10 bg-surface mb-3">
        <IconSearch size={16} className="text-ink-3" />
        <input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="ค้นหาสถานที่ / ร้าน / เมือง / โน้ต"
          className="flex-1 bg-transparent text-[13px] outline-none" />
        {f.q && <button onClick={() => set({ q: '' })} aria-label="ล้างคำค้นหา" className="text-ink-3 hover:text-ink-2"><IconX size={15} /></button>}
      </div>

      {/* type filter (places / food & cafe) + sort */}
      <div ref={hscroll} className="flex items-center gap-1.5 mb-3 overflow-x-auto no-scrollbar">
        {([['all', 'ทั้งหมด'], ['place', 'Places'], ['food', 'Food and Cafe']] as const).map(([g, label]) => (
          <button key={g} onClick={() => set({ group: g, cat: 'all' })}
            className={['px-3.5 h-8 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0', f.group === g ? 'bg-ink text-white' : 'bg-surface-2 text-ink-2'].join(' ')}>{label}</button>
        ))}
        {showSort && (
          <button onClick={() => set({ sort: f.sort === 'popular' ? 'new' : 'popular' })}
            className={['ml-auto inline-flex items-center gap-1 px-3.5 h-8 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0', f.sort === 'popular' ? 'text-white' : 'bg-surface-2 text-ink-2'].join(' ')}
            style={f.sort === 'popular' ? { background: 'linear-gradient(90deg,#FB7022,#EF4444)' } : undefined}>
            <IconFlame size={14} /> เรียงตามยอดนิยม
          </button>
        )}
      </div>

      {/* category filter (by type, like Places / Food pages) */}
      {catTabs.length > 0 && (
        <div ref={hscroll} className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar">
          {catTabs.map((t) => (
            <button key={t.key} onClick={() => set({ cat: t.key })}
              className={['px-3 h-7 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0', f.cat === t.key ? 'bg-brand text-white' : 'bg-surface-2 text-ink-2'].join(' ')}>{t.label}</button>
          ))}
        </div>
      )}

      {/* city tabs (cards, inline) */}
      {cities.length > 0 && (
        <div ref={hscroll} className="flex gap-2.5 overflow-x-auto no-scrollbar mb-4 pb-1">
          <button onClick={() => set({ city: 'all' })}
            className="shrink-0 w-24 rounded-[12px] overflow-hidden text-left bg-surface"
            style={{ border: `1.5px solid ${f.city === 'all' ? 'var(--color-brand)' : 'var(--color-line)'}` }}>
            <div className="h-20 grid place-items-center bg-surface-2"><IconWorldSearch size={24} className="text-ink-3" /></div>
            <div className="px-2 py-1.5 text-[12px] font-medium truncate text-center">ทุกเมือง</div>
          </button>
          {cities.map((c) => (
            <button key={c.name} onClick={() => set({ city: c.name })}
              className="relative shrink-0 w-24 rounded-[12px] overflow-hidden text-left bg-surface"
              style={{ border: `1.5px solid ${f.city === c.name ? 'var(--color-brand)' : 'var(--color-line)'}` }}>
              {c.isNew && (
                <span className="absolute top-1.5 right-1.5 z-10 inline-flex items-center rounded-full bg-[#EF4444] text-white text-[9px] font-semibold leading-none px-1.5 py-1 shadow">
                  new
                </span>
              )}
              <div className="h-20">
                <SignedImage url={c.photo} alt={c.name} className="w-full h-full object-cover" width={240}
                  fallback={<div className="w-full h-full grid place-items-center bg-surface-2"><IconMapPin size={20} className="text-ink-3" /></div>} />
              </div>
              <div className="px-2 py-1.5 text-[12px] font-medium truncate text-center">{c.name}</div>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
