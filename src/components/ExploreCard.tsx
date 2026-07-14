import { useState } from 'react'
import { IconHeart, IconHeartFilled, IconMapPin, IconTrash, IconPencil, IconFlame, IconEye, IconThumbUp, IconMessageCircle, IconBuildingStore, IconZoomScan, IconHandStop } from '@tabler/icons-react'
import { PhotoCarousel } from './PhotoCarousel'
import { Lightbox, type PhotoRef } from './Lightbox'
import { StarRating } from './StarRating'
import { catMeta } from '@/lib/placeMeta'
import { modeMeta } from '@/lib/transitModes'
import { openMap } from '@/lib/maps'
import type { ExplorePlace } from '@/lib/database.types'
import type { VoteStat, PopStat } from '@/lib/exploreMutations'

export function ExploreCard({ e, isOwner, saved, stat, popular, pop, onFav, onDelete, onEdit, onOpen, onSuggest }: {
  e: ExplorePlace
  isOwner: boolean
  saved: boolean
  stat?: VoteStat
  popular?: boolean
  pop?: PopStat
  onFav: () => void
  onDelete: () => void
  onEdit: () => void
  onOpen: () => void
  /** non-owners: raise a hand to help edit / report (omitted for my own items) */
  onSuggest?: () => void
}) {
  // photo viewer — index into the gallery (cover + extra photos); null = closed
  const [lightbox, setLightbox] = useState<number | null>(null)
  const meta = catMeta(e.category)
  const Icon = meta.icon
  // unified gallery: cover photo first, then any extra photos — all swipeable
  const gallery: PhotoRef[] = [
    ...(e.photo_url ? [{ url: e.photo_url }] : []),
    ...(e.photos ?? []).map((ref) => ({ url: ref })),
  ]
  const routes = (e.routes && e.routes.length)
    ? e.routes
    : (e.station_line || e.station_name) ? [{ line: e.station_line, color: e.station_color, station: e.station_name }] : []

  return (
    <div className="card relative overflow-hidden">
      {/* whole card opens the detail view */}
      <div onClick={onOpen} role="button" tabIndex={0}
        onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && onOpen()}
        className="flex gap-3.5 p-3.5 items-center cursor-pointer">
        {/* image keeps a fixed 4:5 aspect ratio, vertically centered so a 2-line
            name on mobile doesn't push it off-balance */}
        <div className="w-32 sm:w-36 shrink-0 aspect-[4/5] rounded-[10px] overflow-hidden bg-surface-2 relative">
          {gallery.length > 0
            ? <PhotoCarousel photos={gallery} alt={e.name ?? ''} width={400} focus={e.photo_focus}
                onExpand={(i) => setLightbox(i)}
                fallback={<div className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><Icon size={40} stroke={1.4} style={{ color: meta.fg, opacity: 0.85 }} /></div>} />
            : <div className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><Icon size={40} stroke={1.4} style={{ color: meta.fg, opacity: 0.85 }} /></div>}
          {gallery.length > 0 && (
            <span className="absolute bottom-1.5 right-1.5 z-10 size-6 rounded-full bg-black/45 text-white grid place-items-center pointer-events-none"><IconZoomScan size={13} /></span>
          )}
          {popular && (
            <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full pl-1.5 pr-2 py-0.5 text-[10px] font-semibold text-white shadow-sm"
              style={{ background: 'linear-gradient(90deg,#FB7022,#EF4444)' }}>
              <IconFlame size={12} /> POPULAR
            </span>
          )}
        </div>

        {/* text in the middle — laid out top-to-bottom with stats pinned to the base */}
        <div className="flex-1 min-w-0 pr-9 flex flex-col">
          <div className="flex items-center gap-1.5 flex-wrap self-start">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: meta.bg, color: meta.fg }}>
              {meta.label}
            </span>
            {(e.multi_branch || !!e.branches?.length) && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)' }}>
                <IconBuildingStore size={12} /> หลายสาขา
              </span>
            )}
          </div>
          <div className="text-[15px] font-medium leading-snug line-clamp-2 mt-1.5">{e.name}</div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <StarRating rating={stat?.rating ?? 0} size={13} />
            {stat && stat.count > 0
              ? <span className="text-[11px] text-ink-3">{stat.rating.toFixed(1)} ({stat.count})</span>
              : <span className="text-[11px] text-ink-3">ยังไม่มีรีวิว</span>}
          </div>

          {routes.length > 0 && (
            <div className="flex flex-col gap-1 text-[12px] text-ink-3 mt-2">
              {routes.slice(0, 2).map((r, i) => {
                const MIcon = modeMeta('mode' in r ? r.mode : undefined).icon
                return (
                  <span key={i} className="flex items-center gap-1.5 min-w-0">
                    <span className="inline-flex items-center justify-center size-4 rounded-full shrink-0 text-white" style={{ background: r.color ?? '#888780' }}><MIcon size={10} /></span>
                    <span className="truncate">{[r.line, r.station].filter(Boolean).join(' · ') || modeMeta('mode' in r ? r.mode : undefined).label}</span>
                  </span>
                )
              })}
              {routes.length > 2 && <span className="text-[11px] text-ink-3 pl-4">+{routes.length - 2} เส้นทาง</span>}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap mt-2">
            {e.city && <span className="chip !py-0.5">{e.city}</span>}
            {e.map_url && (
              <button onClick={(ev) => { ev.stopPropagation(); openMap(e.map_url) }} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:text-brand-mid">
                <IconMapPin size={12} /> MAP
              </button>
            )}
          </div>

          {e.note && <p className="text-[12px] text-ink-2 mt-2 line-clamp-2">{e.note}</p>}

          {/* popularity stats — pinned to the bottom (kept clear of the corner buttons) */}
          <div className={['flex items-center gap-3.5 text-[11px] text-ink-3 mt-auto pt-3', isOwner ? 'pr-20' : onSuggest ? 'pr-11' : ''].join(' ')}>
            <span className="inline-flex items-center gap-1" title="ยอดคลิก"><IconEye size={13} /> {pop?.views ?? 0}</span>
            <span className="inline-flex items-center gap-1" title="ยอดเซฟ"><IconHeart size={13} /> {pop?.saves ?? 0}</span>
            <span className="inline-flex items-center gap-1" title="ยอดไลก์"><IconThumbUp size={13} /> {pop?.likes ?? 0}</span>
            <span className="inline-flex items-center gap-1" title="ยอดคอมเมนต์"><IconMessageCircle size={13} /> {pop?.comments ?? 0}</span>
          </div>
        </div>
      </div>

      {/* fav toggle — top-right corner */}
      <button onClick={(ev) => { ev.stopPropagation(); onFav() }} aria-label={saved ? 'เอาออกจากที่เซฟ' : 'เซฟเข้าทริปของฉัน'} title={saved ? 'เอาออกจากที่เซฟ' : 'เซฟเข้าทริปของฉัน'}
        className="absolute top-2.5 right-2.5 size-9 rounded-full grid place-items-center shadow-sm z-20"
        style={{ background: saved ? 'var(--color-brand)' : 'rgba(255,255,255,.95)', color: saved ? '#fff' : 'var(--color-brand)' }}>
        {saved ? <IconHeartFilled size={19} /> : <IconHeart size={19} />}
      </button>
      {isOwner ? (
        <div className="absolute bottom-2.5 right-2.5 flex gap-1.5 z-20">
          <button onClick={(ev) => { ev.stopPropagation(); onEdit() }} aria-label="แก้ไข"
            className="size-8 rounded-full grid place-items-center bg-surface-2 hover:bg-line text-ink-2">
            <IconPencil size={15} />
          </button>
          <button onClick={(ev) => { ev.stopPropagation(); onDelete() }} aria-label="ลบ"
            className="size-8 rounded-full grid place-items-center bg-surface-2 hover:bg-line" style={{ color: '#D85A30' }}>
            <IconTrash size={15} />
          </button>
        </div>
      ) : onSuggest && (
        <button onClick={(ev) => { ev.stopPropagation(); onSuggest() }} aria-label="ช่วยแก้ / รายงาน" title="ช่วยแก้ / รายงาน"
          className="absolute bottom-2.5 right-2.5 size-8 rounded-full grid place-items-center bg-surface-2 hover:bg-line text-ink-2 z-20">
          <IconHandStop size={15} />
        </button>
      )}
      {saved && <div className="absolute inset-0 rounded-[12px] pointer-events-none z-10" style={{ background: 'rgba(120,118,110,0.16)' }} />}
      {lightbox !== null && (
        <Lightbox photos={gallery} index={lightbox} alt={e.name ?? ''} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}
