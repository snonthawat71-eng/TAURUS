import { useEffect, useMemo, useState } from 'react'
import { IconTrash, IconLoader2, IconCheck, IconArrowLeft, IconThumbUp, IconThumbUpFilled, IconPlus } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { StarRating } from './StarRating'
import { StarInput } from './StarInput'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { catMeta } from '@/lib/placeMeta'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import {
  aspectsFor, tagsFor, tagDef, overallOf, draftFrom, draftComplete, isFood,
  saveReview, clearRating, emptyDraft, emptyMenuDraft, saveMenuPicks, getMenu,
  type ReviewDraft, type MenuDraft, type AspectKey, type MenuRow,
} from '@/lib/exploreReviews'
import type { ExplorePlace, ExploreRating } from '@/lib/database.types'

type StepKey = 'score' | 'tags' | 'menu'

/**
 * The review form, as a short wizard: score → tags → dishes → send. Nothing is
 * written until the last button, so backing out of a half-filled review leaves
 * no trace.
 *
 * There is deliberately no "overall stars" control. The big star row at the top
 * of step 1 is the RESULT — the mean of the four aspects — and fills in as you
 * answer them. You can't hand a place 5★ overall while calling every aspect
 * terrible.
 */
export function ReviewEditor({ e, open, mine, myTags, onClose, onSaved }: {
  e: ExplorePlace
  open: boolean
  /** my existing review, if I'm editing one */
  mine: ExploreRating | null
  myTags: Iterable<string>
  onClose: () => void
  onSaved: () => void | Promise<void>
}) {
  const { user } = useAuth()
  const { profile } = useTrip()
  const food = isFood(e.group_type)
  const aspects = useMemo(() => aspectsFor(e.group_type), [e.group_type])
  const catalog = useMemo(() => tagsFor(e.group_type), [e.group_type])
  const STEPS: StepKey[] = useMemo(() => (food ? ['score', 'tags', 'menu'] : ['score', 'tags']), [food])

  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<ReviewDraft>(emptyDraft)
  const [menu, setMenu] = useState<MenuRow[]>([])
  const [menuDraft, setMenuDraft] = useState<MenuDraft>(emptyMenuDraft)
  const [newDish, setNewDish] = useState('')
  const [busy, setBusy] = useState(false)

  // reset to what's stored every time the sheet opens — an abandoned edit must
  // not leak into the next one
  useEffect(() => {
    if (!open) return
    setStep(0)
    setDraft(draftFrom(mine, myTags))
    setNewDish('')
    if (!food || !user) { setMenu([]); setMenuDraft(emptyMenuDraft()); return }
    getMenu(e.id, user.id).then((rows) => {
      setMenu(rows)
      setMenuDraft({ votes: rows.filter((r) => r.mine).map((r) => r.id), added: [] })
    })
  }, [open, mine?.user_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const overall = overallOf(draft)
  const complete = draftComplete(draft)
  const scored = ([draft.taste, draft.worth, draft.vibe, draft.queue] as (number | null)[]).filter(Boolean).length
  const key = STEPS[step]
  const last = step === STEPS.length - 1
  const meta = catMeta(e.category)
  const Icon = meta.icon
  const prevVotes = useMemo(() => menu.filter((r) => r.mine).map((r) => r.id), [menu])

  const setAspect = (k: AspectKey, v: number) => setDraft((d) => ({ ...d, [k]: v }))
  const toggleTag = (tag: string) => setDraft((d) => ({
    ...d, tags: d.tags.includes(tag) ? d.tags.filter((t) => t !== tag) : [...d.tags, tag],
  }))
  const toggleDish = (id: string) => setMenuDraft((m) => ({
    ...m, votes: m.votes.includes(id) ? m.votes.filter((v) => v !== id) : [...m.votes, id],
  }))
  function addDish() {
    const name = newDish.trim()
    if (!name) return
    const dupe = menu.some((r) => r.name.toLowerCase() === name.toLowerCase())
      || menuDraft.added.some((n) => n.toLowerCase() === name.toLowerCase())
    if (dupe) { setNewDish(''); return }
    setMenuDraft((m) => ({ ...m, added: [...m.added, name] }))
    setNewDish('')
  }

  async function submit() {
    if (!user || !complete || busy) return
    setBusy(true)
    const res = await saveReview(e.id, user.id, draft, myTags, {
      name: profile?.nickname ?? user.email?.split('@')[0] ?? 'ผู้ใช้',
      color: profile?.avatar_color ?? null,
      photo: profile?.avatar_url ?? null,
      focus: profile?.avatar_focus ?? null,
    })
    if (res.error) { setBusy(false); toast.error('บันทึกรีวิวไม่สำเร็จ — ลองใหม่อีกครั้ง'); return }
    if (food) await saveMenuPicks(e.id, user.id, prevVotes, menuDraft)
    setBusy(false)
    await onSaved()
    onClose()
    toast.success(mine ? 'แก้ไขรีวิวแล้ว' : 'ขอบคุณสำหรับรีวิว!')
  }

  async function remove() {
    if (!user || !mine || busy) return
    if (!(await confirmDialog({ message: 'ลบรีวิวของคุณออกจากที่นี่? แท็กที่คุณเลือกไว้จะถูกลบไปด้วย', danger: true, confirmLabel: 'ลบรีวิว' }))) return
    setBusy(true)
    await clearRating(e.id, user.id)
    setBusy(false)
    await onSaved()
    onClose()
  }

  const thumb = (
    <span className="rounded-[12px] overflow-hidden bg-surface-2 grid place-items-center shrink-0 w-full h-full">
      {e.photo_url
        ? <img src={e.photo_url} alt="" className="w-full h-full object-cover" />
        : <span className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><Icon size={26} stroke={1.4} style={{ color: meta.fg }} /></span>}
    </span>
  )

  return (
    <Drawer open={open} onClose={onClose} title={mine ? 'แก้ไขรีวิว' : 'เขียนรีวิว'}>
      {/* progress — same tappable segments as the expense wizard. Steps after
          the score can only be reached once the score is done. */}
      <div className="flex gap-1 mb-4">
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => (i === 0 || complete) && setStep(i)} aria-label={`ขั้นที่ ${i + 1}`}
            className="flex-1 h-1.5 rounded-full transition-colors"
            style={{ background: i <= step ? 'var(--color-brand)' : 'var(--color-surface-2)' }} />
        ))}
      </div>

      {key === 'score' ? (
        /* ── 1. the four aspects, with the derived score as the hero ── */
        <div className="text-center">
          <div className="size-[84px] mx-auto">{thumb}</div>
          <div className="text-[14px] font-medium mt-2.5 truncate">{e.name}</div>
          <div className="mt-2.5 flex justify-center"><StarRating rating={overall} size={30} empty={!overall} /></div>
          <div className="text-[11.5px] text-ink-3 mt-2">
            {complete
              ? <>คะแนนรวม <b className="text-ink tabular-nums">{overall.toFixed(1)}</b> — เฉลี่ยจากทั้ง 4 ด้าน</>
              : `ให้ดาวทีละด้าน แล้วคะแนนรวมคิดให้เอง · เหลืออีก ${4 - scored} ด้าน`}
          </div>

          <div className="card overflow-hidden mt-4 text-left">
            {aspects.map((a, i) => (
              <div key={a.key} className="flex items-center gap-2 pl-3.5 pr-2 py-2"
                style={i > 0 ? { borderTop: '0.5px solid var(--color-line)' } : undefined}>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium leading-tight">{a.label}</div>
                  <div className="text-[10.5px] text-ink-3 leading-tight mt-0.5">{a.hint}</div>
                </div>
                <StarInput value={draft[a.key]} onChange={(n) => setAspect(a.key, n)} size={21} label={a.label} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* every later step keeps a compact reminder of what's being reviewed */
        <>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="size-10 shrink-0">{thumb}</span>
            <div className="min-w-0">
              <div className="text-[13.5px] font-medium truncate">{e.name}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <StarRating rating={overall} size={12} />
                <span className="text-[11px] font-bold tabular-nums">{overall.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {key === 'tags' ? (
            /* ── 2. one-tap tags ── */
            <>
              <div className="text-[15px] font-semibold mb-0.5">ที่นี่เป็นยังไง?</div>
              <div className="text-[11.5px] text-ink-3 mb-3">เลือกได้หลายอัน · ข้ามได้ถ้าไม่มีอะไรตรง</div>
              <div className="flex flex-wrap gap-1.5">
                {catalog.map((t) => {
                  const on = draft.tags.includes(t.key)
                  return (
                    <button key={t.key} type="button" onClick={() => toggleTag(t.key)}
                      className="inline-flex items-center gap-1 rounded-full px-3 h-9 text-[12.5px] font-medium transition"
                      style={on
                        ? { background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '1px solid var(--color-brand)' }
                        : { background: 'var(--color-surface)', color: 'var(--color-ink-2)', border: '0.5px solid var(--color-line-2)' }}>
                      {t.label}{on && <IconCheck size={13} />}
                    </button>
                  )
                })}
                {/* tags I picked before that are no longer in the catalog */}
                {draft.tags.filter((k) => !catalog.some((t) => t.key === k)).map((k) => (
                  <button key={k} type="button" onClick={() => toggleTag(k)}
                    className="inline-flex items-center gap-1 rounded-full px-3 h-9 text-[12.5px] font-medium"
                    style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '1px solid var(--color-brand)' }}>
                    {tagDef(k).label}<IconCheck size={13} />
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* ── 3. dishes worth ordering (restaurants only) ── */
            <>
              <div className="text-[15px] font-semibold mb-0.5">มีเมนูไหนที่อยากแนะนำ?</div>
              <div className="text-[11.5px] text-ink-3 mb-3">คนอื่นจะเห็นเป็นอันดับ “สั่งอะไรดี” ของร้านนี้</div>

              <div className="space-y-1.5">
                {menu.map((row) => {
                  const on = menuDraft.votes.includes(row.id)
                  return (
                    <button key={row.id} type="button" onClick={() => toggleDish(row.id)}
                      className="w-full flex items-center gap-2 px-3 h-12 rounded-[11px] text-left transition"
                      style={on
                        ? { background: 'var(--color-brand-soft)', border: '1px solid var(--color-brand)' }
                        : { background: 'var(--color-surface)', border: '0.5px solid var(--color-line-2)' }}>
                      <span className="flex-1 min-w-0 truncate text-[13px] font-medium">{row.name}</span>
                      <span className="text-[11px] text-ink-3 tabular-nums shrink-0">{row.votes}</span>
                      <span className="shrink-0" style={{ color: on ? 'var(--color-brand)' : 'var(--color-ink-3)' }}>
                        {on ? <IconThumbUpFilled size={18} /> : <IconThumbUp size={18} />}
                      </span>
                    </button>
                  )
                })}
                {menuDraft.added.map((name) => (
                  <div key={name} className="w-full flex items-center gap-2 px-3 h-12 rounded-[11px]"
                    style={{ background: 'var(--color-brand-soft)', border: '1px solid var(--color-brand)' }}>
                    <span className="flex-1 min-w-0 truncate text-[13px] font-medium">{name}</span>
                    <span className="text-[10.5px] text-ink-3 shrink-0">เพิ่มใหม่</span>
                    <button type="button" aria-label="เอาออก" className="shrink-0 text-ink-3"
                      onClick={() => setMenuDraft((m) => ({ ...m, added: m.added.filter((n) => n !== name) }))}>
                      <IconTrash size={15} />
                    </button>
                  </div>
                ))}
                {menu.length === 0 && menuDraft.added.length === 0 && (
                  <div className="text-[12px] text-ink-3 py-1">ยังไม่มีใครบอกว่าเมนูไหนเด็ด — เพิ่มเมนูแรกเลย</div>
                )}
              </div>

              <div className="flex gap-2 mt-2.5">
                <input value={newDish} onChange={(ev) => setNewDish(ev.target.value)}
                  onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); addDish() } }}
                  placeholder="พิมพ์ชื่อเมนู…" maxLength={60}
                  className="flex-1 min-w-0 h-11 rounded-[10px] bg-surface-2 px-3 text-[13px] outline-none focus:ring-1 focus:ring-brand" />
                <button type="button" onClick={addDish} disabled={!newDish.trim()}
                  className="inline-flex items-center gap-1 h-11 px-3.5 rounded-[10px] bg-brand text-white text-[12.5px] font-medium disabled:opacity-40 shrink-0">
                  <IconPlus size={15} /> เพิ่ม
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* sticky action bar — the primary button stays reachable on every step */}
      <div className="sticky bottom-0 -mx-5 -mb-5 px-5 pt-3 pb-5 mt-5 bg-surface">
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)}
              className="h-11 px-4 rounded-full inline-flex items-center gap-1 text-[13px] font-medium text-ink-2 shrink-0"
              style={{ background: 'var(--color-surface-2)' }}>
              <IconArrowLeft size={16} /> ย้อนกลับ
            </button>
          )}
          {last ? (
            <button onClick={submit} disabled={!complete || busy} className="btn-primary flex-1 h-11 disabled:opacity-50">
              {busy ? <IconLoader2 size={16} className="animate-spin" /> : mine ? 'บันทึกการแก้ไข' : 'ส่งรีวิว'}
            </button>
          ) : (
            <button onClick={() => setStep(step + 1)} disabled={!complete} className="btn-primary flex-1 h-11 disabled:opacity-50">
              {complete ? 'ต่อไป' : `ให้ดาวอีก ${4 - scored} ด้าน`}
            </button>
          )}
        </div>
        {mine && last && (
          <button onClick={remove} disabled={busy} className="w-full h-9 flex items-center justify-center gap-1.5 text-[12.5px] mt-1" style={{ color: '#D85A30' }}>
            <IconTrash size={14} /> ลบรีวิวของฉัน
          </button>
        )}
      </div>
    </Drawer>
  )
}
