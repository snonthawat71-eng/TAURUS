import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconMapPin, IconBuildingMonument, IconToolsKitchen2, IconCake, IconBuildingStore, IconArrowLeft } from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { catMeta } from '@/lib/placeMeta'
import { openMap } from '@/lib/maps'
import { planBranch, planMapUrl } from '@/lib/branches'
import { useBack } from '@/lib/useBack'
import { SignedImage } from '@/components/SignedImage'
import type { Place } from '@/lib/database.types'

function Section({ icon, title, items }: { icon: React.ReactNode; title: string; items: Place[] }) {
  const navigate = useNavigate()
  if (items.length === 0) return null
  return (
    <div className="mb-6">
      <div className="flex items-center gap-1.5 mb-2 text-[13px] font-medium text-ink-2">
        {icon} {title} <span className="text-ink-3 font-normal">{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map((p) => {
          const meta = catMeta(p.category)
          const Icon = meta.icon
          const branch = planBranch(p) // branch picked when added to the plan
          const to = p.group_type === 'food' ? `/places?tab=food&focus=${p.id}` : `/places?tab=place&focus=${p.id}`
          return (
            <div key={p.id} className="card p-3 flex items-center gap-3">
              <button onClick={() => navigate(to)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <span className="size-12 rounded-md overflow-hidden grid place-items-center shrink-0" style={{ background: meta.bg, color: meta.fg }}>
                  <SignedImage url={p.photo_url} path={p.photo_path} focus={p.photo_focus} alt={p.name ?? ''} width={96}
                    className="w-full h-full object-cover"
                    fallback={<Icon size={20} stroke={1.5} />} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[14px] font-medium truncate">{p.name}</span>
                    {(p.multi_branch || !!p.branches?.length) && (
                      <span className="chip !py-0 !px-1.5 !text-[10px] inline-flex items-center gap-0.5 shrink-0"><IconBuildingStore size={11} /> {branch?.label || 'หลายสาขา'}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-ink-3 mt-0.5">
                    <span className="size-2 rounded-full shrink-0" style={{ background: (branch ? branch.color : p.station_color) ?? '#888780' }} />
                    <span className="truncate">{branch ? branch.line : p.station_line}{(branch ? branch.station : p.station_name) ? ` · ${branch ? branch.station : p.station_name}` : ''}</span>
                  </div>
                </div>
              </button>
              <button onClick={() => openMap(planMapUrl(p))} disabled={!planMapUrl(p)}
                className="inline-flex items-center gap-1 text-[11px] text-ink-3 enabled:hover:text-brand-mid shrink-0">
                <IconMapPin size={13} /> MAP
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const NO_CITY = '__none__'

export default function AllPlans() {
  const { trip, places, myPermission } = useTrip()
  const [city, setCity] = useState('all')
  // places-only members don't have Itinerary in their nav — send them to Places
  const goBack = useBack(myPermission === 'places' ? '/places' : '/itinerary')
  const inPlan = useMemo(() => places.filter((p) => p.in_plan), [places])

  // cities present among in-plan items, ordered by the trip's city list first
  const cityOrder = useMemo(() => {
    const set = new Set<string>()
    ;(trip?.cities ?? []).forEach((c) => { if (inPlan.some((p) => p.city === c)) set.add(c) })
    inPlan.forEach((p) => { if (p.city) set.add(p.city) })
    return Array.from(set)
  }, [trip?.cities, inPlan])
  const hasNoCity = inPlan.some((p) => !p.city)
  const showCityFilter = cityOrder.length > 1 || (cityOrder.length === 1 && hasNoCity)

  const visible = useMemo(() => {
    if (city === 'all') return inPlan
    if (city === NO_CITY) return inPlan.filter((p) => !p.city)
    return inPlan.filter((p) => p.city === city)
  }, [inPlan, city])

  const sights = visible.filter((p) => p.group_type === 'place')
  const restaurants = visible.filter((p) => p.category === 'restaurant')
  const cafesDesserts = visible.filter((p) => p.category === 'cafe' || p.category === 'dessert')

  const header = (
    <div className="flex items-center gap-2 mb-4">
      <button onClick={goBack} className="btn-icon" aria-label="กลับ" title="กลับ"><IconArrowLeft size={16} /></button>
      <h1 className="text-[16px] font-medium">Places List • รายการในลิสต์</h1>
    </div>
  )

  if (inPlan.length === 0) {
    return (
      <div>
        {header}
        <div className="card p-8 text-center">
          <p className="text-[14px] font-medium">ยังไม่มีรายการในลิสต์</p>
          <p className="text-[12px] text-ink-2 mt-1.5">ไปที่หน้า Places หรือ Food & café แล้วกดปุ่ม + เพื่อเพิ่มเข้าลิสต์</p>
        </div>
      </div>
    )
  }

  const cityChips = [
    { key: 'all', label: 'ทั้งหมด' },
    ...cityOrder.map((c) => ({ key: c, label: c })),
    ...(hasNoCity ? [{ key: NO_CITY, label: 'ไม่ระบุเมือง' }] : []),
  ]

  return (
    <div>
      {header}
      {showCityFilter && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-4">
          {cityChips.map((c) => (
            <button key={c.key} onClick={() => setCity(c.key)}
              className={['shrink-0 rounded-full px-3 h-7 text-[12px] font-medium transition-colors',
                city === c.key ? 'bg-ink text-white' : 'bg-surface-2 text-ink-2 hover:bg-surface-2/70'].join(' ')}>
              {c.label}
            </button>
          ))}
        </div>
      )}
      {visible.length === 0 ? (
        <div className="card p-8 text-center text-[13px] text-ink-2">ไม่มีรายการในเมืองนี้</div>
      ) : (
        <>
          <Section icon={<IconBuildingMonument size={15} />} title="Attractions • สถานที่ท่องเที่ยว" items={sights} />
          <Section icon={<IconToolsKitchen2 size={15} />} title="Restaurants • ร้านอาหาร" items={restaurants} />
          <Section icon={<IconCake size={15} />} title="Cafés & Desserts • คาเฟ่ & ร้านขนม" items={cafesDesserts} />
        </>
      )}
    </div>
  )
}
