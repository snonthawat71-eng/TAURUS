import { IconHeart, IconHeartFilled, IconMapPin, IconTrash, IconPencil, IconFlame } from '@tabler/icons-react'
import { SignedImage } from './SignedImage'
import { StarRating } from './StarRating'
import { catMeta } from '@/lib/placeMeta'
import { openMap } from '@/lib/maps'
import type { ExplorePlace } from '@/lib/database.types'
import type { VoteStat } from '@/lib/exploreMutations'

export function ExploreCard({ e, isOwner, saved, stat, popular, onFav, onDelete, onEdit, onOpen }: {
  e: ExplorePlace
  isOwner: boolean
  saved: boolean
  stat?: VoteStat
  popular?: boolean
  onFav: () => void
  onDelete: () => void
  onEdit: () => void
  onOpen: () => void
}) {
  const meta = catMeta(e.category)
  const Icon = meta.icon
  const routes = (e.routes && e.routes.length)
    ? e.routes
    : (e.station_line || e.station_name) ? [{ line: e.station_line, color: e.station_color, station: e.station_name }] : []

  return (
    <div className="card relative overflow-hidden">
      {/* whole card opens the detail view */}
      <div onClick={onOpen} role="button" tabIndex={0}
        onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && onOpen()}
        className="flex gap-3.5 p-3 cursor-pointer">
        {/* image on the left (separated, rounded) */}
        <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-[10px] overflow-hidden shrink-0 bg-surface-2 relative">
          <SignedImage url={e.photo_url} alt={e.name ?? ''} className="w-full h-full object-cover"
            fallback={<div className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><Icon size={40} stroke={1.4} style={{ color: meta.fg, opacity: 0.85 }} /></div>} />
          {popular && (
            <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full pl-1.5 pr-2 py-0.5 text-[10px] font-semibold text-white shadow-sm"
              style={{ background: 'linear-gradient(90deg,#FB7022,#EF4444)' }}>
              <IconFlame size={12} /> POPULAR
            </span>
          )}
        </div>

        {/* text on the right */}
        <div className="flex-1 min-w-0 pr-9">
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: meta.bg, color: meta.fg }}>
            {meta.label}
          </span>
          <div className="text-[15px] font-medium leading-snug line-clamp-2 mt-1.5">{e.name}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <StarRating rating={stat?.rating ?? 0} size={13} />
            {stat && stat.count > 0
              ? <span className="text-[11px] text-ink-3">{stat.rating.toFixed(1)} ({stat.count})</span>
              : <span className="text-[11px] text-ink-3">ยังไม่มีรีวิว</span>}
          </div>
          <div className="flex flex-col gap-0.5 text-[12px] text-ink-3 mt-1.5">
            {routes.map((r, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 min-w-0">
                <span className="size-2.5 rounded-full shrink-0" style={{ background: r.color ?? '#888780' }} />
                <span className="truncate">{[r.line, r.station].filter(Boolean).join(' · ') || 'สถานี'}</span>
              </span>
            ))}
            {e.city && <span className="chip !py-0.5 self-start mt-0.5">{e.city}</span>}
          </div>
          {e.note && <p className="text-[12px] text-ink-2 mt-1.5 line-clamp-2">{e.note}</p>}
          {e.map_url && (
            <button onClick={(ev) => { ev.stopPropagation(); openMap(e.map_url) }} className="inline-flex items-center gap-1 text-[11px] text-ink-3 hover:text-brand-mid mt-2">
              <IconMapPin size={12} /> MAP
            </button>
          )}
        </div>
      </div>

      {/* fav toggle — on the text side, never over the image */}
      <button onClick={(ev) => { ev.stopPropagation(); onFav() }} aria-label={saved ? 'เอาออกจากที่เซฟ' : 'เซฟเข้าทริปของฉัน'} title={saved ? 'เอาออกจากที่เซฟ' : 'เซฟเข้าทริปของฉัน'}
        className="absolute top-2.5 right-2.5 size-9 rounded-full grid place-items-center shadow-sm z-20"
        style={{ background: saved ? 'var(--color-brand)' : 'rgba(255,255,255,.95)', color: saved ? '#fff' : 'var(--color-brand)' }}>
        {saved ? <IconHeartFilled size={19} /> : <IconHeart size={19} />}
      </button>
      {isOwner && (
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
      )}
      {saved && <div className="absolute inset-0 rounded-[12px] pointer-events-none z-10" style={{ background: 'rgba(120,118,110,0.16)' }} />}
    </div>
  )
}
