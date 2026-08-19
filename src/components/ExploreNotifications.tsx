import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconBell, IconHeartFilled, IconMessageCircle, IconMessageReport } from '@tabler/icons-react'
import { getExploreNotifs, type ExploreNotif } from '@/lib/exploreMutations'
import { loadNotifState, markNotifRead, markSeen } from '@/lib/notifRead'
import type { SuggestionKind } from '@/lib/database.types'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

const SUG_LABEL: Record<SuggestionKind, string> = {
  route: 'เสนอเพิ่มเส้นทางให้', branch: 'เสนอเพิ่มสาขาให้', edit: 'เสนอแก้ข้อมูลของ', report: 'รายงาน',
}

function timeAgo(at: string): string {
  const t = new Date(at).getTime()
  if (isNaN(t)) return ''
  const s = Math.max(0, Math.round((Date.now() - t) / 1000))
  if (s < 60) return 'เมื่อสักครู่'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} นาทีที่แล้ว`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} ชม.ที่แล้ว`
  const d = Math.round(h / 24)
  if (d < 30) return `${d} วันที่แล้ว`
  return new Date(at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

/** Bell menu for the Explore page owner: likes & comments on items they created. */
export function ExploreNotifications({ userId, onOpenItem }: {
  userId: string
  onOpenItem?: (exploreId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<ExploreNotif[]>([])
  const [seen, setSeen] = useState<string>('')
  const wrapRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    const [all, state] = await Promise.all([getExploreNotifs(userId), loadNotifState(userId)])
    setSeen(state.seenAt)
    const list = all.filter((n) => !state.readIds.has(n.id))
    setNotifs(list)
    return list
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  // Realtime: refresh the instant anyone likes/comments (tables must be in the
  // supabase_realtime publication — see explore.sql). Debounced to collapse bursts.
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const bump = () => { clearTimeout(timer); timer = setTimeout(() => { refresh() }, 300) }
    const channel = supabase.channel('explore-notifs')
    for (const table of ['explore_votes', 'explore_comments', 'explore_suggestions']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, bump)
    }
    channel.subscribe()
    return () => { clearTimeout(timer); supabase.removeChannel(channel) }
  }, [refresh])

  const unread = useMemo(() => notifs.filter((n) => n.at > seen).length, [notifs, seen])

  async function toggle() {
    if (open) { setOpen(false); return }
    setOpen(true)
    const list = await refresh()
    // mark everything currently shown as seen (clears the badge) — server-side
    const newest = list[0]?.at
    const mark = newest && newest > seen ? newest : new Date().toISOString()
    setSeen(mark)
    markSeen(userId, mark)
  }

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button onClick={toggle} className="btn-icon !border-0 relative" aria-label="การแจ้งเตือน">
        <IconBell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-medium grid place-items-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-[300px] max-w-[86vw] card p-0 shadow-lg z-50 overflow-hidden">
          <div className="px-3.5 h-11 flex items-center text-[13px] font-medium" style={{ borderBottom: '0.5px solid var(--color-line)' }}>
            การแจ้งเตือน
          </div>
          <div className="max-h-[60vh] overflow-auto" style={{ overscrollBehavior: 'contain' }}>
            {notifs.length === 0 ? (
              <div className="py-10 text-center text-[12px] text-ink-3">ยังไม่มีการแจ้งเตือน</div>
            ) : (
              notifs.map((n) => (
                <button key={n.id}
                  onClick={() => {
                    markNotifRead(userId, n.id) // เปิดดู = อ่านแล้ว
                    setNotifs((xs) => xs.filter((x) => x.id !== n.id))
                    setOpen(false)
                    onOpenItem?.(n.exploreId)
                  }}
                  className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-surface-2"
                  style={{ borderTop: '0.5px solid var(--color-line)' }}>
                  <span className="size-7 rounded-full grid place-items-center shrink-0 mt-0.5"
                    style={{ background: n.kind === 'like' ? '#FCE7EA' : n.kind === 'suggestion' ? '#EAF6EE' : 'var(--color-brand-soft)' }}>
                    {n.kind === 'like'
                      ? <IconHeartFilled size={14} className="text-[#EF4444]" />
                      : n.kind === 'suggestion'
                        ? <IconMessageReport size={14} style={{ color: '#16A34A' }} />
                        : <IconMessageCircle size={14} className="text-brand" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] leading-snug">
                      <span className="font-medium">{n.who}</span>
                      {n.kind === 'like' ? ' ถูกใจ ' : n.kind === 'suggestion' ? ` ${SUG_LABEL[n.sugKind ?? 'edit']} ` : ' คอมเมนต์ '}
                      <span className="font-medium">{n.placeName}</span>
                    </div>
                    {(n.kind === 'comment' || n.kind === 'suggestion') && n.body && (
                      <div className="text-[12px] text-ink-3 truncate mt-0.5">“{n.body}”</div>
                    )}
                    <div className="text-[10.5px] text-ink-3 mt-0.5">{timeAgo(n.at)}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
