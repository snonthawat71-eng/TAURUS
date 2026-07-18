import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { IconMapPin, IconToolsKitchen2, IconMap2, IconChevronRight, IconSearch, IconX } from '@tabler/icons-react'
import { PlaceGrid } from '@/components/PlaceGrid'
import { PLACE_TABS, FOOD_TABS } from '@/lib/placeMeta'
import { useTrip } from '@/contexts/TripContext'
import type { PlaceGroup } from '@/lib/database.types'

// Places + Food merged into one workspace page with two clear tabs.
export default function PlacesFood() {
  const location = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { places } = useTrip()

  const initial: PlaceGroup =
    params.get('tab') === 'food' || location.pathname.startsWith('/food') ? 'food' : 'place'
  const [tab, setTab] = useState<PlaceGroup>(initial)
  const [focus, setFocus] = useState<string | null>(params.get('focus'))
  // search lives above the tabs and covers both tabs, so it's owned here and
  // shared across them (no reset when switching tab)
  const [query, setQuery] = useState('')

  // React to deep links arriving while the page is already mounted (e.g. tapping
  // an item on "All plans" jumps straight to its tab + opens its detail).
  useEffect(() => {
    const t = params.get('tab')
    const f = params.get('focus')
    if (t === 'food' || t === 'place') setTab(t)
    if (f) setFocus(f)
  }, [params])

  const counts = {
    place: places.filter((p) => p.group_type === 'place').length,
    food: places.filter((p) => p.group_type === 'food').length,
  }

  const TABS = [
    { key: 'place' as PlaceGroup, label: 'Places', icon: IconMapPin, count: counts.place },
    { key: 'food' as PlaceGroup, label: 'Food & café', icon: IconToolsKitchen2, count: counts.food },
  ]

  // switching tabs by hand drops any deep-link focus so it doesn't reopen later
  const select = (t: PlaceGroup) => { setTab(t); setFocus(null) }

  return (
    <div>
      {/* Search — sits above the tabs and searches across both */}
      <div className="flex items-center gap-2 rounded-md hairline px-3 h-10 bg-surface mb-3">
        <IconSearch size={16} className="text-ink-3" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาสถานที่ / ร้าน / สถานี — ทุกแท็บ"
          className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-ink-3" />
        {query && <button onClick={() => setQuery('')} aria-label="ล้างคำค้นหา" className="text-ink-3"><IconX size={15} /></button>}
      </div>

      {/* Tabs */}
      <div className="flex mb-4" style={{ borderBottom: '0.5px solid var(--color-line)' }} role="tablist">
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button key={t.key} role="tab" aria-selected={active} onClick={() => select(t.key)}
              className={`relative -mb-px flex-1 flex items-center justify-center gap-1.5 pb-2.5 text-[14px] font-semibold transition-colors ${active ? 'text-brand' : 'text-ink-3 hover:text-ink-2'}`}>
              <t.icon size={16} /> {t.label}
              <span className={`text-[12px] font-medium ${active ? 'text-brand' : 'text-ink-3'}`}>{t.count}</span>
              {active && <span className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-brand" />}
            </button>
          )
        })}
      </div>

      {/* Trip map — prominent entry card, right under the tabs */}
      <button onClick={() => navigate('/map')}
        className="w-full mb-4 rounded-[14px] p-4 flex items-center gap-3.5 text-left text-white"
        style={{ background: 'var(--color-ink)', boxShadow: '0 6px 18px rgba(10,20,40,.22)' }}>
        <IconMap2 size={26} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold leading-tight">แผนที่ทริป</span>
          <span className="block text-[12px] mt-0.5 opacity-80">ดูทุกสถานที่ปักหมุดตามตำแหน่งจริงบนแผนที่</span>
        </span>
        <IconChevronRight size={20} className="shrink-0 opacity-70" />
      </button>

      {/* Key per tab so filters reset when switching (no cross-tab bleed); the
          search box is lifted out above the tabs and shared via query/onQuery. */}
      {tab === 'place' ? (
        <PlaceGrid key="place" group="place" tabs={PLACE_TABS}
          title="Places • สถานที่ท่องเที่ยว" addLabel="เพิ่มสถานที่" focusId={focus} query={query} onQuery={setQuery} />
      ) : (
        <PlaceGrid key="food" group="food" tabs={FOOD_TABS}
          title="Food & café • อาหารการกิน" addLabel="เพิ่มร้าน" focusId={focus} query={query} onQuery={setQuery} />
      )}
    </div>
  )
}
