import { useEffect, useState, type ReactNode } from 'react'
import {
  IconHeart, IconHeartFilled, IconMapPin,
  IconSend, IconTrash, IconLoader2, IconArrowBackUp,
  IconBuildingStore, IconToolsKitchen2, IconFileTypePdf, IconZoomScan, IconPhoto, IconChevronDown,
  IconMessageReport, IconRoute, IconPencil, IconFlag, IconCheck, IconX,
} from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { PhotoCarousel } from './PhotoCarousel'
import { Lightbox, type PhotoRef } from './Lightbox'
import { Avatar } from './Avatar'
import { ExploreReviewPanel } from './ExploreReviewPanel'
import { BranchPicker } from './BranchPicker'
import { catMeta } from '@/lib/placeMeta'
import { modeMeta } from '@/lib/transitModes'
import { openMap } from '@/lib/maps'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { listComments, addComment, deleteComment, listSuggestions, resolveSuggestion, suggestionToInput, updateExplore } from '@/lib/exploreMutations'
import { getReviews, emptyStat, type ReviewData } from '@/lib/exploreReviews'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { SignedImage } from './SignedImage'
import type { ExplorePlace, ExploreComment, ExploreSuggestion, SuggestionKind } from '@/lib/database.types'

export const SUG_META: Record<SuggestionKind, { label: string; icon: typeof IconRoute }> = {
  route: { label: 'เพิ่มเส้นทาง', icon: IconRoute },
  branch: { label: 'เพิ่มสาขา', icon: IconBuildingStore },
  edit: { label: 'แก้ข้อมูล', icon: IconPencil },
  report: { label: 'รายงาน', icon: IconFlag },
}
/** one-line summary of a suggestion's payload for the owner's review row */
export function sugSummary(s: ExploreSuggestion): string {
  const p = (s.payload ?? {}) as Record<string, string | null | undefined>
  if (s.kind === 'route') return [p.line, p.station].filter(Boolean).join(' · ') || '(เส้นทางใหม่)'
  if (s.kind === 'branch') return p.label || p.map_url || '(สาขาใหม่)'
  if (s.kind === 'edit') return [p.name && `ชื่อ: ${p.name}`, p.photo_url && 'เปลี่ยนรูป'].filter(Boolean).join(' · ') || 'แก้ข้อมูล'
  const reasons: Record<string, string> = { wrong: 'ข้อมูลผิด', closed: 'ปิดถาวร', duplicate: 'ซ้ำกับที่อื่น', other: 'อื่น ๆ' }
  return reasons[(p.reason as string) ?? 'other'] ?? 'รายงาน'
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'เมื่อสักครู่'
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.ที่แล้ว`
  if (s < 604800) return `${Math.floor(s / 86400)} วันที่แล้ว`
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

/** All-plans-style row card for a nearby suggestion. */
export function NearbyCard({ p, onOpen }: { p: ExplorePlace; onOpen?: (p: ExplorePlace) => void }) {
  const m = catMeta(p.category)
  const Ic = m.icon
  return (
    <div className="card p-3 flex items-center gap-3">
      <button onClick={() => onOpen?.(p)} disabled={!onOpen} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <span className="size-12 rounded-md overflow-hidden grid place-items-center shrink-0" style={{ background: m.bg, color: m.fg }}>
          <SignedImage url={p.photo_url} focus={p.photo_focus} alt={p.name ?? ''} width={96}
            className="w-full h-full object-cover" fallback={<Ic size={20} stroke={1.5} />} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[14px] font-medium truncate">{p.name}</span>
            {(p.multi_branch || !!p.branches?.length) && (
              <span className="chip !py-0 !px-1.5 !text-[10px] inline-flex items-center gap-0.5 shrink-0"><IconBuildingStore size={11} /> หลายสาขา</span>
            )}
          </div>
          {(p.station_line || p.station_name) && (
            <div className="flex items-center gap-1.5 text-[11px] text-ink-3 mt-0.5">
              <span className="size-2 rounded-full shrink-0" style={{ background: p.station_color ?? '#888780' }} />
              <span className="truncate">{p.station_line}{p.station_name ? ` · ${p.station_name}` : ''}</span>
            </div>
          )}
        </div>
      </button>
      <button onClick={() => openMap(p.map_url)} disabled={!p.map_url}
        className="inline-flex items-center gap-1 text-[11px] text-ink-3 enabled:hover:text-brand-mid shrink-0">
        <IconMapPin size={13} /> MAP
      </button>
    </div>
  )
}

export function ExploreDetail({ e: eProp, open, saved, onClose, onFav, onOpenPlace, onSuggest, onItemChanged }: {
  e: ExplorePlace | null
  open: boolean
  saved: boolean
  onClose: () => void
  onFav: () => void
  /** tap a nearby suggestion → open that place's detail instead */
  onOpenPlace?: (p: ExplorePlace) => void
  /** non-owner "raise a hand to help edit / report" */
  onSuggest?: () => void
  /** owner accepted a suggestion → tell the page to reload its list */
  onItemChanged?: () => void
}) {
  const { user } = useAuth()
  const { profile } = useTrip()
  // owner-accepted edits are re-fetched into `override` so the detail updates
  // immediately without waiting for the parent list to reload.
  const [override, setOverride] = useState<ExplorePlace | null>(null)
  const e = override ?? eProp
  const isOwner = !!user && !!e && e.created_by === user.id
  const [suggestions, setSuggestions] = useState<ExploreSuggestion[]>([])
  const [busySug, setBusySug] = useState<string | null>(null)
  const [comments, setComments] = useState<ExploreComment[]>([])
  const [reviews, setReviews] = useState<ReviewData>({ rows: [], stat: emptyStat(), mine: null })
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  // full-size photo viewer — index into the extra-photos gallery (null = closed)
  const [lightbox, setLightbox] = useState<number | null>(null)
  // สถานที่ใกล้เคียง — same STATION in the same city first (falls back to the
  // whole city when this place has no station or nothing shares one)
  const [nearby, setNearby] = useState<ExplorePlace[]>([])
  const [nearbyOpen, setNearbyOpen] = useState(false)
  const [nearbyByStation, setNearbyByStation] = useState(false)
  useEffect(() => {
    setNearby([]); setNearbyOpen(false); setNearbyByStation(false)
    if (!open || !e?.city?.trim()) return
    let active = true
    // match by the STATION NAME only (station_name vs station_name) — ไม่เอา
    // ทั้งสายรถไฟ/สาขาอื่นมาปน; ที่ไม่มีสถานีเลยค่อยถอยไปแนะนำระดับเมือง
    const norm = (x?: string | null) => (x ?? '').trim().toLowerCase()
    const mine = norm(e.station_name)
    supabase.from('explore_places').select('*')
      .eq('city', e.city).neq('id', e.id)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => {
        if (!active) return
        const rows = (data ?? []) as ExplorePlace[]
        if (mine) {
          setNearby(rows.filter((pl) => norm(pl.station_name) === mine))
          setNearbyByStation(true)
        } else {
          setNearby(rows)
          setNearbyByStation(false)
        }
      })
    return () => { active = false }
  }, [open, e?.id, e?.city])
  // which branch (chain location) is selected; null = the item's own location
  const [branchIdx, setBranchIdx] = useState<number | null>(null)
  const hasOwnLocation = !!(e && (e.map_url || e.station_name || e.station_line))
  useEffect(() => {
    setBranchIdx(e?.branches?.length && !hasOwnLocation ? 0 : null)
  }, [e?.id, hasOwnLocation, e?.branches?.length])
  const meta = catMeta(e?.category)
  const Icon = meta.icon

  async function refresh() {
    if (!e) return
    const [cRes, r] = await Promise.all([listComments(e.id), getReviews(e.id, user?.id)])
    setComments((cRes.data ?? []) as ExploreComment[])
    setReviews(r)
    if (isOwner) setSuggestions(await listSuggestions(e.id))
    setLoading(false)
  }
  /** only the star data — used after rating so the drawer doesn't re-fetch it all */
  async function refreshReviews() { if (e) setReviews(await getReviews(e.id, user?.id)) }

  // reset the owner-edit override (and pending list) when the item itself changes
  useEffect(() => { setOverride(null); setSuggestions([]) }, [eProp?.id])

  async function applySug(s: ExploreSuggestion) {
    if (!e) return
    setBusySug(s.id)
    const input = suggestionToInput(e, s)
    if (input) await updateExplore(e.id, input)
    await resolveSuggestion(s.id, 'accepted')
    const { data } = await supabase.from('explore_places').select('*').eq('id', e.id).maybeSingle()
    if (data) setOverride(data as ExplorePlace)
    setSuggestions((xs) => xs.filter((x) => x.id !== s.id))
    setBusySug(null)
    onItemChanged?.()
    toast.success(input ? 'นำไปใช้แล้ว — อัปเดตให้เรียบร้อย' : 'รับเรื่องแล้ว')
  }
  async function dismissSug(s: ExploreSuggestion) {
    setBusySug(s.id)
    await resolveSuggestion(s.id, 'dismissed')
    setSuggestions((xs) => xs.filter((x) => x.id !== s.id))
    setBusySug(null)
  }

  useEffect(() => {
    if (!open || !e) return
    setLoading(true)
    setText('')
    setReplyTo(null)
    setReplyText('')
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, e?.id])

  async function send(body: string, parentId?: string | null) {
    if (!e || !user || !body.trim()) return
    setSending(true)
    const name = profile?.nickname ?? user.email?.split('@')[0] ?? 'ผู้ใช้'
    await addComment(e.id, user.id, body.trim(), name, profile?.avatar_color ?? null, parentId ?? null, profile?.avatar_url ?? null, profile?.avatar_focus ?? null)
    setText('')
    setReplyText('')
    setReplyTo(null)
    setSending(false)
    refresh()
  }

  async function removeComment(id: string) {
    await deleteComment(id)
    refresh()
  }

  // group comments under their parent (orphan replies fall back to top level)
  const ids = new Set(comments.map((c) => c.id))
  const childrenOf = (parentId: string | null) =>
    comments.filter((c) => {
      const p = c.parent_id && ids.has(c.parent_id) ? c.parent_id : null
      return p === parentId
    })

  function renderThread(parentId: string | null, depth: number): ReactNode {
    return childrenOf(parentId).map((c) => (
      <div key={c.id} className={depth > 0 ? 'pl-7' : ''}>
        <div className="flex items-start gap-2">
          <Avatar name={c.author_name} color={c.author_color} photo={c.author_photo} photoFocus={c.author_focus} size={depth > 0 ? 26 : 30} ring={false} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-medium truncate">{c.author_name ?? 'ผู้ใช้'}</span>
              <span className="text-[11px] text-ink-3 shrink-0">· {timeAgo(c.created_at)}</span>
              {c.user_id === user?.id && (
                <button onClick={() => removeComment(c.id)} aria-label="ลบความคิดเห็น" className="ml-auto text-ink-3 hover:text-booking shrink-0">
                  <IconTrash size={13} />
                </button>
              )}
            </div>
            <p className="text-[13px] text-ink whitespace-pre-wrap break-words">{c.body}</p>
            {user && (
              <button onClick={() => { setReplyTo((cur) => (cur === c.id ? null : c.id)); setReplyText('') }}
                className="inline-flex items-center gap-1 text-[11px] text-brand-mid mt-1">
                <IconArrowBackUp size={12} /> ตอบกลับ
              </button>
            )}
            {replyTo === c.id && (
              <div className="flex items-start gap-2 mt-2">
                <Avatar name={profile?.nickname ?? user?.email} color={profile?.avatar_color} photo={profile?.avatar_url} photoFocus={profile?.avatar_focus} size={26} ring={false} />
                <div className="flex-1 min-w-0">
                  <textarea value={replyText} onChange={(ev) => setReplyText(ev.target.value)} rows={2} autoFocus
                    placeholder={`ตอบกลับ ${c.author_name ?? ''}…`}
                    className="w-full resize-none rounded-[10px] bg-surface-2 px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-brand" />
                  <div className="flex justify-end gap-2 mt-1.5">
                    <button onClick={() => { setReplyTo(null); setReplyText('') }} className="h-8 px-3 rounded-full text-[12px] font-medium text-ink-2">ยกเลิก</button>
                    <button onClick={() => send(replyText, c.id)} disabled={sending || !replyText.trim()}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-brand text-white text-[12px] font-medium disabled:opacity-40">
                      {sending ? <IconLoader2 size={14} className="animate-spin" /> : <IconSend size={14} />} ตอบกลับ
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {childrenOf(c.id).length > 0 && (
          <div className="mt-3 space-y-3">{renderThread(c.id, depth + 1)}</div>
        )}
      </div>
    ))
  }

  if (!e) return null

  const branches = e.branches ?? []
  const sel = branchIdx != null ? branches[branchIdx] : null
  const mapUrl = sel?.map_url || e.map_url
  // unified gallery: cover photo first, then the extra photos — all swipeable
  const gallery: PhotoRef[] = [
    ...(e.photo_url ? [{ url: e.photo_url }] : []),
    ...(e.photos ?? []).map((ref) => ({ url: ref })),
  ]
  const extraBase = e.photo_url ? 1 : 0
  const routeList = sel
    ? [{ line: sel.line, color: sel.color, station: sel.station }]
    : (e.routes && e.routes.length) ? e.routes
    : (e.station_line || e.station_name) ? [{ line: e.station_line, color: e.station_color, station: e.station_name }] : []

  return (
    <Drawer open={open} onClose={onClose} title="รายละเอียด">
      {/* cover (contained card so the drag handle stays usable) */}
      <div className="relative h-52 rounded-[14px] overflow-hidden mt-1 bg-surface-2">
        {gallery.length > 0
          ? <PhotoCarousel photos={gallery} alt={e.name ?? ''} width={800} focus={e.photo_focus} onExpand={(i) => setLightbox(i)}
              fallback={<div className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><Icon size={52} stroke={1.4} style={{ color: meta.fg, opacity: 0.85 }} /></div>} />
          : <div className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><Icon size={52} stroke={1.4} style={{ color: meta.fg, opacity: 0.85 }} /></div>}
        {gallery.length > 0 && (
          <span className="absolute top-2.5 left-2.5 z-20 size-7 rounded-full bg-black/45 text-white grid place-items-center pointer-events-none"><IconZoomScan size={15} /></span>
        )}
        <button onClick={onFav} aria-label={saved ? 'เอาออกจากที่เซฟ' : 'เซฟเข้าทริปของฉัน'}
          className="absolute bottom-2.5 right-2.5 size-10 rounded-full grid place-items-center shadow-md z-10"
          style={{ background: saved ? 'var(--color-brand)' : 'rgba(255,255,255,.95)', color: saved ? '#fff' : 'var(--color-brand)' }}>
          {saved ? <IconHeartFilled size={20} /> : <IconHeart size={20} />}
        </button>
        <span className="absolute bottom-2.5 left-2.5 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm z-10" style={{ background: '#fff', color: meta.fg }}>
          {meta.label}
        </span>
      </div>

      {/* info */}
      <div className="text-[18px] font-medium leading-snug mt-3.5">{e.name}</div>

      {/* branch picker — for chains with multiple locations */}
      {branches.length > 0 && (
        <div className="mt-2.5">
          <BranchPicker branches={branches} value={branchIdx} onChange={setBranchIdx} hasOwnLocation={hasOwnLocation} />
        </div>
      )}

      <div className="flex flex-col gap-1 text-[12px] text-ink-3 mt-1.5">
        {routeList.map((r, i) => {
          const m = modeMeta('mode' in r ? (r.mode as string | undefined) : undefined)
          const MIcon = m.icon
          return (
            <span key={i} className="inline-flex items-center gap-1.5 min-w-0">
              <span className="inline-flex items-center justify-center size-4 rounded-full shrink-0 text-white" style={{ background: r.color ?? '#888780' }}><MIcon size={10} /></span>
              <span className="truncate">{[r.line, r.station].filter(Boolean).join(' · ') || m.label}</span>
            </span>
          )
        })}
        <span className="flex flex-wrap gap-1.5">
          {e.city && <span className="chip !py-0.5">{e.city}</span>}
          {e.country && <span className="chip !py-0.5">{e.country}</span>}
          {(e.multi_branch || !!e.branches?.length) && (
            <span className="!py-0.5 inline-flex items-center gap-1 rounded-full px-2 text-[12px] font-medium" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)' }}>
              <IconBuildingStore size={12} /> หลายสาขา
            </span>
          )}
        </span>
      </div>
      {e.note && <p className="text-[13px] text-ink-2 mt-2.5 whitespace-pre-wrap">{e.note}</p>}

      {/* extra photos — tap a thumbnail to view full size */}
      {!!e.photos?.length && (
        <div className="mt-4">
          <div className="flex items-center gap-1.5 text-[12px] text-ink-3 mb-1.5">
            <IconPhoto size={14} /> รูปภาพ ({e.photos.length + (e.photo_url ? 1 : 0)})
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {e.photos.map((ref, i) => (
              <button key={ref} onClick={() => setLightbox(extraBase + i)}
                className="shrink-0 w-20 h-20 rounded-md overflow-hidden bg-surface-2 hairline grid place-items-center">
                <img src={ref} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
      {mapUrl && (
        <button onClick={() => openMap(mapUrl)} className="inline-flex items-center gap-1 text-[12px] text-brand-mid mt-2.5">
          <IconMapPin size={14} /> {sel ? `เปิดแผนที่ (${sel.label || `สาขา ${branchIdx! + 1}`})` : 'เปิดแผนที่'}
        </button>
      )}

      {/* menu (restaurants) — tap a thumbnail to view full size / open the PDF */}
      {!!e.menu_paths?.length && (
        <div className="mt-4">
          <div className="flex items-center gap-1.5 text-[12px] text-ink-3 mb-1.5">
            <IconToolsKitchen2 size={14} /> เมนู ({e.menu_paths.length})
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {e.menu_paths.map((ref) => (
              <button key={ref} onClick={() => window.open(ref, '_blank')}
                className="shrink-0 w-20 h-20 rounded-md overflow-hidden bg-surface-2 hairline grid place-items-center">
                {/\.pdf($|\?)/i.test(ref)
                  ? <span className="flex flex-col items-center gap-1 text-ink-3"><IconFileTypePdf size={24} /><span className="text-[10px]">PDF</span></span>
                  : <img src={ref} alt="" className="w-full h-full object-cover" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ดาวจริง + คะแนนแยกด้าน + แท็ก + โหวตเมนู */}
      <div className="mt-4">
        <ExploreReviewPanel e={e} data={reviews} onChanged={refreshReviews} compact />
      </div>

      {/* non-owner: raise a hand to help edit / report */}
      {!isOwner && user && onSuggest && (
        <button onClick={onSuggest}
          className="w-full flex items-center justify-center gap-1.5 h-10 rounded-[10px] text-[12.5px] font-medium mt-2"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-ink-2)' }}>
          <IconMessageReport size={15} /> เห็นข้อมูลไม่ตรง? ช่วยแก้ / รายงาน
        </button>
      )}

      {/* owner: review pending suggestions from others */}
      {isOwner && suggestions.length > 0 && (
        <div className="mt-5">
          <div className="text-[13px] font-medium mb-2 flex items-center gap-1.5">
            <IconMessageReport size={15} className="text-brand" /> ข้อเสนอแก้ไข ({suggestions.length})
          </div>
          <div className="space-y-2">
            {suggestions.map((s) => {
              const M = SUG_META[s.kind]
              const SIcon = M.icon
              const busy = busySug === s.id
              return (
                <div key={s.id} className="card p-3" style={{ border: '0.5px solid var(--color-brand-border)' }}>
                  <div className="flex items-center gap-2">
                    <Avatar name={s.author_name} color={s.author_color} photo={s.author_photo} photoFocus={s.author_focus} size={24} ring={false} />
                    <span className="text-[12px] font-medium truncate flex-1">{s.author_name ?? 'ใครบางคน'}</span>
                    <span className="chip !py-0.5 !text-[10.5px] shrink-0"><SIcon size={11} /> {M.label}</span>
                  </div>
                  <div className="text-[12.5px] text-ink mt-1.5">{sugSummary(s)}</div>
                  {s.note && <div className="text-[12px] text-ink-3 mt-0.5 whitespace-pre-wrap">“{s.note}”</div>}
                  <div className="flex gap-2 mt-2.5">
                    {s.kind !== 'report' && (
                      <button onClick={() => applySug(s)} disabled={busy}
                        className="flex-1 inline-flex items-center justify-center gap-1 h-9 rounded-[9px] text-[12.5px] font-medium disabled:opacity-50"
                        style={{ background: 'var(--color-brand)', color: '#fff' }}>
                        {busy ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} />} นำไปใช้
                      </button>
                    )}
                    <button onClick={() => dismissSug(s)} disabled={busy}
                      className={['inline-flex items-center justify-center gap-1 h-9 rounded-[9px] text-[12.5px] font-medium disabled:opacity-50', s.kind === 'report' ? 'flex-1' : ''].join(' ')}
                      style={{ background: 'var(--color-surface-2)', color: 'var(--color-ink-2)', paddingInline: s.kind === 'report' ? undefined : 14 }}>
                      <IconX size={14} /> {s.kind === 'report' ? 'รับทราบ / ปิด' : 'ปิด'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* สถานที่ใกล้เคียง — same-city suggestions; >2 fold with a faint peek */}
      {nearby.length > 0 && (
        <div className="mt-5">
          <div className="text-[13px] font-medium mb-2">
            สถานที่ใกล้เคียง{nearbyByStation ? ` · สถานี ${e?.station_name ?? ''}` : `ใน ${e?.city}`}
            {' '}<span className="text-ink-3 font-normal">{nearby.length}</span>
          </div>
          <div className="space-y-2">
            {nearby.slice(0, 2).map((p) => <NearbyCard key={p.id} p={p} onOpen={onOpenPlace} />)}
            {nearby.length > 2 && (nearbyOpen ? (
              <>
                {nearby.slice(2).map((p) => <NearbyCard key={p.id} p={p} onOpen={onOpenPlace} />)}
                <button onClick={() => setNearbyOpen(false)}
                  className="w-full flex items-center justify-center gap-1 py-1.5 text-[12px] font-medium text-ink-3 hover:text-ink-2">
                  พับเก็บ <IconChevronDown size={15} className="rotate-180" />
                </button>
              </>
            ) : (
              // peek: a faint preview of the next card hints there are more
              <div role="button" tabIndex={0} onClick={() => setNearbyOpen(true)}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') setNearbyOpen(true) }}
                className="relative block w-full overflow-hidden rounded-[12px] cursor-pointer" style={{ height: 60 }}
                aria-label={`แสดงสถานที่ใกล้เคียงอีก ${nearby.length - 2} ที่`}>
                <div className="opacity-55 pointer-events-none"><NearbyCard p={nearby[2]} /></div>
                <div className="absolute inset-x-0 bottom-0 h-10 flex items-end justify-center pb-1"
                  style={{ background: 'linear-gradient(to bottom, transparent, var(--color-surface))' }}>
                  <span className="text-[12px] font-semibold text-brand inline-flex items-center gap-1">อีก {nearby.length - 2} ที่ <IconChevronDown size={14} /></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* comments */}
      <div className="mt-5">
        <div className="text-[13px] font-medium mb-2">ความคิดเห็น {comments.length > 0 && `(${comments.length})`}</div>

        <div className="flex items-start gap-2 mb-3">
          <Avatar name={profile?.nickname ?? user?.email} color={profile?.avatar_color} photo={profile?.avatar_url} photoFocus={profile?.avatar_focus} size={30} ring={false} />
          <div className="flex-1 min-w-0">
            <textarea value={text} onChange={(ev) => setText(ev.target.value)} rows={2}
              placeholder="เขียนความคิดเห็น…"
              className="w-full resize-none rounded-[10px] bg-surface-2 px-3 py-2 text-[13px] outline-none focus:ring-1 focus:ring-brand" />
            <div className="flex justify-end mt-1.5">
              <button onClick={() => send(text)} disabled={sending || !text.trim()}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-brand text-white text-[12px] font-medium disabled:opacity-40">
                {sending ? <IconLoader2 size={14} className="animate-spin" /> : <IconSend size={14} />} ส่ง
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-6 text-center text-[12px] text-ink-3">กำลังโหลด…</div>
        ) : comments.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-ink-3">ยังไม่มีความคิดเห็น — มาเป็นคนแรกกัน</div>
        ) : (
          <div className="space-y-3">{renderThread(null, 0)}</div>
        )}
      </div>

      {lightbox !== null && (
        <Lightbox photos={gallery} index={lightbox} alt={e.name ?? ''} onClose={() => setLightbox(null)} />
      )}
    </Drawer>
  )
}
