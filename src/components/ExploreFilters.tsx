import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  IconWorldSearch, IconMapPin, IconFlame, IconSearch, IconX,
  IconLayoutGrid, IconChevronDown, IconCheck,
} from '@tabler/icons-react'
import { SignedImage } from './SignedImage'
import { Drawer } from './Drawer'
import { hscroll } from '@/lib/hscroll'
import { cityImage } from '@/lib/cityImages'
import { PLACE_TABS, FOOD_TABS, CATEGORY, type CategoryTab } from '@/lib/placeMeta'
import { filterExplore, type ExploreFilterState } from '@/lib/exploreFilter'
import type { ExplorePlace } from '@/lib/database.types'

/** A city is flagged "new" when it has a place added within this window. */
const NEW_CITY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

// Per-user record of the newest item the user has already seen in each city, so
// the "new" badge clears once they tap into that city (kept in localStorage).
const seenKey = (uid: string) => `explore:cityNewSeen:${uid}`
function loadSeen(uid: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(seenKey(uid)) || '{}') } catch { return {} }
}

const GROUPS = [['all', 'ทั้งหมด'], ['place', 'Places'], ['food', 'Food and Cafe']] as const

/** A pill button with a dropdown menu portalled to <body>, so it can't be
 *  clipped by the horizontally-scrolling filter bar it lives in. */
function Dropdown({ label, applied, width = 208, children }: {
  label: ReactNode
  applied: boolean
  width?: number
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    setRect(btnRef.current?.getBoundingClientRect() ?? null)
    const onDoc = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return
      if (document.getElementById('dd-menu')?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onMove = () => setOpen(false) // any scroll/resize dismisses (menu is fixed)
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open])

  const left = rect ? Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) : 0

  return (
    <>
      <button ref={btnRef} onClick={() => setOpen((o) => !o)}
        className={['inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[12.5px] font-semibold whitespace-nowrap shrink-0 border',
          applied ? 'bg-brand-soft text-brand-dark border-brand' : 'bg-surface text-ink-2 border-line-2'].join(' ')}>
        {label}
        <IconChevronDown size={14} className={['opacity-70 transition-transform', open ? 'rotate-180' : ''].join(' ')} />
      </button>
      {open && rect && createPortal(
        <div id="dd-menu" style={{ position: 'fixed', top: rect.bottom + 6, left, width }}
          className="z-[200] rounded-[13px] bg-surface hairline shadow-xl overflow-hidden max-h-[300px] overflow-y-auto py-1">
          {children(() => setOpen(false))}
        </div>,
        document.body)}
    </>
  )
}

/** Search box + a single compact control bar: filter sheet (⚙) · quick "ทั้งหมด" ·
 *  Places/Food category dropdowns · a prominent "ยอดนิยม" sort toggle pinned
 *  right. City cards stay below as their own visual row. */
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
  const [sheet, setSheet] = useState(false)

  const cities = useMemo(() => {
    const now = Date.now()
    const m = new Map<string, { sample: ExplorePlace; fresh: boolean; newestAt: string }>()
    for (const e of items) {
      if (!e.city) continue
      const at = e.created_at ?? ''
      const fresh = !!at && now - new Date(at).getTime() < NEW_CITY_WINDOW_MS
      const cur = m.get(e.city)
      if (!cur) m.set(e.city, { sample: e, fresh, newestAt: at })
      else { if (fresh) cur.fresh = true; if (at > cur.newestAt) cur.newestAt = at }
    }
    return Array.from(m.entries()).map(([name, v]) => ({
      name, photo: cityImage(name) ?? v.sample.photo_url, newestAt: v.newestAt,
      // still "new" until the user has viewed something at least as recent
      isNew: v.fresh && (!seen[name] || v.newestAt > seen[name]),
    }))
  }, [items, seen])

  // mark a city's newest item as seen → clears its "new" badge
  function markSeen(name: string, newestAt: string) {
    if (!userId || !newestAt) return
    setSeen((prev) => {
      if (prev[name] === newestAt) return prev
      const next = { ...prev, [name]: newestAt }
      try { localStorage.setItem(seenKey(userId), JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  const sheetCatTabs = f.group === 'place' ? PLACE_TABS : f.group === 'food' ? FOOD_TABS : []
  const activeCount = (f.group !== 'all' ? 1 : 0) + (f.cat !== 'all' ? 1 : 0)
  const resultCount = useMemo(() => filterExplore(items, f, new Map()).length, [items, f])

  // a Places/Food dropdown: picking a subcategory switches group + cat at once
  const groupMenu = (group: 'place' | 'food', base: string, tabs: CategoryTab[]) => {
    const active = f.group === group
    const sub = active ? tabs.find((t) => t.key === f.cat && t.key !== 'all')?.label : undefined
    return (
      <Dropdown applied={active} label={sub ?? base}>
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
        <input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="ค้นหาสถานที่ / ร้าน / เมือง / โน้ต"
          className="flex-1 bg-transparent text-[13px] outline-none" />
        {f.q && <button onClick={() => set({ q: '' })} aria-label="ล้างคำค้นหา" className="text-ink-3 hover:text-ink-2"><IconX size={15} /></button>}
      </div>

      {/* one flat scrolling row: ⚙ · ทั้งหมด · Places▾ · Food▾ … 🔥 ยอดนิยม
          (all in the same scroll flow so nothing overlaps; ยอดนิยม hugs the
          right edge when there's room via ml-auto) */}
      <div ref={hscroll} className="flex items-center gap-2 mb-3 overflow-x-auto no-scrollbar">
        {/* full filter sheet — line filter icon (matches the mockup) */}
        <button onClick={() => setSheet(true)}
          className={['relative inline-flex items-center justify-center h-9 px-3 rounded-full shrink-0 border',
            activeCount ? 'bg-brand-soft text-brand-dark border-brand' : 'bg-surface text-ink border-line-2'].join(' ')}
          aria-label="ตัวกรอง">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[10.5px] font-bold grid place-items-center ring-2 ring-canvas">{activeCount}</span>
          )}
        </button>

        {/* ทั้งหมด — clears the group/category filter */}
        <button onClick={() => set({ group: 'all', cat: 'all' })}
          className={['h-9 px-4 rounded-full text-[12.5px] font-semibold whitespace-nowrap shrink-0 border',
            f.group === 'all' ? 'bg-ink text-white border-ink' : 'bg-surface text-ink-2 border-line-2'].join(' ')}>
          ทั้งหมด
        </button>

        {groupMenu('place', 'Places', PLACE_TABS)}
        {groupMenu('food', 'Food', FOOD_TABS)}

        {/* prominent popularity toggle — hugs the right, one tap */}
        {showSort && (
          <button onClick={() => set({ sort: f.sort === 'popular' ? 'new' : 'popular' })}
            className={['ml-auto inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[12.5px] font-bold whitespace-nowrap shrink-0 border',
              f.sort === 'popular' ? 'text-white border-transparent' : 'bg-surface text-ink-2 border-line-2'].join(' ')}
            style={f.sort === 'popular' ? { background: 'linear-gradient(90deg,#FB7022,#EF4444)', boxShadow: '0 3px 10px rgba(239,68,68,.3)' } : undefined}>
            <IconFlame size={15} /> ยอดนิยม
          </button>
        )}
      </div>

      {/* city tabs (cards, inline) — kept outside the sheet as a visual row */}
      {cities.length > 0 && (
        <div ref={hscroll} className="flex gap-2.5 overflow-x-auto no-scrollbar mb-4 pb-1">
          <button onClick={() => set({ city: 'all' })}
            className="shrink-0 w-24 rounded-[12px] overflow-hidden text-left bg-surface"
            style={{ border: `1.5px solid ${f.city === 'all' ? 'var(--color-brand)' : 'var(--color-line)'}` }}>
            <div className="h-20 grid place-items-center bg-surface-2"><IconWorldSearch size={24} className="text-ink-3" /></div>
            <div className="px-2 py-1.5 text-[12px] font-medium truncate text-center">ทุกเมือง</div>
          </button>
          {cities.map((c) => (
            <button key={c.name} onClick={() => { set({ city: c.name }); markSeen(c.name, c.newestAt) }}
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

      {/* ── full filter sheet (⚙): type + subcategory ────────────────────── */}
      <Drawer open={sheet} onClose={() => setSheet(false)} title="ตัวกรอง">
        <div className="flex flex-col gap-5">
          {/* type (group) — segmented control */}
          <div>
            <div className="text-[12px] font-semibold text-ink-3 mb-2.5">ประเภท</div>
            <div className="inline-flex bg-surface-2 rounded-full p-1 gap-1 w-full">
              {GROUPS.map(([g, label]) => (
                <button key={g} onClick={() => set({ group: g, cat: 'all' })}
                  className={['flex-1 h-9 rounded-full text-[12.5px] font-semibold whitespace-nowrap',
                    f.group === g ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'].join(' ')}>{label}</button>
              ))}
            </div>
          </div>

          {/* subcategory — depends on the chosen group */}
          {sheetCatTabs.length > 0 && (
            <div>
              <div className="text-[12px] font-semibold text-ink-3 mb-2.5">หมวดย่อย</div>
              <div className="flex flex-wrap gap-2">
                {sheetCatTabs.map((t) => (
                  <button key={t.key} onClick={() => set({ cat: t.key })}
                    className={['inline-flex items-center gap-1 h-8 px-3.5 rounded-full text-[12.5px] font-semibold border',
                      f.cat === t.key ? 'bg-brand-soft text-brand-dark border-brand' : 'bg-surface text-ink-2 border-line-2'].join(' ')}>
                    {f.cat === t.key && t.key !== 'all' && <IconCheck size={13} />}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* footer */}
          <div className="flex gap-2.5 pt-1">
            <button onClick={() => set({ group: 'all', cat: 'all' })}
              className="h-11 px-5 rounded-[12px] bg-surface-2 text-ink-2 text-[13.5px] font-semibold shrink-0">ล้างทั้งหมด</button>
            <button onClick={() => setSheet(false)}
              className="flex-1 h-11 rounded-[12px] bg-brand text-white text-[13.5px] font-bold">
              ดูผลลัพธ์ {resultCount} รายการ
            </button>
          </div>
        </div>
      </Drawer>
    </>
  )
}
