import { IconCheck, IconPlus, IconMapPin, IconPencil, IconHeart, IconHeartFilled, IconStar } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { AvatarStack } from './Avatar'
import { SignedImage } from './SignedImage'
import { catMeta } from '@/lib/placeMeta'
import { openMap } from '@/lib/maps'
import type { Interested } from './PlaceCard'
import type { Place } from '@/lib/database.types'

export function PlaceDetail({
  place, interested, mine, open, canEdit = true, onClose, onTogglePlan, onToggleInterest, onEdit, onPin,
}: {
  place: Place | null
  interested: Interested[]
  mine: boolean
  open: boolean
  canEdit?: boolean
  onClose: () => void
  onTogglePlan: () => void
  onToggleInterest: () => void
  onEdit?: () => void
  onPin?: () => void
}) {
  if (!place) return null
  const meta = catMeta(place.category)
  const Icon = meta.icon

  return (
    <Drawer open={open} onClose={onClose} title="รายละเอียด">
      <div className="h-40 rounded-[14px] relative grid place-items-center overflow-hidden mt-1" style={{ background: meta.bg }}>
        <SignedImage path={place.photo_path} alt={place.name ?? ''} className="absolute inset-0 w-full h-full object-cover"
          fallback={<Icon size={40} stroke={1.4} style={{ color: meta.fg, opacity: 0.85 }} />} />
        <span className="absolute bottom-2 right-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium z-10" style={{ background: '#fff', color: meta.fg }}>
          {meta.label}
        </span>
      </div>

      <div className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[16px] font-medium">{place.name}</h2>
            <div className="flex items-center gap-1.5 text-[12px] text-ink-3 mt-1">
              <span className="size-2 rounded-full" style={{ background: place.station_color ?? '#888780' }} />
              {place.station_line}{place.station_name ? ` · ${place.station_name}` : ''}
            </div>
          </div>
          {onEdit && <button onClick={onEdit} className="btn-icon !size-8" aria-label="แก้ไข"><IconPencil size={15} /></button>}
        </div>

        {place.note && <p className="text-[13px] text-ink-2 mt-3 leading-relaxed">{place.note}</p>}

        {canEdit ? (
          <button onClick={onToggleInterest} className="flex items-center gap-2 mt-4">
            {interested.length > 0 && <AvatarStack people={interested} size={22} />}
            <span className="flex items-center gap-1 text-[12px] text-ink-2">
              {mine ? <IconHeartFilled size={14} className="text-brand" /> : <IconHeart size={14} />}
              {interested.length > 0 ? `${interested.length} คนอยากไป` : 'กดว่าอยากไป'}
            </span>
          </button>
        ) : interested.length > 0 ? (
          <div className="flex items-center gap-2 mt-4">
            <AvatarStack people={interested} size={22} />
            <span className="text-[12px] text-ink-2">{interested.length} คนอยากไป</span>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 mt-5">
          {canEdit ? (
            <button onClick={onTogglePlan} className="h-10 rounded-md text-[13px] font-medium flex items-center justify-center gap-1.5 whitespace-nowrap px-2"
              style={place.in_plan
                ? { background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }
                : { background: 'var(--color-brand)', color: '#fff' }}>
              {place.in_plan ? <><IconCheck size={15} /> อยู่ในแพลนแล้ว</> : <><IconPlus size={15} /> เพิ่มในแพลน</>}
            </button>
          ) : onPin ? (
            <button onClick={onPin} className="h-10 rounded-md text-[13px] font-medium flex items-center justify-center gap-1.5 whitespace-nowrap px-2"
              style={{ background: 'var(--color-brand)', color: '#fff' }}>
              <IconStar size={15} /> เซฟไปทริปของฉัน
            </button>
          ) : <span />}
          <button onClick={() => openMap(place.map_url)} disabled={!place.map_url}
            className="h-10 rounded-md bg-surface flex items-center justify-center gap-1.5 text-[13px] text-ink-2 disabled:opacity-50 whitespace-nowrap px-2 hover:bg-surface-2"
            style={{ border: '0.5px solid var(--color-line)' }}>
            <IconMapPin size={15} /> เปิดแผนที่
          </button>
        </div>
      </div>
    </Drawer>
  )
}
