import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { IconMapPin, IconToolsKitchen2 } from '@tabler/icons-react'
import { PlaceGrid } from '@/components/PlaceGrid'
import { PLACE_TABS, FOOD_TABS } from '@/lib/placeMeta'
import { useTrip } from '@/contexts/TripContext'
import type { PlaceGroup } from '@/lib/database.types'

// Places + Food merged into one workspace page with two clear tabs.
export default function PlacesFood() {
  const location = useLocation()
  const [params] = useSearchParams()
  const { places } = useTrip()

  const initial: PlaceGroup =
    params.get('tab') === 'food' || location.pathname.startsWith('/food') ? 'food' : 'place'
  const [tab, setTab] = useState<PlaceGroup>(initial)
  const [focus, setFocus] = useState<string | null>(params.get('focus'))

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
      {/* Tabs */}
      <div className="flex mb-4" style={{ borderBottom: '0.5px solid var(--color-line)' }} role="tablist">
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button key={t.key} role="tab" aria-selected={active} onClick={() => select(t.key)}
              className={`relative -mb-px flex-1 flex flex-col items-center justify-center gap-1 pt-1 pb-2.5 text-[14px] font-semibold transition-colors ${active ? 'text-brand' : 'text-ink-3 hover:text-ink-2'}`}>
              <t.icon size={26} />
              <span className="flex items-center gap-1.5">
                {t.label}
                <span className={`text-[12px] font-medium ${active ? 'text-brand' : 'text-ink-3'}`}>{t.count}</span>
              </span>
              {active && <span className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-brand" />}
            </button>
          )
        })}
      </div>

      {/* Key per tab so filters/search reset when switching (no cross-tab bleed) */}
      {tab === 'place' ? (
        <PlaceGrid key="place" group="place" tabs={PLACE_TABS}
          title="Places • สถานที่ท่องเที่ยว" addLabel="เพิ่มสถานที่" focusId={focus} />
      ) : (
        <PlaceGrid key="food" group="food" tabs={FOOD_TABS}
          title="Food & café • อาหารการกิน" addLabel="เพิ่มร้าน" focusId={focus} />
      )}
    </div>
  )
}
