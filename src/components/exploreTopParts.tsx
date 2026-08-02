import type { ReactNode } from 'react'
import { IconArrowLeft, IconStarFilled, IconHeart, IconHeartFilled } from '@tabler/icons-react'
import { SignedImage } from './SignedImage'
import { catMeta } from '@/lib/placeMeta'
import { TOP_LABEL, type RatingStat } from '@/lib/exploreTop'
import type { ExplorePlace } from '@/lib/database.types'

/** The photo's dissolve into the page.
 *
 *  Two things make it read as one surface rather than a photo with a lid on it:
 *  the fade runs most of the photo's height, and the alpha is eased across many
 *  stops. A short two-stop gradient banded and ended on a visible line.
 *  color-mix keeps it right in dark mode, where the canvas colour differs. */
const FADE = `linear-gradient(to bottom,
  color-mix(in srgb, var(--color-canvas) 0%, transparent) 0%,
  color-mix(in srgb, var(--color-canvas) 3%, transparent) 12%,
  color-mix(in srgb, var(--color-canvas) 9%, transparent) 24%,
  color-mix(in srgb, var(--color-canvas) 18%, transparent) 36%,
  color-mix(in srgb, var(--color-canvas) 31%, transparent) 47%,
  color-mix(in srgb, var(--color-canvas) 46%, transparent) 58%,
  color-mix(in srgb, var(--color-canvas) 62%, transparent) 68%,
  color-mix(in srgb, var(--color-canvas) 77%, transparent) 78%,
  color-mix(in srgb, var(--color-canvas) 89%, transparent) 87%,
  color-mix(in srgb, var(--color-canvas) 96%, transparent) 94%,
  var(--color-canvas) 100%)`

/** how tall the photo is, and therefore where the page's own content may start */
export const HERO_H = 340

/**
 * The country photo as a full-bleed backdrop the heading sits ON, dissolving
 * into the page — rather than a band with an edge above it, which is what made
 * the seam obvious. `bottom` is pinned to the photo's lower edge, so whatever
 * follows always starts where the photo has faded out.
 */
export function TopHero({ photo, eyebrow, title, onBack, right, bottom }: {
  photo: string | null
  eyebrow: ReactNode
  title: string
  onBack: () => void
  right?: ReactNode
  bottom?: ReactNode
}) {
  return (
    <>
      <div className="absolute inset-x-0 top-0 overflow-hidden pointer-events-none"
        style={{ height: HERO_H, background: 'linear-gradient(140deg,#8fa8c9,#2f4a72)' }}>
        {photo && <SignedImage url={photo} alt="" className="w-full h-full object-cover" width={900} />}
        <div className="absolute inset-x-0 bottom-0 h-[250px]" style={{ background: FADE }} />
      </div>

      <div className="flex flex-col justify-between" style={{ minHeight: HERO_H }}>
        <div className="px-4 sm:px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)' }}>
          <div className="flex items-center">
            <button onClick={onBack} aria-label="ย้อนกลับ"
              className="size-9 rounded-full grid place-items-center text-white"
              style={{ background: 'rgba(0,0,0,.28)', backdropFilter: 'blur(8px)' }}>
              <IconArrowLeft size={18} />
            </button>
            {right && <div className="ml-auto">{right}</div>}
          </div>

          <div className="pt-5">
            <div className="text-[10px] font-bold uppercase text-white/85"
              style={{ letterSpacing: '.16em', textShadow: '0 1px 10px rgba(0,0,0,.45)' }}>
              {eyebrow}
            </div>
            <h1 className="text-[19px] font-extrabold leading-[1.2] mt-1.5 text-white"
              style={{ letterSpacing: '-.3px', textShadow: '0 2px 16px rgba(0,0,0,.4)' }}>
              {title}
            </h1>
          </div>
        </div>

        {bottom}
      </div>
    </>
  )
}

/** Heading for the shortlist pages — the label, then the country. */
export const topTitle = (country: string) => `${TOP_LABEL}${country ? ` ${country}` : ''}`

/** A rank-numbered tile in the two-column grid. */
export function PlaceTile({ place: p, rating, rank, saved, onOpen, onSave }: {
  place: ExplorePlace
  rating: RatingStat | null
  /** omit on lists that aren't ranked (newest, a city's places) */
  rank?: number
  saved: boolean
  onOpen: () => void
  onSave: () => void
}) {
  const meta = catMeta(p.category)
  const Icon = meta.icon
  const where = p.routes?.[0]?.station ?? p.station_name ?? p.city
  // top three wear gold; the rest a plain white disc
  const podium = rank != null && rank <= 3

  return (
    <div onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen() }}
      className="relative h-[186px] rounded-[15px] overflow-hidden cursor-pointer bg-surface-2"
      style={{ boxShadow: '0 3px 12px rgba(10,40,90,.1)' }}>
      {p.photo_url
        ? <SignedImage url={p.photo_url} alt="" className="w-full h-full object-cover" width={420} />
        : <span className="w-full h-full grid place-items-center" style={{ background: meta.bg }}>
            <Icon size={34} stroke={1.3} style={{ color: meta.fg, opacity: .85 }} />
          </span>}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(transparent 40%,rgba(4,18,38,.85))' }} />

      {rank != null && (
        <span className="absolute left-2 top-2 size-[25px] rounded-full grid place-items-center text-[12px] font-extrabold"
          style={podium
            ? { background: 'linear-gradient(135deg,#FFC93C,#E8A21B)', color: '#fff' }
            : { background: 'rgba(255,255,255,.94)', color: 'var(--color-ink)' }}>
          {rank}
        </span>
      )}

      <button onClick={(ev) => { ev.stopPropagation(); onSave() }}
        aria-label={saved ? 'จัดการที่เซฟไว้' : 'เซฟเข้าทริป'}
        className="absolute right-2 top-2 size-[30px] rounded-full grid place-items-center bg-white/[.92]"
        style={{ color: saved ? 'var(--color-brand)' : 'var(--color-ink-3)' }}>
        {saved ? <IconHeartFilled size={15} /> : <IconHeart size={15} />}
      </button>

      <div className="absolute inset-x-0 bottom-0 p-2.5 pointer-events-none">
        <div className="text-white text-[13px] font-extrabold leading-[1.2] line-clamp-2">{p.name}</div>
        <div className="text-white/[.85] text-[10.5px] mt-0.5 flex items-center gap-1 truncate">
          {!!rating?.count && (
            <>
              <IconStarFilled size={9} />
              <span className="tabular-nums">{rating.avg.toFixed(1)}</span>
              <span>·</span>
            </>
          )}
          <span className="truncate">{where}</span>
        </div>
      </div>
    </div>
  )
}

/** A card in a horizontal rail on the country home: photo, name, one grey line. */
export function RailCard({ place: p, rating, sub, onOpen }: {
  place: ExplorePlace
  rating: RatingStat | null
  sub: string | null | undefined
  onOpen: () => void
}) {
  const meta = catMeta(p.category)
  const Icon = meta.icon
  return (
    <button onClick={onOpen} className="shrink-0 w-[150px] text-left">
      <div className="relative h-[112px] rounded-[12px] overflow-hidden bg-surface-2"
        style={{ boxShadow: '0 2px 10px rgba(10,40,90,.09)' }}>
        {p.photo_url
          ? <SignedImage url={p.photo_url} alt="" className="w-full h-full object-cover" width={340} />
          : <span className="w-full h-full grid place-items-center" style={{ background: meta.bg }}>
              <Icon size={26} stroke={1.3} style={{ color: meta.fg, opacity: .85 }} />
            </span>}
        {!!rating?.count && (
          <span className="absolute left-1.5 bottom-1.5 inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10.5px] font-bold text-white"
            style={{ background: 'rgba(4,18,38,.62)', backdropFilter: 'blur(4px)' }}>
            <IconStarFilled size={9} /> <span className="tabular-nums">{rating.avg.toFixed(1)}</span>
          </span>
        )}
      </div>
      <div className="text-[13px] font-extrabold leading-[1.25] mt-1.5 line-clamp-2">{p.name}</div>
      {sub && <div className="text-[11.5px] text-ink-3 truncate mt-0.5">{sub}</div>}
    </button>
  )
}
