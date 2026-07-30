import { useEffect, useMemo, useState } from 'react'
import {
  IconStarFilled, IconTrash, IconTrophy, IconPencil, IconThumbUp, IconUser,
  IconToolsKitchen2, IconTag, IconUsers, IconChevronDown,
} from '@tabler/icons-react'
import { StarRating } from './StarRating'
import { ReviewEditor } from './ReviewEditor'
import { Avatar } from './Avatar'
import { useAuth } from '@/contexts/AuthContext'
import { confirmDialog } from '@/lib/confirm'
import {
  getTags, getMenu, deleteMenuItem, clearRating,
  helpedCount, aspectsFor, tagDef, isFood, reviewsReady,
  type ReviewData, type TagData, type MenuRow,
} from '@/lib/exploreReviews'
import type { ExplorePlace } from '@/lib/database.types'

/** "3 วันที่แล้ว" — kept local so this file doesn't import ExploreDetail, which
 *  imports this one back. */
function sinceText(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 3600) return 'เมื่อสักครู่'
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.ที่แล้ว`
  if (s < 604800) return `${Math.floor(s / 86400)} วันที่แล้ว`
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

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
 * The reviews tab, read-side. Everything here is a summary: the star breakdown,
 * the tag roll-up and the "สั่งอะไรดี" ranking are all read-only. The one way
 * to change any of it is `ReviewEditor`, the wizard this opens, which commits
 * the whole review in one submit. The only write left here is a dish deletion,
 * available to whoever added it and to the place's owner — moderation, not
 * voting.
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
  const [showAllWritten, setShowAllWritten] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
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

  // whoever got here first — earns the badge on their own card, mine or not
  const firstReviewerId = rows.length
    ? rows.reduce((a, b) => ((a.created_at ?? '') <= (b.created_at ?? '') ? a : b)).user_id
    : null

  async function afterSave() { await Promise.all([onChanged(), loadSide()]) }

  /** Withdraw my review. Confirmed first — unlike a comment this also takes the
   *  tags and any attached photos with it. */
  async function removeMine() {
    if (!user || !mine) return
    if (!(await confirmDialog({ message: 'ลบรีวิวของคุณออกจากที่นี่? แท็กและรูปที่แนบไว้จะถูกลบไปด้วย', danger: true, confirmLabel: 'ลบรีวิว' }))) return
    await clearRating(e.id, user.id)
    await afterSave()
  }

  /** moderation only — voting for a dish happens inside the review form */
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
  // Other people only get a card when they actually wrote something — a bare
  // score already shows in the distribution above. MINE always gets one, even
  // score-only, because that card carries the edit button.
  const written = rows.filter((r) => r.user_id === user?.id || r.body?.trim() || r.photos?.length)
    .sort((a, b) => Number(b.user_id === user?.id) - Number(a.user_id === user?.id))

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

      {/* ── nothing about my own review here any more: it's the first card in
             the list below, badges and edit button included ── */}
      {user && !mine && (
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
            <span className="block text-[11.5px] text-ink-3 mt-0.5">แตะดาวครั้งเดียวก็พอ · อยากละเอียดค่อยให้แยกด้าน</span>
          </span>
          <span className="text-[12px] font-semibold text-brand shrink-0">เริ่มเลย</span>
        </button>
      )}

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
            <button onClick={() => setEditorOpen(true)} disabled={!user}
              className="text-[12px] text-ink-3 text-left disabled:opacity-60">
              ยังไม่มีใครบอกว่าเมนูไหนเด็ด — <span className="text-brand font-medium">เขียนรีวิวแล้วแนะนำเมนูแรก</span>
            </button>
          ) : (
            <div className="space-y-1.5">
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
                      <span className="inline-flex items-center gap-1 text-[12px] font-semibold shrink-0"
                        style={{ color: row.mine ? 'var(--color-brand)' : 'var(--color-ink-3)' }}>
                        <IconThumbUp size={14} /><span className="tabular-nums">{row.votes}</span>
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── what people wrote — otherwise the review body and photos the form
             collects would never be seen by anyone ── */}
      {written.length > 0 && (
        <div className={gap}>
          <div className="text-[13px] font-semibold text-ink-2 mb-2">
            รีวิว <span className="text-ink-3 font-normal">· {written.length}</span>
          </div>
          <div className="space-y-3">
            {written.slice(0, showAllWritten ? undefined : 3).map((r) => {
              const isMine = r.user_id === user?.id
              const isFirst = r.user_id === firstReviewerId
              return (
                <div key={r.user_id} className="card p-3.5"
                  style={isMine ? { border: '0.5px solid var(--color-brand-border)' } : undefined}>
                  <div className="flex items-center gap-2">
                    {r.anonymous
                      ? <span className="size-[30px] rounded-full grid place-items-center shrink-0" style={{ background: 'var(--color-surface-2)', color: 'var(--color-ink-3)' }}><IconUser size={16} /></span>
                      : <Avatar name={r.author_name} color={r.author_color} photo={r.author_photo} photoFocus={r.author_focus} size={30} ring={false} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={['text-[12.5px] truncate max-w-full', r.anonymous ? 'text-ink-3' : 'font-medium'].join(' ')}>
                          {r.anonymous ? 'ไม่ระบุตัวตน' : r.author_name ?? 'ผู้ใช้'}
                        </span>
                        {isMine && (
                          <span className="shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold"
                            style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)' }}>ของคุณ</span>
                        )}
                        {isFirst && (
                          <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-semibold"
                            style={{ background: '#FDF3E0', color: '#9A7320' }}>
                            <IconTrophy size={10} /> คนแรกที่รีวิว
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <StarRating rating={Number(r.stars)} size={11} />
                        <span className="text-[11px] font-bold tabular-nums">{Number(r.stars).toFixed(1)}</span>
                        <span className="text-[10.5px] text-ink-3">· {sinceText(r.updated_at ?? r.created_at)}</span>
                      </div>
                    </div>
                    {isMine && (
                      <>
                        <button onClick={() => setEditorOpen(true)}
                          className="shrink-0 inline-flex items-center gap-1 h-9 px-3.5 rounded-full text-[12.5px] font-semibold"
                          style={{ background: 'var(--color-brand)', color: '#fff' }}>
                          <IconPencil size={14} /> แก้ไข
                        </button>
                        {/* same affordance as deleting one of my comments below */}
                        <button onClick={removeMine} aria-label="ลบรีวิว"
                          className="shrink-0 text-ink-3 hover:text-booking">
                          <IconTrash size={14} />
                        </button>
                      </>
                    )}
                  </div>
                  {r.body && <p className="text-[13px] text-ink whitespace-pre-wrap break-words mt-2.5">{r.body}</p>}
                  {!!r.photos?.length && (
                    <div className="flex gap-1.5 mt-2.5 overflow-x-auto no-scrollbar">
                      {r.photos.map((url) => (
                        <img key={url} src={url} alt="" className="shrink-0 w-[72px] h-[72px] rounded-[9px] object-cover bg-surface-2" />
                      ))}
                    </div>
                  )}
                  {isMine && tags.mine.size > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {[...tags.mine].map((k) => (
                        <span key={k} className="inline-flex items-center rounded-full px-2 h-6 text-[11px] font-medium"
                          style={{ background: 'var(--color-surface-2)', color: 'var(--color-ink-2)' }}>{tagDef(k).label}</span>
                      ))}
                    </div>
                  )}
                  {isMine && helped > 0 && (
                    <div className="text-[10.5px] text-ink-3 mt-2.5 inline-flex items-center gap-1">
                      <IconUsers size={11} /> ช่วยคนที่เปิดดูแล้ว {helped} คน
                    </div>
                  )}
                </div>
              )
            })}
            {!showAllWritten && written.length > 3 && (
              <button onClick={() => setShowAllWritten(true)}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-[12px] font-medium text-ink-3 hover:text-ink-2">
                อีก {written.length - 3} รีวิว <IconChevronDown size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      <ReviewEditor e={e} open={editorOpen} mine={mine} myTags={tags.mine}
        onClose={() => setEditorOpen(false)} onSaved={afterSave} />
    </div>
  )
}
