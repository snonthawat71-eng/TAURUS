import { useEffect, useMemo, useState } from 'react'
import {
  IconStarFilled, IconPlus, IconTrash, IconLoader2, IconTrophy, IconSparkles,
  IconChevronDown, IconToolsKitchen2, IconUsers, IconCheck,
} from '@tabler/icons-react'
import { StarRating } from './StarRating'
import { StarInput } from './StarInput'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import {
  getTags, toggleTag, getMenu, addMenuItem, deleteMenuItem, toggleMenuVote,
  helpedCount, aspectsFor, tagsFor, tagDef, isFood, reviewsReady,
  clearRating, setRating,
  type ReviewData, type TagData, type MenuRow, type AspectKey, type RatingPatch,
} from '@/lib/exploreReviews'
import type { ExplorePlace } from '@/lib/database.types'

/** Horizontal 0–5 meter used for the per-aspect averages. */
function AspectBar({ label, hint, value, count }: { label: string; hint?: string; value: number; count: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-[68px] shrink-0">
        <div className="text-[12px] text-ink-2 leading-tight">{label}</div>
        {hint && <div className="text-[9.5px] text-ink-3 leading-tight">{hint}</div>}
      </div>
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
 * Everything review-shaped for one Explore place: the real star summary, my own
 * rating (with the four sub-scores revealed only after a star is given), the
 * one-tap tag wall and — for restaurants — the "สั่งอะไรดี" menu vote.
 *
 * `data` + `onChanged` are owned by the parent because the page header shows
 * the same average; the tag and menu state live here since nothing else needs
 * them.
 */
export function ExploreReviewPanel({ e, data, onChanged, compact = false }: {
  e: ExplorePlace
  data: ReviewData
  onChanged: () => void | Promise<void>
  /** tighter spacing for the drawer version */
  compact?: boolean
}) {
  const { user } = useAuth()
  const { profile } = useTrip()
  const { stat, mine, rows } = data
  const food = isFood(e.group_type)
  const aspects = useMemo(() => aspectsFor(e.group_type), [e.group_type])
  const catalog = useMemo(() => tagsFor(e.group_type), [e.group_type])

  const [tags, setTags] = useState<TagData>({ counts: [], mine: new Set() })
  const [menu, setMenu] = useState<MenuRow[]>([])
  const [showAllTags, setShowAllTags] = useState(false)
  const [showAspects, setShowAspects] = useState(false)
  const [newDish, setNewDish] = useState('')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [helped, setHelped] = useState(0)

  const author = {
    name: profile?.nickname ?? user?.email?.split('@')[0] ?? 'ผู้ใช้',
    color: profile?.avatar_color ?? null,
    photo: profile?.avatar_url ?? null,
    focus: profile?.avatar_focus ?? null,
  }

  async function loadSide() {
    const [t, m] = await Promise.all([getTags(e.id, user?.id), food ? getMenu(e.id, user?.id) : Promise.resolve([])])
    setTags(t); setMenu(m)
  }
  useEffect(() => { loadSide() }, [e.id, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // "your review helped N people" — only meaningful once I've actually rated
  useEffect(() => {
    if (!user || !mine) { setHelped(0); return }
    let active = true
    helpedCount(e.id, mine.created_at, user.id).then((n) => { if (active) setHelped(n) })
    return () => { active = false }
  }, [e.id, user?.id, mine?.created_at]) // eslint-disable-line react-hooks/exhaustive-deps

  // am I the earliest rating on this place?
  const firstReviewer = !!mine && rows.length > 0 &&
    rows.every((r) => r.user_id === user?.id || (r.created_at ?? '') >= (mine.created_at ?? ''))

  // once a star is in, open the sub-scores; before that they stay out of sight
  useEffect(() => { if (mine) setShowAspects(true) }, [mine?.user_id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function rate(patch: RatingPatch) {
    if (!user) return
    setSaving(true)
    const first = !mine
    const res = await setRating(e.id, user.id, mine, patch, author)
    setSaving(false)
    if (res.error) { toast.error('บันทึกคะแนนไม่สำเร็จ'); return }
    await onChanged()
    if (first) toast.success(stat.count === 0 ? 'ขอบคุณ! คุณเป็นคนแรกที่รีวิวที่นี่ 🏅' : 'บันทึกคะแนนแล้ว ขอบคุณ!')
  }
  /** one sub-score; `null` clears it back to "ไม่ได้ให้" */
  function rateAspect(key: AspectKey, v: number | null) {
    const patch: RatingPatch = {}
    patch[key] = v
    return rate(patch)
  }

  async function removeMine() {
    if (!user || !mine) return
    if (!(await confirmDialog({ message: 'ลบคะแนนของคุณออกจากที่นี่?', danger: true, confirmLabel: 'ลบคะแนน' }))) return
    await clearRating(e.id, user.id)
    await onChanged()
  }

  async function tapTag(key: string) {
    if (!user) return
    const on = !tags.mine.has(key)
    // optimistic — a tag tap has to feel instant or nobody taps a second one
    setTags((t) => {
      const m = new Set(t.mine)
      if (on) m.add(key); else m.delete(key)
      const counts = [...t.counts]
      const i = counts.findIndex((c) => c.key === key)
      if (i >= 0) counts[i] = { ...counts[i], n: counts[i].n + (on ? 1 : -1) }
      else if (on) counts.push({ key, n: 1 })
      return { counts: counts.filter((c) => c.n > 0).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key)), mine: m }
    })
    const res = await toggleTag(e.id, user.id, key, on)
    if (res.error) { toast.error('บันทึกแท็กไม่สำเร็จ'); loadSide() }
  }

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
  const shownTags = showAllTags
    ? catalog.map((t) => t.key).concat(tags.counts.map((c) => c.key).filter((k) => !catalog.some((t) => t.key === k)))
    : tags.counts.map((c) => c.key)
  const topDish = menu[0]

  return (
    <div>
      {/* ── summary: the average people actually gave ── */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <div className="text-center shrink-0 w-[86px]">
            <div className="text-[34px] font-extrabold leading-none tabular-nums" style={stat.count === 0 ? { color: 'var(--color-ink-3)' } : undefined}>
              {stat.count === 0 ? '–' : stat.avg.toFixed(1)}
            </div>
            <div className="mt-1"><StarRating rating={stat.avg} size={14} empty={stat.count === 0} /></div>
            <div className="text-[11px] text-ink-3 mt-1">{stat.count > 0 ? `${stat.count} คะแนน` : 'ยังไม่มีคะแนน'}</div>
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

        {/* per-aspect averages — only once somebody has scored an aspect */}
        {anyAspect && (
          <div className="mt-4 pt-3.5 space-y-2" style={{ borderTop: '0.5px solid var(--color-line)' }}>
            {aspects.map((a) => (
              <AspectBar key={a.key} label={a.label} hint={a.hint} value={stat.aspects[a.key].avg} count={stat.aspects[a.key].count} />
            ))}
          </div>
        )}
      </div>

      {/* ── my rating ── */}
      {user && (
        <div className={`card p-4 ${gap}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[13px] font-semibold text-ink-2">{mine ? 'คะแนนของคุณ' : 'ให้คะแนนที่นี่'}</span>
            {!mine && stat.count === 0 && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)' }}>
                <IconSparkles size={11} /> เป็นคนแรก
              </span>
            )}
            {saving && <IconLoader2 size={14} className="animate-spin text-ink-3 ml-auto" />}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <StarInput value={mine?.stars ?? null} onChange={(n) => rate({ stars: n })} size={compact ? 26 : 30}
              label={`ให้คะแนน ${e.name ?? 'ที่นี่'}`} />
            {mine && (
              <button onClick={removeMine} className="text-[11.5px] text-ink-3 hover:text-booking ml-auto inline-flex items-center gap-1">
                <IconTrash size={13} /> ลบคะแนน
              </button>
            )}
          </div>
          {!mine && <div className="text-[11.5px] text-ink-3 mt-1.5">แตะดาวเพื่อให้คะแนน — คะแนนแยกด้านจะโผล่มาหลังจากนั้น</div>}

          {/* sub-scores: hidden until an overall star exists, so the first ask
              is one tap and nothing more */}
          {mine && (
            <div className="mt-3 pt-3" style={{ borderTop: '0.5px solid var(--color-line)' }}>
              <button onClick={() => setShowAspects((s) => !s)}
                className="w-full flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
                ให้คะแนนแยกด้าน <span className="text-ink-3 font-normal">(ไม่บังคับ)</span>
                <IconChevronDown size={15} className={['ml-auto transition-transform', showAspects ? 'rotate-180' : ''].join(' ')} />
              </button>
              {showAspects && (
                <div className="mt-2.5 space-y-2">
                  {aspects.map((a) => (
                    <div key={a.key} className="flex items-center gap-2">
                      <div className="w-[78px] shrink-0">
                        <div className="text-[12px] text-ink-2 leading-tight">{a.label}</div>
                        {a.hint && <div className="text-[9.5px] text-ink-3 leading-tight">{a.hint}</div>}
                      </div>
                      <StarInput value={mine[a.key] ?? null} size={18} label={a.label}
                        onChange={(n) => rateAspect(a.key, n)} />
                      {mine[a.key] != null && (
                        <button onClick={() => rateAspect(a.key, null)}
                          className="text-[10.5px] text-ink-3 hover:text-booking ml-auto">ล้าง</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* what my review did — the reason to come back */}
          {mine && (helped > 0 || firstReviewer) && (
            <div className="mt-3 pt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px]" style={{ borderTop: '0.5px solid var(--color-line)' }}>
              {firstReviewer && (
                <span className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--color-brand-dark)' }}>
                  <IconTrophy size={13} /> คุณเป็นคนแรกที่รีวิวที่นี่
                </span>
              )}
              {helped > 0 && (
                <span className="inline-flex items-center gap-1 text-ink-2">
                  <IconUsers size={13} className="text-brand" /> รีวิวของคุณช่วยคนที่เปิดดูที่นี่ <b className="tabular-nums">{helped}</b> คน
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── one-tap tags ── */}
      <div className={gap}>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[13px] font-semibold text-ink-2">ที่นี่เป็นยังไง</span>
          <span className="text-[11px] text-ink-3">· แตะเพื่อเห็นด้วย</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {shownTags.map((key) => {
            const def = tagDef(key)
            const n = tags.counts.find((c) => c.key === key)?.n ?? 0
            const on = tags.mine.has(key)
            return (
              <button key={key} onClick={() => tapTag(key)} disabled={!user}
                className="inline-flex items-center gap-1 rounded-full px-2.5 h-8 text-[12px] font-medium transition disabled:opacity-50"
                style={on
                  ? { background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }
                  : { background: 'var(--color-surface-2)', color: 'var(--color-ink-2)', border: '0.5px solid transparent' }}>
                <span aria-hidden>{def.emoji}</span> {def.label}
                {n > 0 && <span className="tabular-nums text-[11px] opacity-70">{n}</span>}
                {on && <IconCheck size={12} />}
              </button>
            )
          })}
          {!showAllTags && (
            <button onClick={() => setShowAllTags(true)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 h-8 text-[12px] font-medium"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-brand)' }}>
              <IconPlus size={13} /> {tags.counts.length ? 'แท็กอื่น' : 'เพิ่มแท็ก'}
            </button>
          )}
        </div>
        {showAllTags && (
          <button onClick={() => setShowAllTags(false)} className="text-[11.5px] text-ink-3 mt-2 inline-flex items-center gap-1">
            พับเก็บ <IconChevronDown size={13} className="rotate-180" />
          </button>
        )}
      </div>

      {/* ── menu voting (restaurants) — "สั่งอะไรดี" ── */}
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
    </div>
  )
}
