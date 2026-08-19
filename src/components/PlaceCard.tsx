import { useState } from 'react'
import { IconCheck, IconPlus, IconMapPin, IconPencil, IconTrash, IconHeart, IconHeartFilled, IconStar, IconBuildingStore, IconZoomScan, IconWorldShare } from '@tabler/icons-react'
import { AvatarStack } from './Avatar'
import { PopMenu } from './PopMenu'
import { PhotoCarousel } from './PhotoCarousel'
import { Lightbox, type PhotoRef } from './Lightbox'
import { catMeta } from '@/lib/placeMeta'
import { openMap } from '@/lib/maps'
import { planMapUrl } from '@/lib/branches'
import { stationCode, lineColorFor } from '@/lib/metro/suggest'
import type { Place } from '@/lib/database.types'

export interface Interested { name: string; color?: string }

export type CardMode = 'edit' | 'pin' | 'view'

export function PlaceCard({
  place, interested, mine, mode = 'edit', onOpen, onAddToDay, onToggleInterest, onEdit, onDelete, onPin, onShare,
}: {
  place: Place
  interested: Interested[]
  mine: boolean
  mode?: CardMode
  onOpen: () => void
  onAddToDay: () => void
  onToggleInterest: () => void
  onEdit: () => void
  onDelete: () => void
  onPin?: () => void
  onShare?: () => void
}) {
  // photo viewer — index into the gallery (cover + extra photos); null = closed
  const [lightbox, setLightbox] = useState<number | null>(null)
  const hasPhoto = !!(place.photo_url || place.photo_path)
  // unified gallery: cover photo first, then any extra photos — all swipeable
  const gallery: PhotoRef[] = [
    ...(hasPhoto ? [{ url: place.photo_url, path: place.photo_path }] : []),
    ...(place.photos ?? []).map((ref) => (ref.startsWith('http') ? { url: ref } : { path: ref })),
  ]
  const meta = catMeta(place.category)
  const Icon = meta.icon
  const placeholder = (
    <div className="w-full h-full grid place-items-center" style={{ background: meta.bg }}>
      <Icon size={32} stroke={1.4} style={{ color: meta.fg, opacity: 0.85 }} />
    </div>
  )
  const dimmed = mode === 'edit' && place.in_plan
  const multiBranch = !!place.multi_branch || !!place.branches?.length

  return (
    <div className="card overflow-hidden flex flex-col relative">
      {/* Header image */}
      <div className="relative h-36">
        {gallery.length > 0
          ? <PhotoCarousel photos={gallery} alt={place.name ?? ''} width={500} focus={place.photo_focus} fallback={placeholder} onExpand={(i) => setLightbox(i)} />
          : placeholder}

        {gallery.length > 0 && (
          <span className="absolute bottom-2 left-2 z-10 size-6 rounded-full bg-black/45 text-white grid place-items-center pointer-events-none"><IconZoomScan size={13} /></span>
        )}

        {multiBranch && (
          <span className="absolute top-2 left-2 z-20 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm"
            style={{ background: 'rgba(255,255,255,.92)', color: 'var(--color-ink-2)', border: '0.5px solid var(--color-line)' }}>
            <IconBuildingStore size={12} /> หลายสาขา
          </span>
        )}

        {/* "ในแพลน" is a status now, not a switch — a place is in the plan
            because it sits on a day in the itinerary. So it reads as a badge,
            and the only action offered is putting it on a day. */}
        {mode === 'edit' && (place.in_plan ? (
          <span className="absolute top-2 right-2 h-7 px-2.5 rounded-full inline-flex items-center gap-1 shadow-sm text-[11px] font-medium z-20 pointer-events-none"
            style={{ background: 'var(--color-brand)', color: '#fff' }}>
            <IconCheck size={14} /> ในแพลน
          </span>
        ) : (
          <button onClick={onAddToDay} aria-label="ใส่ลงวัน"
            className="absolute top-2 right-2 h-7 px-2.5 rounded-full inline-flex items-center gap-1 shadow-sm transition-colors text-[11px] font-medium z-20"
            style={{ background: 'rgba(255,255,255,.92)', color: 'var(--color-ink-2)', border: '0.5px solid var(--color-line)' }}>
            <IconPlus size={14} /> ใส่ลงวัน
          </button>
        ))}
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
          <span className="size-2 rounded-full shrink-0" style={{ background: lineColorFor(place.station_line, place.city) ?? place.station_color ?? '#888780' }} />
          {(() => {
            const code = stationCode(place.station_line, place.station_name)
            const station = place.station_name ? `${code ? `${code} ` : ''}${place.station_name}` : ''
            return <span className="truncate flex-1">{place.station_line}{station ? ` · ${station}` : ''}</span>
          })()}
          {mode === 'edit' && (
            <PopMenu size={24} items={[
              { label: 'แก้ไข', icon: <IconPencil size={15} />, onClick: onEdit },
              ...(onShare ? [{ label: 'แชร์ไป Explore', icon: <IconWorldShare size={15} />, onClick: onShare }] : []),
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
          <button onClick={() => openMap(planMapUrl(place))} disabled={!planMapUrl(place)}
            className="inline-flex items-center gap-1 text-[11px] text-ink-3 enabled:hover:text-brand-mid whitespace-nowrap shrink-0">
            <IconMapPin size={12} /> MAP
          </button>
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap shrink-0" style={{ background: meta.bg, color: meta.fg }}>
            {meta.label}
          </span>
        </div>
      </div>

      {dimmed && <div className="absolute inset-0 rounded-[12px] pointer-events-none" style={{ background: 'rgba(120,118,110,0.16)' }} />}
      {lightbox !== null && (
        <Lightbox photos={gallery} index={lightbox} alt={place.name ?? ''} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}
