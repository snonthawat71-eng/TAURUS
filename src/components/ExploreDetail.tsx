import { useEffect, useState, type ReactNode } from 'react'
import {
  IconHeart, IconHeartFilled, IconMapPin, IconThumbUp, IconThumbUpFilled,
  IconThumbDown, IconThumbDownFilled, IconSend, IconTrash, IconLoader2, IconArrowBackUp,
  IconBuildingStore, IconToolsKitchen2, IconFileTypePdf,
} from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { SignedImage } from './SignedImage'
import { Avatar } from './Avatar'
import { StarRating } from './StarRating'
import { catMeta } from '@/lib/placeMeta'
import { modeMeta } from '@/lib/transitModes'
import { openMap } from '@/lib/maps'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { listComments, addComment, deleteComment, getVotes, setVote, ratingFrom } from '@/lib/exploreMutations'
import type { ExplorePlace, ExploreComment } from '@/lib/database.types'

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'เมื่อสักครู่'
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.ที่แล้ว`
  if (s < 604800) return `${Math.floor(s / 86400)} วันที่แล้ว`
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

export function ExploreDetail({ e, open, saved, onClose, onFav }: {
  e: ExplorePlace | null
  open: boolean
  saved: boolean
  onClose: () => void
  onFav: () => void
}) {
  const { user } = useAuth()
  const { profile } = useTrip()
  const [comments, setComments] = useState<ExploreComment[]>([])
  const [votes, setVotes] = useState({ up: 0, down: 0, mine: 0 })
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
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
    const [cRes, v] = await Promise.all([listComments(e.id), getVotes(e.id, user?.id)])
    setComments((cRes.data ?? []) as ExploreComment[])
    setVotes(v)
    setLoading(false)
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

  async function vote(v: 1 | -1) {
    if (!e || !user) return
    await setVote(e.id, user.id, v, votes.mine)
    setVotes(await getVotes(e.id, user.id))
  }

  async function send(body: string, parentId?: string | null) {
    if (!e || !user || !body.trim()) return
    setSending(true)
    const name = profile?.nickname ?? user.email?.split('@')[0] ?? 'ผู้ใช้'
    await addComment(e.id, user.id, body.trim(), name, profile?.avatar_color ?? null, parentId ?? null)
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
          <Avatar name={c.author_name} color={c.author_color} size={depth > 0 ? 26 : 30} ring={false} />
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
                <Avatar name={profile?.nickname ?? user?.email} color={profile?.avatar_color} size={26} ring={false} />
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
  const routeList = sel
    ? [{ line: sel.line, color: sel.color, station: sel.station }]
    : (e.routes && e.routes.length) ? e.routes
    : (e.station_line || e.station_name) ? [{ line: e.station_line, color: e.station_color, station: e.station_name }] : []

  return (
    <Drawer open={open} onClose={onClose} title="รายละเอียด">
      {/* cover (contained card so the drag handle stays usable) */}
      <div className="relative h-52 rounded-[14px] overflow-hidden mt-1 bg-surface-2">
        <SignedImage url={e.photo_url} alt={e.name ?? ''} className="absolute inset-0 w-full h-full object-cover" width={800}
          fallback={<div className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><Icon size={52} stroke={1.4} style={{ color: meta.fg, opacity: 0.85 }} /></div>} />
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
        <div className="mt-2">
          <div className="text-[11px] text-ink-3 mb-1.5">เลือกสาขา ({branches.length})</div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {hasOwnLocation && (
              <button onClick={() => setBranchIdx(null)}
                className={['chip shrink-0', branchIdx === null ? '!bg-brand-soft !text-brand-dark' : ''].join(' ')}
                style={branchIdx === null ? { border: '0.5px solid var(--color-brand-border)' } : undefined}>ที่ตั้งหลัก</button>
            )}
            {branches.map((b, i) => (
              <button key={i} onClick={() => setBranchIdx(i)}
                className={['chip shrink-0', branchIdx === i ? '!bg-brand-soft !text-brand-dark' : ''].join(' ')}
                style={branchIdx === i ? { border: '0.5px solid var(--color-brand-border)' } : undefined}>{b.label || `สาขา ${i + 1}`}</button>
            ))}
          </div>
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
            <span className="!py-0.5 inline-flex items-center gap-1 rounded-full px-2 text-[12px] font-medium" style={{ background: '#EEF0FB', color: '#5560C8' }}>
              <IconBuildingStore size={12} /> หลายสาขา
            </span>
          )}
        </span>
      </div>
      {e.note && <p className="text-[13px] text-ink-2 mt-2.5 whitespace-pre-wrap">{e.note}</p>}
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

      {/* star rating summary (from likes / unlikes) */}
      <div className="flex items-center gap-2 mt-4">
        <span className="text-[20px] font-semibold tabular-nums">{ratingFrom(votes.up, votes.down).toFixed(1)}</span>
        <StarRating rating={ratingFrom(votes.up, votes.down)} size={17} />
        <span className="text-[12px] text-ink-3">
          {votes.up + votes.down > 0 ? `จาก ${votes.up + votes.down} รีวิว` : 'ยังไม่มีรีวิว'}
        </span>
      </div>

      {/* recommend / not recommend */}
      <div className="flex gap-2 mt-2.5">
        <button onClick={() => vote(1)}
          className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-[10px] text-[13px] font-medium transition"
          style={votes.mine === 1
            ? { background: 'var(--color-brand)', color: '#fff' }
            : { background: 'var(--color-surface-2)', color: 'var(--color-ink-2)' }}>
          {votes.mine === 1 ? <IconThumbUpFilled size={17} /> : <IconThumbUp size={17} />} แนะนำ · {votes.up}
        </button>
        <button onClick={() => vote(-1)}
          className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-[10px] text-[13px] font-medium transition"
          style={votes.mine === -1
            ? { background: '#D85A30', color: '#fff' }
            : { background: 'var(--color-surface-2)', color: 'var(--color-ink-2)' }}>
          {votes.mine === -1 ? <IconThumbDownFilled size={17} /> : <IconThumbDown size={17} />} ไม่แนะนำ · {votes.down}
        </button>
      </div>

      {/* comments */}
      <div className="mt-5">
        <div className="text-[13px] font-medium mb-2">ความคิดเห็น {comments.length > 0 && `(${comments.length})`}</div>

        <div className="flex items-start gap-2 mb-3">
          <Avatar name={profile?.nickname ?? user?.email} color={profile?.avatar_color} size={30} ring={false} />
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
    </Drawer>
  )
}
