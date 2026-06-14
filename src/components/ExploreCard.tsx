import { IconHeart, IconHeartFilled, IconMapPin, IconTrash } from '@tabler/icons-react'
import { SignedImage } from './SignedImage'
import { catMeta } from '@/lib/placeMeta'
import { openMap } from '@/lib/maps'
import type { ExplorePlace } from '@/lib/database.types'

export function ExploreCard({ e, isOwner, saved, onFav, onDelete }: {
  e: ExplorePlace
  isOwner: boolean
  saved: boolean
  onFav: () => void
  onDelete: () => void
}) {
  const meta = catMeta(e.category)
  const Icon = meta.icon

  return (
    <div className="card overflow-hidden relative">
      <div className="relative h-48 sm:h-56">
        <SignedImage url={e.photo_url} alt={e.name ?? ''} className="w-full h-full object-cover"
          fallback={<div className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><Icon size={44} stroke={1.4} style={{ color: meta.fg, opacity: 0.85 }} /></div>} />
        <button onClick={onFav} aria-label={saved ? 'เอาออกจากที่เซฟ' : 'เซฟเข้าทริปของฉัน'} title={saved ? 'เอาออกจากที่เซฟ' : 'เซฟเข้าทริปของฉัน'}
          className="absolute top-2.5 right-2.5 size-9 rounded-full grid place-items-center shadow-sm z-20"
          style={{ background: saved ? 'var(--color-brand)' : 'rgba(255,255,255,.95)', color: saved ? '#fff' : 'var(--color-brand)' }}>
          {saved ? <IconHeartFilled size={19} /> : <IconHeart size={19} />}
        </button>
        {isOwner && (
          <button onClick={onDelete} aria-label="ลบ" className="absolute top-2.5 left-2.5 size-8 rounded-full grid place-items-center shadow-sm z-20"
            style={{ background: 'rgba(255,255,255,.92)', color: '#D85A30' }}>
            <IconTrash size={15} />
          </button>
        )}
        <span className="absolute bottom-2.5 left-2.5 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: '#fff', color: meta.fg }}>
          {meta.label}
        </span>
      </div>
      <div className="p-3.5">
        <div className="text-[15px] font-medium leading-snug">{e.name}</div>
        <div className="flex items-center gap-1.5 text-[12px] text-ink-3 mt-1">
          {(e.station_line || e.station_color || e.station_name) && (
            <>
              <span className="size-2.5 rounded-full shrink-0" style={{ background: e.station_color ?? '#888780' }} />
              <span className="truncate">{[e.station_line, e.station_name].filter(Boolean).join(' · ') || 'สถานี'}</span>
            </>
          )}
          {e.city && <span className="chip !py-0.5">{e.city}</span>}
        </div>
        {e.note && <p className="text-[12px] text-ink-2 mt-1.5 line-clamp-2">{e.note}</p>}
        {e.map_url && (
          <button onClick={() => openMap(e.map_url)} className="inline-flex items-center gap-1 text-[11px] text-ink-3 hover:text-brand-mid mt-2">
            <IconMapPin size={12} /> MAP
          </button>
        )}
      </div>
      {saved && <div className="absolute inset-0 rounded-[12px] pointer-events-none z-10" style={{ background: 'rgba(120,118,110,0.16)' }} />}
    </div>
  )
}
