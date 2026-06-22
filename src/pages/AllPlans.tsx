import { useNavigate } from 'react-router-dom'
import { IconMapPin, IconBuildingMonument, IconToolsKitchen2, IconCake, IconBuildingStore } from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { catMeta } from '@/lib/placeMeta'
import { openMap } from '@/lib/maps'
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
          const to = p.group_type === 'food' ? `/food?focus=${p.id}` : `/places?focus=${p.id}`
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
                      <span className="chip !py-0 !px-1.5 !text-[10px] inline-flex items-center gap-0.5 shrink-0"><IconBuildingStore size={11} /> หลายสาขา</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-ink-3 mt-0.5">
                    <span className="size-2 rounded-full shrink-0" style={{ background: p.station_color ?? '#888780' }} />
                    <span className="truncate">{p.station_line}{p.station_name ? ` · ${p.station_name}` : ''}</span>
                  </div>
                </div>
              </button>
              <button onClick={() => openMap(p.map_url)} disabled={!p.map_url}
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

export default function AllPlans() {
  const { places } = useTrip()
  const inPlan = places.filter((p) => p.in_plan)
  const sights = inPlan.filter((p) => p.group_type === 'place')
  const restaurants = inPlan.filter((p) => p.category === 'restaurant')
  const cafesDesserts = inPlan.filter((p) => p.category === 'cafe' || p.category === 'dessert')

  if (inPlan.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[14px] font-medium">ยังไม่มีรายการในแพลน</p>
        <p className="text-[12px] text-ink-2 mt-1.5">ไปที่หน้า Places หรือ Food & café แล้วกดปุ่ม + เพื่อเพิ่มเข้าแพลน</p>
      </div>
    )
  }

  return (
    <div>
      <Section icon={<IconBuildingMonument size={15} />} title="Attractions • สถานที่ท่องเที่ยว" items={sights} />
      <Section icon={<IconToolsKitchen2 size={15} />} title="Restaurants • ร้านอาหาร" items={restaurants} />
      <Section icon={<IconCake size={15} />} title="Cafés & Desserts • คาเฟ่ & ร้านขนม" items={cafesDesserts} />
    </div>
  )
}
