import { IconCheck, IconPlus, IconMapPin, IconPencil, IconTrash, IconHeart, IconHeartFilled, IconStar } from '@tabler/icons-react'
import { AvatarStack } from './Avatar'
import { PopMenu } from './PopMenu'
import { SignedImage } from './SignedImage'
import { catMeta } from '@/lib/placeMeta'
import { openMap } from '@/lib/maps'
import type { Place } from '@/lib/database.types'

export interface Interested { name: string; color?: string }

export type CardMode = 'edit' | 'pin' | 'view'

export function PlaceCard({
  place, interested, mine, mode = 'edit', onOpen, onTogglePlan, onToggleInterest, onEdit, onDelete, onPin,
}: {
  place: Place
  interested: Interested[]
  mine: boolean
  mode?: CardMode
  onOpen: () => void
  onTogglePlan: () => void
  onToggleInterest: () => void
  onEdit: () => void
  onDelete: () => void
  onPin?: () => void
}) {
  const meta = catMeta(place.category)
  const Icon = meta.icon
  const placeholder = (
    <div className="w-full h-full grid place-items-center" style={{ background: meta.bg }}>
      <Icon size={32} stroke={1.4} style={{ color: meta.fg, opacity: 0.85 }} />
    </div>
  )
  const dimmed = mode === 'edit' && place.in_plan

  return (
    <div className="card overflow-hidden flex flex-col relative">
      {/* Header image */}
      <div className="relative h-36">
        {place.photo_url || place.photo_path
          ? <SignedImage url={place.photo_url} path={place.photo_path} alt={place.name ?? ''} className="w-full h-full object-cover" width={500} fallback={placeholder} />
          : placeholder}

        {mode === 'edit' && (
          <button onClick={onTogglePlan} aria-label="เพิ่มในแพลน"
            className="absolute top-2 right-2 h-7 px-2.5 rounded-full inline-flex items-center gap-1 shadow-sm transition-colors text-[11px] font-medium z-20"
            style={place.in_plan
              ? { background: 'var(--color-brand)', color: '#fff' }
              : { background: 'rgba(255,255,255,.92)', color: 'var(--color-ink-2)', border: '0.5px solid var(--color-line)' }}>
            {place.in_plan ? <><IconCheck size={14} /> ในแพลน</> : <><IconPlus size={14} /> เพิ่ม</>}
          </button>
        )}
        {mode === 'pin' && (
          <button onClick={onPin} aria-label="พิน/เซฟไปทริปของฉัน" title="เซฟไปทริปของฉัน"
            className="absolute top-2 right-2 size-8 rounded-full grid place-items-center shadow-sm z-20"
            style={{ background: 'rgba(255,255,255,.94)', color: 'var(--color-brand)', border: '0.5px solid var(--color-line)' }}>
            <IconStar size={17} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-3.5 flex-1 flex flex-col">
        <div className="flex items-center gap-1.5 text-[11px] text-ink-3">
          <span className="size-2 rounded-full shrink-0" style={{ background: place.station_color ?? '#888780' }} />
          <span className="truncate flex-1">{place.station_line}{place.station_name ? ` · ${place.station_name}` : ''}</span>
          {mode === 'edit' && (
            <PopMenu size={24} items={[
              { label: 'แก้ไข', icon: <IconPencil size={15} />, onClick: onEdit },
              { label: 'ลบ', icon: <IconTrash size={15} />, onClick: onDelete, danger: true },
            ]} />
          )}
        </div>
        <button onClick={onOpen} className="text-[14px] font-medium text-left leading-snug mt-1 hover:text-brand-mid">
          {place.name}
        </button>
        {place.note && <p className="text-[12px] text-ink-2 mt-1 line-clamp-2">{place.note}</p>}

        {mode === 'edit' ? (
          <button onClick={onToggleInterest} className="flex items-center gap-2 mt-2.5">
            {interested.length > 0 && <AvatarStack people={interested} size={20} />}
            <span className="flex items-center gap-1 text-[11px] text-ink-3">
              {mine ? <IconHeartFilled size={12} className="text-brand" /> : <IconHeart size={12} />}
              {interested.length > 0 ? `${interested.length} คนอยากไป` : 'อยากไป'}
            </span>
          </button>
        ) : interested.length > 0 ? (
          <div className="flex items-center gap-2 mt-2.5">
            <AvatarStack people={interested} size={20} />
            <span className="text-[11px] text-ink-3">{interested.length} คนอยากไป</span>
          </div>
        ) : null}

        <div className="flex items-center justify-between mt-3 pt-3 gap-2" style={{ borderTop: '0.5px solid var(--color-line)' }}>
          <button onClick={() => openMap(place.map_url)} disabled={!place.map_url}
            className="inline-flex items-center gap-1 text-[11px] text-ink-3 enabled:hover:text-brand-mid whitespace-nowrap shrink-0">
            <IconMapPin size={12} /> MAP
          </button>
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap shrink-0" style={{ background: meta.bg, color: meta.fg }}>
            {meta.label}
          </span>
        </div>
      </div>

      {dimmed && <div className="absolute inset-0 rounded-[12px] pointer-events-none" style={{ background: 'rgba(120,118,110,0.16)' }} />}
    </div>
  )
}
