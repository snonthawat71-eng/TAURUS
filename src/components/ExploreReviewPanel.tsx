import { useEffect, useMemo, useState } from 'react'
import {
  IconStarFilled, IconPlus, IconTrash, IconLoader2, IconTrophy, IconPencil,
  IconToolsKitchen2, IconTag, IconUsers, IconChevronDown,
} from '@tabler/icons-react'
import { StarRating } from './StarRating'
import { ReviewEditor } from './ReviewEditor'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import {
  getTags, getMenu, addMenuItem, deleteMenuItem, toggleMenuVote,
  helpedCount, aspectsFor, tagDef, isFood, reviewsReady,
  type ReviewData, type TagData, type MenuRow,
} from '@/lib/exploreReviews'
import type { ExplorePlace } from '@/lib/database.types'

/** Horizontal 0–5 meter used for the per-aspect averages. */
function AspectBar({ label, value, count }: { label: string; value: number; count: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[68px] shrink-0 text-[12px] text-ink-2 truncate">{label}</span>
      <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: count ? '#F5A623' : 'transparent' }} />
      </div>
      <span className="w-7 text-right text-[11.5px] font-semibold tabular-nums shrink-0" style={count ? undefined : { color: 'var(--color-ink-3)' }}>
        {count ? value.toFixed(1) : '–'}
      </span>
    </div>
  )
}

/**
 * The reviews tab, read-side. Everything here is a summary — the only way to
 * change your own review is the form in `ReviewEditor`, which commits once.
 * The exception is the "สั่งอะไรดี" menu poll, which is a community ranking
 * rather than part of anyone's review, so it stays tap-to-vote.
 */
export function ExploreReviewPanel({ e, data, onChanged, compact = false }: {
  e: ExplorePlace
  data: ReviewData
  onChanged: () => void | Promise<void>
  /** tighter spacing for the drawer version */
  compact?: boolean
}) {
  const { user } = useAuth()
  const { stat, mine, rows } = data
  const food = isFood(e.group_type)
  const aspects = useMemo(() => aspectsFor(e.group_type), [e.group_type])

  const [tags, setTags] = useState<TagData>({ counts: [], mine: new Set() })
  const [menu, setMenu] = useState<MenuRow[]>([])
  const [showAllTags, setShowAllTags] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [newDish, setNewDish] = useState('')
  const [adding, setAdding] = useState(false)
  const [helped, setHelped] = useState(0)

  async function loadSide() {
    const [t, m] = await Promise.all([getTags(e.id, user?.id), food ? getMenu(e.id, user?.id) : Promise.resolve([])])
    setTags(t); setMenu(m)
  }
  useEffect(() => { loadSide() }, [e.id, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // "your review helped N people" — only meaningful once I've actually reviewed
  useEffect(() => {
    if (!user || !mine) { setHelped(0); return }
    let active = true
    helpedCount(e.id, mine.created_at, user.id).then((n) => { if (active) setHelped(n) })
    return () => { active = false }
  }, [e.id, user?.id, mine?.created_at]) // eslint-disable-line react-hooks/exhaustive-deps

  // am I the earliest review on this place?
  const firstReviewer = !!mine && rows.length > 0 &&
    rows.every((r) => r.user_id === user?.id || (r.created_at ?? '') >= (mine.created_at ?? ''))

  async function afterSave() { await Promise.all([onChanged(), loadSide()]) }

  async function tapDish(row: MenuRow) {
    if (!user) return
    const on = !row.mine
    setMenu((xs) => xs.map((x) => (x.id === row.id ? { ...x, mine: on, votes: x.votes + (on ? 1 : -1) } : x)))
    const res = await toggleMenuVote(row.id, user.id, on)
    if (res.error) { toast.error('โหวตไม่สำเร็จ'); loadSide() }
    else setMenu((xs) => [...xs].sort((a, b) => b.votes - a.votes || (a.created_at ?? '').localeCompare(b.created_at ?? '')))
  }

  async function addDish() {
    if (!user || !newDish.trim() || adding) return
    setAdding(true)
    const res = await addMenuItem(e.id, user.id, newDish)
    setAdding(false)
    if (res.error) { toast.error('เพิ่มเมนูไม่สำเร็จ'); return }
    setNewDish('')
    await loadSide()
  }

  async function removeDish(row: MenuRow) {
    if (!(await confirmDialog({ message: `ลบ "${row.name}" ออกจากรายการเมนู?`, danger: true, confirmLabel: 'ลบ' }))) return
    await deleteMenuItem(row.id)
    await loadSide()
  }

  if (!reviewsReady()) {
    return (
      <div className="card p-5 text-center text-[12.5px] text-ink-2 leading-relaxed">
        ยังไม่ได้เปิดระบบรีวิว — รัน <code className="text-booking">supabase/explore_reviews.sql</code> ใน Supabase SQL Editor ก่อน
        <div className="text-[11.5px] text-ink-3 mt-1.5">แล้วรีเฟรชหน้านี้อีกครั้ง</div>
      </div>
    )
  }

  const gap = compact ? 'mt-4' : 'mt-5'
  const maxDist = Math.max(1, ...stat.dist)
  const anyAspect = aspects.some((a) => stat.aspects[a.key].count > 0)
  const shownTags = showAllTags ? tags.counts : tags.counts.slice(0, 6)
  const topDish = menu[0]

  return (
    <div>
      {/* ── what everyone gave ── */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <div className="text-center shrink-0 w-[86px]">
            <div className="text-[34px] font-extrabold leading-none tabular-nums" style={stat.count === 0 ? { color: 'var(--color-ink-3)' } : undefined}>
              {stat.count === 0 ? '–' : stat.avg.toFixed(1)}
            </div>
            <div className="mt-1"><StarRating rating={stat.avg} size={14} empty={stat.count === 0} /></div>
            <div className="text-[11px] text-ink-3 mt-1">{stat.count > 0 ? `${stat.count} รีวิว` : 'ยังไม่มีรีวิว'}</div>
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            {[5, 4, 3, 2, 1].map((n) => {
              const c = stat.dist[n - 1]
              return (
                <div key={n} className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-0.5 text-[10.5px] text-ink-3 w-[22px] shrink-0">
                    {n}<IconStarFilled size={9} style={{ color: '#F5A623' }} />
                  </span>
                  <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(c / maxDist) * 100}%`, background: c ? '#F5A623' : 'transparent' }} />
                  </div>
                  <span className="w-4 text-right text-[10.5px] text-ink-3 tabular-nums shrink-0">{c || ''}</span>
                </div>
              )
            })}
          </div>
        </div>

        {anyAspect && (
          <div className="mt-4 pt-3.5 space-y-2" style={{ borderTop: '0.5px solid var(--color-line)' }}>
            {aspects.map((a) => (
              <AspectBar key={a.key} label={a.label} value={stat.aspects[a.key].avg} count={stat.aspects[a.key].count} />
            ))}
          </div>
        )}
      </div>

      {/* ── my review: a quiet footnote under the summary once it's submitted.
             The whole row opens the form again; the breakdown lives in there,
             so nothing here competes with the place's own score. ── */}
      {user && (mine ? (
        <div className="mt-2.5">
          <button onClick={() => setEditorOpen(true)} className="w-full flex items-center gap-1.5 px-1 py-1.5 text-left">
            <span className="text-[11.5px] text-ink-3 shrink-0">รีวิวของคุณ</span>
            <span className="text-[12.5px] font-bold tabular-nums shrink-0">{Number(mine.stars).toFixed(1)}</span>
            <StarRating rating={Number(mine.stars)} size={11} />
            {tags.mine.size > 0 && (
              <span className="text-[11px] text-ink-3 truncate min-w-0">· {[...tags.mine].map((k) => tagDef(k).label).join(', ')}</span>
            )}
            <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-medium text-brand shrink-0">
              <IconPencil size={12} /> แก้ไข
            </span>
          </button>
          {(firstReviewer || helped > 0) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-1 text-[10.5px] text-ink-3">
              {firstReviewer && <span className="inline-flex items-center gap-1"><IconTrophy size={11} /> คนแรกที่รีวิวที่นี่</span>}
              {helped > 0 && <span className="inline-flex items-center gap-1"><IconUsers size={11} /> ช่วยคนที่เปิดดูแล้ว {helped} คน</span>}
            </div>
          )}
        </div>
      ) : (
        <button onClick={() => setEditorOpen(true)}
          className={`card w-full p-4 flex items-center gap-3 text-left ${gap}`}
          style={{ border: '0.5px solid var(--color-brand-border)' }}>
          <span className="size-10 rounded-[11px] grid place-items-center shrink-0" style={{ background: 'var(--color-brand-soft)', color: '#F5A623' }}>
            <IconStarFilled size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold">
              {stat.count === 0 ? 'เป็นคนแรกที่รีวิวที่นี่' : 'เขียนรีวิวของคุณ'}
            </span>
            <span className="block text-[11.5px] text-ink-3 mt-0.5">ให้ดาว 4 ด้าน แล้วคิดคะแนนรวมให้อัตโนมัติ</span>
          </span>
          <span className="text-[12px] font-semibold text-brand shrink-0">เริ่มเลย</span>
        </button>
      ))}

      {/* ── what people said about it (read-only roll-up of everyone's tags) ── */}
      {tags.counts.length > 0 && (
        <div className={gap}>
          <div className="flex items-center gap-1.5 mb-2">
            <IconTag size={14} className="text-brand" />
            <span className="text-[13px] font-semibold text-ink-2">ที่นี่เป็นยังไง</span>
            <span className="text-[11px] text-ink-3">· จากคนที่รีวิว</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {shownTags.map(({ key, n }) => {
              const on = tags.mine.has(key)
              return (
                <span key={key} className="inline-flex items-center gap-1 rounded-full px-2.5 h-8 text-[12px] font-medium"
                  style={on
                    ? { background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }
                    : { background: 'var(--color-surface-2)', color: 'var(--color-ink-2)' }}>
                  {tagDef(key).label}<span className="tabular-nums text-[11px] opacity-70">{n}</span>
                </span>
              )
            })}
            {!showAllTags && tags.counts.length > 6 && (
              <button onClick={() => setShowAllTags(true)}
                className="inline-flex items-center gap-1 rounded-full px-2.5 h-8 text-[12px] font-medium"
                style={{ background: 'var(--color-surface-2)', color: 'var(--color-brand)' }}>
                อีก {tags.counts.length - 6} <IconChevronDown size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── menu poll (restaurants) — community ranking, not part of a review ── */}
      {food && (
        <div className={gap}>
          <div className="flex items-center gap-1.5 mb-2">
            <IconToolsKitchen2 size={14} className="text-brand" />
            <span className="text-[13px] font-semibold text-ink-2">สั่งอะไรดี</span>
            {menu.length > 0 && <span className="text-[11px] text-ink-3">· โหวตจาก {menu.reduce((n, m) => n + m.votes, 0)} เสียง</span>}
          </div>

          {menu.length === 0 ? (
            <div className="text-[12px] text-ink-3 mb-2">ยังไม่มีใครบอกว่าเมนูไหนเด็ด — เพิ่มเมนูแรกเลย</div>
          ) : (
            <div className="space-y-1.5 mb-2">
              {menu.map((row, i) => {
                const share = topDish?.votes ? (row.votes / topDish.votes) * 100 : 0
                return (
                  <div key={row.id} className="relative overflow-hidden rounded-[10px]" style={{ background: 'var(--color-surface-2)' }}>
                    {/* the bar IS the ranking — no separate chart needed */}
                    <div className="absolute inset-y-0 left-0" style={{ width: `${share}%`, background: 'var(--color-brand-soft)' }} />
                    <div className="relative flex items-center gap-2 px-2.5 h-11">
                      <span className="w-4 text-[11px] font-bold tabular-nums shrink-0" style={{ color: i === 0 && row.votes > 0 ? 'var(--color-brand)' : 'var(--color-ink-3)' }}>{i + 1}</span>
                      <span className="flex-1 min-w-0 truncate text-[13px] font-medium">{row.name}</span>
                      {(row.created_by === user?.id || e.created_by === user?.id) && (
                        <button onClick={() => removeDish(row)} aria-label="ลบเมนู" className="text-ink-3 hover:text-booking shrink-0">
                          <IconTrash size={13} />
                        </button>
                      )}
                      <button onClick={() => tapDish(row)} disabled={!user}
                        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-full text-[12px] font-semibold shrink-0 disabled:opacity-50"
                        style={row.mine
                          ? { background: 'var(--color-brand)', color: '#fff' }
                          : { background: 'var(--color-surface)', color: 'var(--color-ink-2)', border: '0.5px solid var(--color-line)' }}>
                        <IconStarFilled size={12} style={row.mine ? undefined : { color: '#F5A623' }} />
                        <span className="tabular-nums">{row.votes}</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {user && (
            <div className="flex gap-2">
              <input value={newDish} onChange={(ev) => setNewDish(ev.target.value)}
                onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); addDish() } }}
                placeholder="เมนูที่คุณว่าเด็ด…" maxLength={60}
                className="flex-1 min-w-0 h-10 rounded-[10px] bg-surface-2 px-3 text-[13px] outline-none focus:ring-1 focus:ring-brand" />
              <button onClick={addDish} disabled={!newDish.trim() || adding}
                className="inline-flex items-center gap-1 h-10 px-3.5 rounded-[10px] bg-brand text-white text-[12.5px] font-medium disabled:opacity-40 shrink-0">
                {adding ? <IconLoader2 size={14} className="animate-spin" /> : <IconPlus size={15} />} เพิ่ม
              </button>
            </div>
          )}
        </div>
      )}

      <ReviewEditor e={e} open={editorOpen} mine={mine} myTags={tags.mine}
        onClose={() => setEditorOpen(false)} onSaved={afterSave} />
    </div>
  )
}
