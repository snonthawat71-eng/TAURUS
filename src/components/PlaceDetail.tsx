import { useEffect, useState } from 'react'
import { IconCheck, IconPlus, IconMapPin, IconPencil, IconHeart, IconHeartFilled, IconStar, IconToolsKitchen2, IconFileTypePdf, IconBuildingStore, IconZoomScan, IconPhoto, IconWorldShare, IconShare2 } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { AvatarStack } from './Avatar'
import { SignedImage } from './SignedImage'
import { PhotoCarousel } from './PhotoCarousel'
import { Lightbox, type PhotoRef } from './Lightbox'
import { BranchPicker } from './BranchPicker'
import { catMeta } from '@/lib/placeMeta'
import { openMap } from '@/lib/maps'
import { sharePlace } from '@/lib/share'
import { buildShareCard } from '@/lib/shareCard'
import { getSignedUrl } from '@/lib/files'
import { stationCode, lineColorFor } from '@/lib/metro/suggest'

const isPdfRef = (ref: string) => /\.pdf($|\?)/i.test(ref)
/** Open a stored menu file (Cloudinary URL as-is, private path via signed URL). */
async function openFileRef(ref: string) {
  if (/^https?:\/\//.test(ref)) { window.open(ref, '_blank'); return }
  const url = await getSignedUrl(ref)
  if (url) window.open(url, '_blank')
}
import type { Interested } from './PlaceCard'
import type { Place } from '@/lib/database.types'

export function PlaceDetail({
  place, interested, mine, open, canEdit = true, onClose, onAddToDay, onToggleInterest, onEdit, onPin, onShare,
}: {
  place: Place | null
  interested: Interested[]
  mine: boolean
  open: boolean
  canEdit?: boolean
  onClose: () => void
  onAddToDay: () => void
  onToggleInterest: () => void
  onEdit?: () => void
  onPin?: () => void
  onShare?: () => void
}) {
  // which branch (chain location) is selected; null = the place's own location
  const [branchIdx, setBranchIdx] = useState<number | null>(null)
  // full-size photo viewer — index into the extra-photos gallery (null = closed)
  const [lightbox, setLightbox] = useState<number | null>(null)
  // drawn while the drawer is open, so the tap itself can open the share sheet
  const [card, setCard] = useState<File | null>(null)
  const hasOwnLocation = !!(place && (place.map_url || place.station_name || place.station_line))
  useEffect(() => {
    // planned place: default to the branch that was picked for the plan;
    // otherwise first branch only when the place has no location of its own
    if (place?.in_plan && place.plan_branch != null && place.branches?.[place.plan_branch]) {
      setBranchIdx(place.plan_branch)
      return
    }
    setBranchIdx(place?.branches?.length && !hasOwnLocation ? 0 : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.id, hasOwnLocation, place?.branches?.length, place?.plan_branch, place?.in_plan])

  useEffect(() => {
    setCard(null)
    if (!open || !place) return
    let off = false
    const m = catMeta(place.category)
    ;(async () => {
      // the cover may live in the private bucket — sign it so the card can draw it
      const photoUrl = place.photo_url ?? (place.photo_path ? await getSignedUrl(place.photo_path) : null)
      const f = await buildShareCard({
        name: place.name, city: place.city, photoUrl,
        category: { label: m.label, bg: m.bg, fg: m.fg },
      })
      if (!off) setCard(f)
    })()
    return () => { off = true }
  }, [open, place?.id, place?.photo_url, place?.photo_path, place?.category, place?.city, place?.name])

  if (!place) return null
  const meta = catMeta(place.category)
  const Icon = meta.icon
  const hasPhoto = !!(place.photo_url || place.photo_path)
  // unified gallery: cover photo first, then the extra photos — all swipeable
  const gallery: PhotoRef[] = [
    ...(hasPhoto ? [{ url: place.photo_url, path: place.photo_path }] : []),
    ...(place.photos ?? []).map((ref) => (ref.startsWith('http') ? { url: ref } : { path: ref })),
  ]
  const extraBase = hasPhoto ? 1 : 0
  const branches = place.branches ?? []
  const sel = branchIdx != null ? branches[branchIdx] : null
  const lineColor = lineColorFor(sel ? sel.line : place.station_line) ?? (sel ? sel.color : place.station_color)
  const lineText = sel ? sel.line : place.station_line
  const stationText = sel ? sel.station : place.station_name
  const mapUrl = sel?.map_url || place.map_url

  async function shareThis() {
    if (!place) return
    await sharePlace({
      name: place.name, city: place.city,
      category: { label: meta.label, bg: meta.bg, fg: meta.fg },
      card, mapUrl,
      appUrl: place.source_explore_id ? `${window.location.origin}/explore/p/${place.source_explore_id}` : null,
    })
  }

  return (
    <Drawer open={open} onClose={onClose} title="รายละเอียด">
      <div className="h-40 rounded-[14px] relative grid place-items-center overflow-hidden mt-1" style={{ background: meta.bg }}>
        {gallery.length > 0
          ? <PhotoCarousel photos={gallery} alt={place.name ?? ''} width={800} focus={place.photo_focus} onExpand={(i) => setLightbox(i)}
              fallback={<Icon size={40} stroke={1.4} style={{ color: meta.fg, opacity: 0.85 }} />} />
          : <Icon size={40} stroke={1.4} style={{ color: meta.fg, opacity: 0.85 }} />}
        {gallery.length > 0 && (
          <span className="absolute top-2 right-2 z-20 size-7 rounded-full bg-black/45 text-white grid place-items-center pointer-events-none"><IconZoomScan size={15} /></span>
        )}
        <span className="absolute bottom-2 right-2 z-20 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium pointer-events-none" style={{ background: '#fff', color: meta.fg }}>
          {meta.label}
        </span>
      </div>

      <div className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[16px] font-medium">{place.name}</h2>
            {(place.multi_branch || !!place.branches?.length) && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium mt-1" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)' }}>
                <IconBuildingStore size={12} /> หลายสาขา
              </span>
            )}
            {(lineText || stationText) && (
              <div className="flex items-center gap-1.5 text-[12px] text-ink-3 mt-1">
                <span className="size-2 rounded-full shrink-0" style={{ background: lineColor ?? '#888780' }} />
                {(() => {
                  const code = stationCode(lineText, stationText)
                  const station = stationText ? `${code ? `${code} ` : ''}${stationText}` : ''
                  return <span>{lineText}{station ? ` · ${station}` : ''}</span>
                })()}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* out of the app — a drawn card, plus the place's own page here
                when it came from Explore, else its map pin */}
            <button onClick={() => void shareThis()}
              className="btn-icon !size-8" aria-label="แชร์สถานที่นี้" title="แชร์สถานที่นี้"><IconShare2 size={15} /></button>
            {onShare && <button onClick={onShare} className="btn-icon !size-8" aria-label="แชร์ไป Explore" title="แชร์ไป Explore"><IconWorldShare size={15} /></button>}
            {onEdit && <button onClick={onEdit} className="btn-icon !size-8" aria-label="แก้ไข"><IconPencil size={15} /></button>}
          </div>
        </div>

        {/* branch picker — for chains with multiple locations */}
        {branches.length > 0 && (
          <div className="mt-3">
            <BranchPicker branches={branches} value={branchIdx} onChange={setBranchIdx} hasOwnLocation={hasOwnLocation} ownLabel={place.branch_label} />
          </div>
        )}

        {place.note && <p className="text-[13px] text-ink-2 mt-3 leading-relaxed">{place.note}</p>}

        {/* extra photos — tap a thumbnail to view full size */}
        {!!place.photos?.length && (
          <div className="mt-4">
            <div className="flex items-center gap-1.5 text-[12px] text-ink-3 mb-1.5">
              <IconPhoto size={14} /> รูปภาพ ({place.photos.length + (hasPhoto ? 1 : 0)})
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {place.photos.map((ref, i) => (
                <button key={ref} onClick={() => setLightbox(extraBase + i)}
                  className="shrink-0 w-20 h-20 rounded-md overflow-hidden bg-surface-2 hairline grid place-items-center">
                  <SignedImage url={ref.startsWith('http') ? ref : undefined} path={ref.startsWith('http') ? undefined : ref}
                    className="w-full h-full object-cover" width={200}
                    fallback={<IconPhoto size={20} className="text-ink-3" />} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* menu (restaurants) — tap a thumbnail to view full size / open the PDF */}
        {!!place.menu_paths?.length && (
          <div className="mt-4">
            <div className="flex items-center gap-1.5 text-[12px] text-ink-3 mb-1.5">
              <IconToolsKitchen2 size={14} /> เมนู ({place.menu_paths.length})
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {place.menu_paths.map((ref) => (
                <button key={ref} onClick={() => openFileRef(ref)}
                  className="shrink-0 w-20 h-20 rounded-md overflow-hidden bg-surface-2 hairline grid place-items-center">
                  {isPdfRef(ref)
                    ? <span className="flex flex-col items-center gap-1 text-ink-3"><IconFileTypePdf size={24} /><span className="text-[10px]">PDF</span></span>
                    : <SignedImage url={ref.startsWith('http') ? ref : undefined} path={ref.startsWith('http') ? undefined : ref}
                        className="w-full h-full object-cover" width={200}
                        fallback={<IconToolsKitchen2 size={20} className="text-ink-3" />} />}
                </button>
              ))}
            </div>
          </div>
        )}

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
            /* being in the plan means having a stop in the itinerary, so this is
               a state to report plus a way to add another day — never a switch */
            <button onClick={onAddToDay} className="h-10 rounded-md text-[13px] font-medium flex items-center justify-center gap-1.5 whitespace-nowrap px-2"
              style={place.in_plan
                ? { background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }
                : { background: 'var(--color-brand)', color: '#fff' }}>
              {place.in_plan ? <><IconCheck size={15} /> อยู่ในแพลนแล้ว</> : <><IconPlus size={15} /> ใส่ลงวัน</>}
            </button>
          ) : onPin ? (
            <button onClick={onPin} className="h-10 rounded-md text-[13px] font-medium flex items-center justify-center gap-1.5 whitespace-nowrap px-2"
              style={{ background: 'var(--color-brand)', color: '#fff' }}>
              <IconStar size={15} /> เซฟไปทริปของฉัน
            </button>
          ) : <span />}
          <button onClick={() => openMap(mapUrl)} disabled={!mapUrl}
            className="h-10 rounded-md bg-surface flex items-center justify-center gap-1.5 text-[13px] text-ink-2 disabled:opacity-50 whitespace-nowrap px-2 hover:bg-surface-2"
            style={{ border: '0.5px solid var(--color-line)' }}>
            <IconMapPin size={15} /> {sel ? `เปิดแผนที่ (${sel.label || `สาขา ${branchIdx! + 1}`})` : 'เปิดแผนที่'}
          </button>
        </div>
      </div>

      {lightbox !== null && (
        <Lightbox photos={gallery} index={lightbox} alt={place.name ?? ''} onClose={() => setLightbox(null)} />
      )}
    </Drawer>
  )
}
