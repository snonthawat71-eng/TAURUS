import { useEffect, useState } from 'react'
import {
  IconHeart, IconHeartFilled, IconMapPin, IconThumbUp, IconThumbUpFilled,
  IconThumbDown, IconThumbDownFilled, IconSend, IconTrash, IconLoader2,
} from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { SignedImage } from './SignedImage'
import { Avatar } from './Avatar'
import { catMeta } from '@/lib/placeMeta'
import { openMap } from '@/lib/maps'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { listComments, addComment, deleteComment, getVotes, setVote } from '@/lib/exploreMutations'
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
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
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
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, e?.id])

  async function vote(v: 1 | -1) {
    if (!e || !user) return
    await setVote(e.id, user.id, v, votes.mine)
    setVotes(await getVotes(e.id, user.id))
  }

  async function send() {
    if (!e || !user || !text.trim()) return
    setSending(true)
    const name = profile?.nickname ?? user.email?.split('@')[0] ?? 'ผู้ใช้'
    await addComment(e.id, user.id, text.trim(), name, profile?.avatar_color ?? null)
    setText('')
    setSending(false)
    refresh()
  }

  async function removeComment(id: string) {
    await deleteComment(id)
    refresh()
  }

  if (!e) return null

  return (
    <Drawer open={open} onClose={onClose}>
      {/* cover */}
      <div className="relative -mx-5 -mt-3 mb-3 h-56 overflow-hidden">
        <SignedImage url={e.photo_url} alt={e.name ?? ''} className="w-full h-full object-cover"
          fallback={<div className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><Icon size={52} stroke={1.4} style={{ color: meta.fg, opacity: 0.85 }} /></div>} />
        <button onClick={onFav} aria-label={saved ? 'เอาออกจากที่เซฟ' : 'เซฟเข้าทริปของฉัน'}
          className="absolute bottom-3 right-3 size-10 rounded-full grid place-items-center shadow-md"
          style={{ background: saved ? 'var(--color-brand)' : 'rgba(255,255,255,.95)', color: saved ? '#fff' : 'var(--color-brand)' }}>
          {saved ? <IconHeartFilled size={20} /> : <IconHeart size={20} />}
        </button>
        <span className="absolute bottom-3 left-3 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm" style={{ background: '#fff', color: meta.fg }}>
          {meta.label}
        </span>
      </div>

      {/* info */}
      <div className="text-[18px] font-medium leading-snug">{e.name}</div>
      <div className="flex items-center gap-1.5 text-[12px] text-ink-3 mt-1.5 flex-wrap">
        {(e.station_line || e.station_color || e.station_name) && (
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <span className="size-2.5 rounded-full shrink-0" style={{ background: e.station_color ?? '#888780' }} />
            <span className="truncate">{[e.station_line, e.station_name].filter(Boolean).join(' · ') || 'สถานี'}</span>
          </span>
        )}
        {e.city && <span className="chip !py-0.5">{e.city}</span>}
        {e.country && <span className="chip !py-0.5">{e.country}</span>}
      </div>
      {e.note && <p className="text-[13px] text-ink-2 mt-2.5 whitespace-pre-wrap">{e.note}</p>}
      {e.map_url && (
        <button onClick={() => openMap(e.map_url)} className="inline-flex items-center gap-1 text-[12px] text-brand-mid mt-2.5">
          <IconMapPin size={14} /> เปิดแผนที่
        </button>
      )}

      {/* recommend / not recommend */}
      <div className="flex gap-2 mt-4">
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
              <button onClick={send} disabled={sending || !text.trim()}
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
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <Avatar name={c.author_name} color={c.author_color} size={30} ring={false} />
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  )
}
