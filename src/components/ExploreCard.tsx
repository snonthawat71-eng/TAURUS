import { useState } from 'react'
import { IconHeart, IconHeartFilled, IconMapPin, IconTrash, IconPencil, IconFlame, IconEye, IconMessageCircle, IconBuildingStore, IconZoomScan, IconMessageReport, IconStarFilled } from '@tabler/icons-react'
import { PhotoCarousel } from './PhotoCarousel'
import { Lightbox, type PhotoRef } from './Lightbox'
import { catMeta } from '@/lib/placeMeta'
import { modeMeta } from '@/lib/transitModes'
import { stationCode, lineColorFor } from '@/lib/metro/suggest'
import { openMap } from '@/lib/maps'
import type { ExplorePlace } from '@/lib/database.types'
import type { PopStat } from '@/lib/exploreMutations'

export function ExploreCard({ e, isOwner, saved, popular, pop, rating, onFav, onDelete, onEdit, onOpen, onSuggest }: {
  e: ExplorePlace
  isOwner: boolean
  saved: boolean
  popular?: boolean
  pop?: PopStat
  /** real star average from explore_ratings (undefined = nobody rated yet) */
  rating?: { avg: number; count: number }
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
        className="flex gap-3.5 p-3.5 items-stretch cursor-pointer">
        {/* image keeps a fixed 4:5 aspect ratio, top-aligned; the text column
            stretches to its height so the stats row can pin to the photo's base */}
        <div className="w-32 sm:w-36 shrink-0 self-start aspect-[4/5] rounded-[10px] overflow-hidden bg-surface-2 relative">
          {gallery.length > 0
            ? <PhotoCarousel photos={gallery} alt={e.name ?? ''} width={400} focus={e.photo_focus}
                onExpand={(i) => setLightbox(i)}
                fallback={<div className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><Icon size={40} stroke={1.4} style={{ color: meta.fg, opacity: 0.85 }} /></div>} />
            : <div className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><Icon size={40} stroke={1.4} style={{ color: meta.fg, opacity: 0.85 }} /></div>}
          {gallery.length > 0 && (
            <span className="absolute bottom-1.5 right-1.5 z-10 size-6 rounded-full bg-black/45 text-white grid place-items-center pointer-events-none"><IconZoomScan size={13} /></span>
          )}
          {/* REAL star average (explore_ratings), overlaid on the photo so it
              costs the text column no height. Absent — not "ยังไม่มีคะแนน" —
              until somebody actually rates, or every card would carry an empty
              row. Never a score derived from like counts. */}
          {!!rating?.count && (
            <span className="absolute bottom-1.5 left-1.5 z-10 inline-flex items-center gap-0.5 rounded-full pl-1 pr-1.5 h-[19px] text-[11px] font-bold text-white pointer-events-none"
              title={`${rating.avg.toFixed(1)} จาก 5 · ${rating.count} คน`}
              style={{ background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
              <IconStarFilled size={11} style={{ color: '#F5A623' }} />
              <span className="tabular-nums">{rating.avg.toFixed(1)}</span>
            </span>
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
          {/* city + open-in-maps link (moved up to replace the old rating row) */}
          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            {e.city && <span className="chip !py-0.5">{e.city}</span>}
            {e.map_url && (
              <button onClick={(ev) => { ev.stopPropagation(); openMap(e.map_url) }} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:text-brand-mid">
                <IconMapPin size={12} /> MAP
              </button>
            )}
          </div>

          {/* line-coloured station roundels (B1) + the primary station name and
              line name. Extra lines trail as more roundels — code+colour identify
              each, so their long names never fight for width on the card. */}
          {routes.length > 0 && (() => {
            const roundel = (r: (typeof routes)[number], i: number) => {
              const m = modeMeta('mode' in r ? r.mode : undefined)
              const MIcon = m.icon
              const code = stationCode(r.line, r.station)
              const mm = code?.match(/^([A-Za-z]+)\s*(\d.*)$/)
              return (
                <span key={i} title={[r.line, r.station].filter(Boolean).join(' · ') || m.label}
                  className="w-[30px] h-[30px] rounded-full grid place-items-center shrink-0 text-white leading-none" style={{ background: lineColorFor(r.line) ?? r.color ?? '#888780' }}>
                  {code
                    ? (mm
                        ? <span className="flex flex-col items-center leading-[1.0]"><span className="text-[9px] font-extrabold tracking-tight">{mm[1]}</span><span className="text-[12.5px] font-extrabold tracking-tight">{mm[2]}</span></span>
                        : <span className="text-[10px] font-extrabold">{code}</span>)
                    : <MIcon size={15} />}
                </span>
              )
            }
            const cleanStation = (r: (typeof routes)[number]) => {
              const code = stationCode(r.line, r.station)
              const raw = (r.station ?? '').trim()
              return code && raw.toUpperCase().startsWith(code.toUpperCase())
                ? raw.slice(code.length).replace(/^[\s·.-]+/, '')
                : raw
            }
            const r0 = routes[0]
            const m0 = modeMeta('mode' in r0 ? r0.mode : undefined)
            // single line: roundel + station name, line name small & grey beside
            if (routes.length === 1) {
              return (
                <div className="flex items-center gap-2 mt-2 min-w-0">
                  {roundel(r0, 0)}
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="text-[12.5px] font-medium text-ink-2 truncate">{cleanStation(r0) || m0.label}</div>
                    {r0.line && <div className="text-[10.5px] text-ink-3 truncate">{r0.line}</div>}
                  </div>
                </div>
              )
            }
            // multiple lines: all roundels together in a row + the station name
            // trailing; the line names then list in order underneath
            return (
              <div className="mt-2 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  {routes.map((r, i) => roundel(r, i))}
                  {cleanStation(r0) && <span className="text-[12.5px] font-medium text-ink-2 truncate ml-1">{cleanStation(r0)}</span>}
                </div>
                <div className="mt-1.5 flex flex-col gap-px">
                  {routes.map((r, i) => (
                    <span key={i} className="text-[10.5px] text-ink-3 truncate">{r.line || modeMeta('mode' in r ? r.mode : undefined).label}</span>
                  ))}
                </div>
              </div>
            )
          })()}

          {e.note && <p className="text-[12px] text-ink-2 mt-2 line-clamp-2">{e.note}</p>}

          {/* popularity stats — pinned to the bottom (kept clear of the corner buttons) */}
          <div className={['flex items-center gap-3.5 text-[11px] text-ink-3 mt-auto pt-3', isOwner ? 'pr-20' : onSuggest ? 'pr-11' : ''].join(' ')}>
            <span className="inline-flex items-center gap-1" title="ยอดคลิก"><IconEye size={13} /> {pop?.views ?? 0}</span>
            <span className="inline-flex items-center gap-1" title="ยอดเซฟ"><IconHeart size={13} /> {pop?.saves ?? 0}</span>
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
          <IconMessageReport size={15} />
        </button>
      )}
      {saved && <div className="absolute inset-0 rounded-[12px] pointer-events-none z-10" style={{ background: 'rgba(120,118,110,0.16)' }} />}
      {lightbox !== null && (
        <Lightbox photos={gallery} index={lightbox} alt={e.name ?? ''} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}
