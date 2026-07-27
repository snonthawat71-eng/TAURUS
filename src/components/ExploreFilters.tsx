import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  IconWorldSearch, IconMapPin, IconFlame, IconSearch, IconX,
  IconChevronDown, IconChevronLeft, IconCheck, IconLayoutGrid,
  IconSortDescending2, IconSortAscending2,
} from '@tabler/icons-react'
import { SignedImage } from './SignedImage'
import { hscroll } from '@/lib/hscroll'
import { cityImage, countryImage } from '@/lib/cityImages'
import { canonicalCountry } from '@/lib/countries'
import { PLACE_TABS, FOOD_GROUPS, CATEGORY, type CategoryTab } from '@/lib/placeMeta'
import type { ExploreFilterState } from '@/lib/exploreFilter'
import type { ExplorePlace } from '@/lib/database.types'

/** A city is flagged "new" when it has a place added within this window. */
const NEW_CITY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

// Per-user record of the newest item the user has already seen in each city, so
// the "new" badge clears once they tap into that city (kept in localStorage).
const seenKey = (uid: string) => `explore:cityNewSeen:${uid}`
function loadSeen(uid: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(seenKey(uid)) || '{}') } catch { return {} }
}

// Food dropdown = every detailed food category (not just the 4 groups), each
// with its own icon, so the picker mirrors the full list of types.
const FOOD_DETAIL_TABS: CategoryTab[] = [
  { key: 'all', label: 'ทั้งหมด' },
  ...FOOD_GROUPS.flatMap((g) => g.cats).map((k) => ({ key: k, label: CATEGORY[k]?.label ?? k })),
  { key: 'gother', label: 'อื่นๆ' },
]

const SORT_OPTS = [
  { key: 'new', label: 'ล่าสุด (ใหม่ → เก่า)', icon: IconSortDescending2 },
  { key: 'old', label: 'เก่า → ใหม่', icon: IconSortAscending2 },
] as const

/** A pill button with a dropdown menu portalled to <body>, so it can't be
 *  clipped by the horizontally-scrolling filter bar it lives in. */
function Dropdown({ label, applied, width = 210, chevron = true, onActivate, children }: {
  label: ReactNode
  applied: boolean
  width?: number
  /** show the ▾ affordance (off for the icon-only sort button) */
  chevron?: boolean
  /** fired when the menu is opened — e.g. apply the group filter right away */
  onActivate?: () => void
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    setRect(btnRef.current?.getBoundingClientRect() ?? null)
    // stop the browser's pull-to-refresh / overscroll from firing while the
    // menu is open (dragging the short menu was reloading the page on mobile)
    const root = document.documentElement
    const prevOB = root.style.overscrollBehaviorY
    root.style.overscrollBehaviorY = 'none'
    const onDoc = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return
      if (document.getElementById('dd-menu')?.contains(e.target as Node)) return
      setOpen(false)
    }
    // dismiss on page/bar scroll — but NOT when scrolling inside the menu list
    const onMove = (e: Event) => {
      if (document.getElementById('dd-menu')?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      root.style.overscrollBehaviorY = prevOB
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open])

  const left = rect ? Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) : 0
  // keep the menu inside the viewport; it scrolls internally if the list is long
  const maxH = rect ? Math.max(180, window.innerHeight - rect.bottom - 16) : 320

  return (
    <>
      <button ref={btnRef} onClick={() => setOpen((o) => { const n = !o; if (n) onActivate?.(); return n })}
        className={['inline-flex items-center gap-1 h-8 px-3 rounded-full text-[12px] font-semibold whitespace-nowrap shrink-0 border',
          applied ? 'bg-brand-soft text-brand-dark border-brand' : 'bg-surface text-ink-2 border-line-2'].join(' ')}>
        {label}
        {chevron && <IconChevronDown size={13} className={['opacity-70 transition-transform', open ? 'rotate-180' : ''].join(' ')} />}
      </button>
      {open && rect && createPortal(
        <div id="dd-menu" onTouchMove={(e) => e.stopPropagation()}
          style={{ position: 'fixed', top: rect.bottom + 6, left, width, maxHeight: maxH, overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
          className="z-[200] rounded-[13px] bg-surface hairline shadow-xl overflow-y-auto py-1">
          {children(() => setOpen(false))}
        </div>,
        document.body)}
    </>
  )
}

/** Search box + a compact control bar: เรียงตาม (sort) · quick "ทั้งหมด" ·
 *  Places/Food category dropdowns · a prominent "ยอดนิยม" toggle. City cards
 *  stay below as their own visual row. */
export function ExploreFilters({ items, f, set, showSort = true, userId }: {
  items: ExplorePlace[]
  f: ExploreFilterState
  set: (patch: Partial<ExploreFilterState>) => void
  /** show the "sort by popularity" toggle (hidden on the manage page) */
  showSort?: boolean
  /** owner of the "seen new cities" record (badge clears per user) */
  userId?: string
}) {
  const [seen, setSeen] = useState<Record<string, string>>(() => (userId ? loadSeen(userId) : {}))

  // Cities grouped under their canonical country — the browser shows countries
  // first and drills into one country's cities. Insertion order is preserved,
  // so both rails stay ordered newest-shared-first like the list itself.
  const countries = useMemo(() => {
    const now = Date.now()
    type Agg = { sample: ExplorePlace; fresh: boolean; newestAt: string; count: number }
    const byCountry = new Map<string, Map<string, Agg>>()
    for (const e of items) {
      if (!e.city) continue
      const key = canonicalCountry(e.country)
      const at = e.created_at ?? ''
      const fresh = !!at && now - new Date(at).getTime() < NEW_CITY_WINDOW_MS
      let m = byCountry.get(key)
      if (!m) { m = new Map(); byCountry.set(key, m) }
      const cur = m.get(e.city)
      if (!cur) m.set(e.city, { sample: e, fresh, newestAt: at, count: 1 })
      else { if (fresh) cur.fresh = true; if (at > cur.newestAt) cur.newestAt = at; cur.count++ }
    }
    return Array.from(byCountry.entries()).map(([key, m]) => {
      const cities = Array.from(m.entries()).map(([name, v]) => ({
        name, photo: cityImage(name) ?? v.sample.photo_url, newestAt: v.newestAt, count: v.count,
        isNew: v.fresh && (!seen[name] || v.newestAt > seen[name]),
      }))
      // no dedicated country photo yet → borrow the one from the city this
      // country has the most places in (COUNTRY_IMAGES in cityImages.ts wins)
      const top = [...cities].sort((a, b) => b.count - a.count)[0]
      return {
        key,
        label: key || 'ไม่ระบุประเทศ',
        photo: (key ? countryImage(key) : undefined) ?? top?.photo,
        // a country is "new" when any city inside it is — otherwise there'd be
        // no way to tell which country to open to find the new places
        isNew: cities.some((c) => c.isNew),
        cities,
      }
    })
  }, [items, seen])

  const current = f.country === 'all' ? null : countries.find((c) => c.key === f.country) ?? null
  // a country with one city has nothing to drill into — tapping its card filters
  // straight to that city and the rail stays on countries
  const drilled = !!current && current.cities.length > 1
  // hold the last opened country mounted so the city rail slides OUT with its
  // cards still in it, instead of emptying the instant you tap back
  const [lastKey, setLastKey] = useState<string | null>(null)
  useEffect(() => { if (drilled && current) setLastKey(current.key) }, [drilled, current?.key]) // eslint-disable-line react-hooks/exhaustive-deps
  // while closed, keep rendering the country we just left so its cards slide out
  // with it — swapping to a different country mid-exit would look like a glitch
  const openCountry = drilled ? current : countries.find((c) => c.key === lastKey) ?? null

  const cardStyle = (on: boolean) => ({ border: `1.5px solid ${on ? 'var(--color-brand)' : 'var(--color-line)'}` })
  const cardCls = 'relative shrink-0 w-24 rounded-[12px] overflow-hidden text-left bg-surface'

  function markSeen(name: string, newestAt: string) {
    if (!userId || !newestAt) return
    setSeen((prev) => {
      if (prev[name] === newestAt) return prev
      const next = { ...prev, [name]: newestAt }
      try { localStorage.setItem(seenKey(userId), JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  // a Places/Food dropdown: picking a subcategory switches group + cat at once
  const groupMenu = (group: 'place' | 'food', base: string, tabs: CategoryTab[]) => {
    const active = f.group === group
    const sub = active ? tabs.find((t) => t.key === f.cat && t.key !== 'all')?.label : undefined
    return (
      <Dropdown applied={active} onActivate={() => set({ group, cat: 'all' })}
        label={<span className={active ? '' : 'text-ink'}>{sub ?? base}</span>}>
        {(close) => tabs.map((t) => {
          const on = active && f.cat === t.key
          const cm = CATEGORY[t.key]
          const CIcon = t.key === 'all' ? IconLayoutGrid : cm?.icon
          return (
            <button key={t.key} onClick={() => { set({ group, cat: t.key }); close() }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-surface-2 border-b border-line last:border-0">
              <span className="size-7 rounded-full grid place-items-center shrink-0"
                style={{ background: cm?.bg ?? 'var(--color-surface-2)', color: cm?.fg ?? 'var(--color-ink-3)' }}>
                {CIcon && <CIcon size={15} />}
              </span>
              <span className={on ? 'font-semibold text-brand-dark' : ''}>{t.label}</span>
              {on && <IconCheck size={16} className="ml-auto text-brand shrink-0" />}
            </button>
          )
        })}
      </Dropdown>
    )
  }

  return (
    <>
      {/* search */}
      <div className="flex items-center gap-2 rounded-md hairline px-3 h-10 bg-surface mb-3">
        <IconSearch size={16} className="text-ink-3" />
        <input value={f.q}
          onChange={(e) => {
            const q = e.target.value
            // starting a search while a country is open would hide the matches
            // that live elsewhere — pop back to every country on the first
            // character typed (drilling in again afterwards still works)
            const opening = !f.q.trim() && !!q.trim() && f.country !== 'all'
            set(opening ? { q, country: 'all', city: 'all' } : { q })
          }}
          placeholder="ค้นหาสถานที่ / ร้าน / เมือง / โน้ต"
          className="flex-1 bg-transparent text-[13px] outline-none" />
        {f.q && <button onClick={() => set({ q: '' })} aria-label="ล้างคำค้นหา" className="text-ink-3 hover:text-ink-2"><IconX size={15} /></button>}
      </div>

      {/* one flat scrolling row: เรียงตาม · ทั้งหมด · Places▾ · Food▾ … 🔥 ยอดนิยม */}
      <div ref={hscroll} className="flex items-center gap-1.5 mb-3 overflow-x-auto no-scrollbar">
        {/* sort dropdown — keeps the original line filter icon, no ▾ chevron */}
        <Dropdown applied={f.sort === 'old'} width={210} chevron={false}
          label={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="text-ink"><path d="M4 6h16M7 12h10M10 18h4" /></svg>}>
          {(close) => SORT_OPTS.map((o) => {
            const on = f.sort === o.key
            return (
              <button key={o.key} onClick={() => { set({ sort: o.key }); close() }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] hover:bg-surface-2 border-b border-line last:border-0">
                <o.icon size={17} className="text-ink-3 shrink-0" />
                <span className={on ? 'font-semibold text-brand-dark' : ''}>{o.label}</span>
                {on && <IconCheck size={16} className="ml-auto text-brand shrink-0" />}
              </button>
            )
          })}
        </Dropdown>

        {/* ทั้งหมด — clears the group/category filter */}
        <button onClick={() => set({ group: 'all', cat: 'all' })}
          className={['h-8 px-3.5 rounded-full text-[12px] font-semibold whitespace-nowrap shrink-0 border',
            f.group === 'all' ? 'bg-ink text-white border-ink' : 'bg-surface text-ink-2 border-line-2'].join(' ')}>
          ทั้งหมด
        </button>

        {groupMenu('place', 'Places', PLACE_TABS)}
        {groupMenu('food', 'Food', FOOD_DETAIL_TABS)}

        {/* prominent popularity toggle — hugs the right, one tap */}
        {showSort && (
          <button onClick={() => set({ sort: f.sort === 'popular' ? 'new' : 'popular' })}
            className={['ml-auto inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[12px] font-bold whitespace-nowrap shrink-0 border',
              f.sort === 'popular' ? 'text-white border-transparent' : 'bg-surface text-ink-2 border-line-2'].join(' ')}
            style={f.sort === 'popular' ? { background: 'linear-gradient(90deg,#FB7022,#EF4444)', boxShadow: '0 3px 10px rgba(239,68,68,.3)' } : undefined}>
            <IconFlame size={14} /> ยอดนิยม
          </button>
        )}
      </div>

      {/* Country → city browser. The two rails swap inside one slot: the country
          rail slides out left, the city rail slides in from the right. The
          country rail stays in flow (just hidden) so the row height never
          changes and the list below never jumps. */}
      {countries.length > 0 && (
        <div className="relative overflow-hidden mb-4">
          {/* countries */}
          <div className={['rail-layer slide-left', drilled ? 'is-hidden' : ''].join(' ')}>
            <div ref={hscroll} className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
              <button onClick={() => set({ country: 'all', city: 'all' })}
                className={cardCls} style={cardStyle(f.country === 'all')}>
                <div className="h-20 grid place-items-center bg-surface-2"><IconWorldSearch size={24} className="text-ink-3" /></div>
                <div className="px-2 py-1.5 text-[12px] font-medium truncate text-center">ทุกประเทศ</div>
              </button>
              {countries.map((c) => {
                const solo = c.cities.length === 1
                const on = f.country === c.key
                return (
                  <button key={c.key}
                    onClick={() => {
                      // one city → no drill-down, tap filters that city directly
                      // (and tapping again clears it); many cities → open the rail
                      if (!solo) { set({ country: c.key, city: 'all' }); return }
                      if (on) { set({ country: 'all', city: 'all' }); return }
                      set({ country: c.key, city: c.cities[0].name })
                      markSeen(c.cities[0].name, c.cities[0].newestAt)
                    }}
                    className={cardCls} style={cardStyle(on)}>
                    {c.isNew && (
                      <span className="absolute top-1.5 right-1.5 z-10 inline-flex items-center rounded-full bg-[#EF4444] text-white text-[9px] font-semibold leading-none px-1.5 py-1 shadow">
                        new
                      </span>
                    )}
                    <div className="h-20">
                      <SignedImage url={c.photo} alt={c.label} className="w-full h-full object-cover" width={240}
                        fallback={<div className="w-full h-full grid place-items-center bg-surface-2"><IconMapPin size={20} className="text-ink-3" /></div>} />
                    </div>
                    <div className="px-2 py-1.5 text-[12px] font-medium truncate text-center">{c.label}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* cities of the opened country — this layer is always mounted (empty
              until the first drill) so the class flip has something to animate */}
          <div className={['rail-layer slide-right absolute inset-0', drilled ? '' : 'is-hidden'].join(' ')}>
            {openCountry && (
              <div key={openCountry.key} ref={hscroll} className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
                {/* back to the country rail — carries the country's own name so
                    there's no extra header row eating vertical space */}
                <button onClick={() => set({ country: 'all', city: 'all' })}
                  className="shrink-0 w-[68px] rounded-[12px] bg-surface flex flex-col items-center justify-center gap-1 text-ink-2 hover:bg-surface-2"
                  style={{ border: '1.5px solid var(--color-line)' }}>
                  <IconChevronLeft size={18} />
                  <span className="text-[10px] font-semibold leading-none truncate max-w-[60px] px-1">{openCountry.label}</span>
                </button>
                <button onClick={() => set({ city: 'all' })}
                  className={cardCls} style={cardStyle(f.city === 'all')}>
                  <div className="h-20 grid place-items-center bg-surface-2"><IconWorldSearch size={24} className="text-ink-3" /></div>
                  <div className="px-2 py-1.5 text-[12px] font-medium truncate text-center">ทุกเมือง</div>
                </button>
                {openCountry.cities.map((c) => (
                  <button key={c.name} onClick={() => { set({ city: c.name }); markSeen(c.name, c.newestAt) }}
                    className={cardCls} style={cardStyle(f.city === c.name)}>
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
          </div>
        </div>
      )}
    </>
  )
}
