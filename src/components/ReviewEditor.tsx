import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconX, IconTrash, IconLoader2, IconCheck, IconArrowLeft, IconThumbUp, IconThumbUpFilled,
  IconPlus, IconPhotoPlus, IconStarFilled, IconSearch,
} from '@tabler/icons-react'
import { StarRating } from './StarRating'
import { StarInput } from './StarInput'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { catMeta } from '@/lib/placeMeta'
import { uploadPublicImage } from '@/lib/files'
import { toast } from '@/lib/toast'
import {
  aspectsFor, tagsFor, tagDef, overallOf, aspectsScored, draftFrom, draftComplete, isFood,
  saveReview, emptyDraft, emptyMenuDraft, saveMenuPicks, getMenu,
  REVIEW_PHOTO_MAX,
  type ReviewDraft, type MenuDraft, type AspectKey, type MenuRow,
} from '@/lib/exploreReviews'
import type { ExplorePlace, ExploreRating } from '@/lib/database.types'

const BODY_MAX = 2000

/**
 * The review form — a full-screen flow, not a bottom sheet, because it's a
 * task you finish rather than a field you tweak.
 *
 *   1. tap the big star row once → the aspects and the tags drop in underneath.
 *      That one tap is already a complete review; the aspects stay blank and
 *      optional, because copying the tap into all four columns would invent
 *      per-aspect scores nobody gave. Score any of them and they take over as
 *      the headline number.
 *   2. write the review, attach photos, recommend dishes
 *   3. a thank-you screen
 *
 * Nothing is written until "ส่งรีวิว", so backing out leaves no trace. A 5★
 * overall can never sit on top of four bad aspects, because the moment any
 * aspect is scored the headline becomes the mean of the scored ones.
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

  const [step, setStep] = useState(0)          // 0 = score, 1 = write, 2 = done
  const [draft, setDraft] = useState<ReviewDraft>(emptyDraft)
  const [menu, setMenu] = useState<MenuRow[]>([])
  const [menuDraft, setMenuDraft] = useState<MenuDraft>(emptyMenuDraft)
  const [newDish, setNewDish] = useState('')
  const [dishQuery, setDishQuery] = useState('')
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)

  // reset to what's stored every time the flow opens — an abandoned edit must
  // not leak into the next one
  useEffect(() => {
    if (!open) return
    setStep(0)
    setDraft(draftFrom(mine, myTags))
    setNewDish(''); setDishQuery('')
    if (!food || !user) { setMenu([]); setMenuDraft(emptyMenuDraft()); return }
    getMenu(e.id, user.id).then((rows) => {
      setMenu(rows)
      setMenuDraft({ votes: rows.filter((r) => r.mine).map((r) => r.id), added: [] })
    })
  }, [open, mine?.user_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // lock the page behind the overlay so it can't scroll under us
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const overall = overallOf(draft)
  const complete = draftComplete(draft)
  const scored = aspectsScored(draft)
  const meta = catMeta(e.category)
  const Icon = meta.icon
  const prevVotes = useMemo(() => menu.filter((r) => r.mine).map((r) => r.id), [menu])

  /** The big row is the whole review on its own — it deliberately does NOT
   *  copy itself into the four aspect columns, so an aspect only ever holds a
   *  score somebody actually gave it. */
  const setOverall = (n: number) => setDraft((d) => ({ ...d, overall: n }))
  const setAspect = (k: AspectKey, v: number) => setDraft((d) => ({ ...d, [k]: v }))
  const clearAspect = (k: AspectKey) => setDraft((d) => ({ ...d, [k]: null }))
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

  async function onPickPhotos(ev: React.ChangeEvent<HTMLInputElement>) {
    const input = ev.target
    const files = Array.from(input.files ?? [])
    if (!files.length) return
    setUploading(true)
    let room = REVIEW_PHOTO_MAX - draft.photos.length
    for (const file of files) {
      if (room <= 0) break
      // 'review' keeps these out of the place's own photo folder
      const { url } = await uploadPublicImage(file, 'review')
      if (url) { setDraft((d) => ({ ...d, photos: [...d.photos, url] })); room-- }
    }
    setUploading(false)
    input.value = ''
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
    setStep(2)
  }

  if (!open) return null

  const thumb = (
    <span className="rounded-[12px] overflow-hidden bg-surface-2 grid place-items-center shrink-0 w-full h-full">
      {e.photo_url
        ? <img src={e.photo_url} alt="" className="w-full h-full object-cover" />
        : <span className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><Icon size={26} stroke={1.4} style={{ color: meta.fg }} /></span>}
    </span>
  )

  const dishes = menu.filter((r) => !dishQuery.trim() || r.name.toLowerCase().includes(dishQuery.trim().toLowerCase()))

  // ── the thank-you screen ────────────────────────────────────────────────
  if (step === 2) {
    return createPortal(
      <div className="fixed inset-0 z-[700] bg-canvas overflow-y-auto">
        <button onClick={onClose} aria-label="ปิด"
          className="absolute z-10 size-9 rounded-full bg-surface grid place-items-center text-ink-2 shadow-sm"
          style={{ top: 'calc(env(safe-area-inset-top,0px) + 12px)', left: 14 }}>
          <IconX size={18} />
        </button>
        <div className="max-w-[440px] mx-auto px-6 text-center" style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 90px)' }}>
          <div className="relative mx-auto w-[180px] h-[130px]">
            {/* confetti — plain dots, no artwork to ship */}
            {[['12%', '18%', '#FB7022'], ['84%', '10%', '#0270FB'], ['6%', '62%', '#2F8F6B'], ['90%', '58%', '#C24E7C'], ['46%', '4%', '#F5A623'], ['70%', '80%', '#7F77DD']].map(([l, t, c], i) => (
              <span key={i} className="absolute rounded-full animate-[slideup_.5s_ease]" style={{ left: l, top: t, width: 9, height: 9, background: c, animationDelay: `${i * 60}ms` }} />
            ))}
            <span className="absolute inset-0 grid place-items-center animate-[slideup_.35s_ease]">
              <IconStarFilled size={86} style={{ color: '#F5A623' }} />
            </span>
          </div>
          <div className="text-[21px] font-extrabold mt-5">ขอบคุณสำหรับรีวิว</div>
          <div className="text-[13px] text-ink-3 mt-1.5">รีวิวของคุณช่วยให้คนอื่นตัดสินใจได้ง่ายขึ้น</div>

          <div className="card p-3.5 flex items-center gap-3 mt-6 text-left">
            <span className="size-12 shrink-0">{thumb}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium truncate">{e.name}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <StarRating rating={overall} size={13} />
                <span className="text-[12px] font-bold tabular-nums">{overall.toFixed(1)}</span>
              </div>
            </div>
          </div>

          <button onClick={onClose} className="btn-primary w-full h-12 mt-6">เสร็จสิ้น</button>
        </div>
      </div>,
      document.body,
    )
  }

  // ── the form ────────────────────────────────────────────────────────────
  return createPortal(
    <div className="fixed inset-0 z-[700] bg-canvas flex flex-col">
      {/* top bar — the place identity collapses in here after the score step */}
      <div className="shrink-0 flex items-center gap-2.5 px-3.5 bg-canvas"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 10px)', paddingBottom: 10, borderBottom: step > 0 ? '0.5px solid var(--color-line)' : undefined }}>
        <button onClick={step > 0 ? () => setStep(step - 1) : onClose} aria-label={step > 0 ? 'ย้อนกลับ' : 'ปิด'}
          className="size-9 rounded-full grid place-items-center text-ink-2 shrink-0 hover:bg-surface-2">
          {step > 0 ? <IconArrowLeft size={20} /> : <IconX size={20} />}
        </button>
        {step > 0 && (
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold truncate leading-tight">{e.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <StarRating rating={overall} size={11} />
              <span className="text-[11px] font-bold tabular-nums">{overall.toFixed(1)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[480px] mx-auto px-5 pb-6">
          {step === 0 ? (
            <div className="text-center pt-6">
              <div className="size-[104px] mx-auto">{thumb}</div>
              <div className="text-[14px] text-ink-2 mt-3 truncate">{e.name}</div>
              <div className="text-[19px] font-extrabold mt-3">
                {food ? 'ให้คะแนนร้านนี้' : 'ให้คะแนนที่นี่'}
              </div>

              <div className="mt-3 flex justify-center" style={{ minHeight: 46 }}>
                {/* once any aspect is scored the breakdown owns the score, so
                    the big row stops being an input and just reports it */}
                {scored > 0
                  ? <StarRating rating={overall} size={34} />
                  : <StarInput value={draft.overall} onChange={setOverall} size={38} label={`ให้คะแนน ${e.name ?? 'ที่นี่'}`} />}
              </div>
              {overall > 0 && (
                <div className="text-[11.5px] text-ink-3 mt-1">
                  คะแนนรวม <b className="text-ink tabular-nums">{overall.toFixed(1)}</b>
                  {scored > 0 ? ` — เฉลี่ยจาก ${scored} ด้านที่ให้ไว้` : ' — ให้แยกด้านข้างล่างก็ได้ ถ้าอยากละเอียดกว่านี้'}
                </div>
              )}

              {/* everything below drops in only after the first tap */}
              {overall > 0 && (
                <div className="animate-[revealdown_.28s_ease] text-left mt-7">
                  <div className="text-center mb-3">
                    <div className="text-[15px] font-extrabold">ให้คะแนนแยกด้าน</div>
                    <div className="text-[11px] text-ink-3 mt-0.5">ไม่บังคับ · ด้านที่ให้ไว้จะกลายเป็นคะแนนรวมแทน</div>
                  </div>
                  <div className="card overflow-hidden">
                    {aspects.map((a, i) => (
                      <div key={a.key} className="flex items-center gap-2 pl-3.5 pr-2 py-2"
                        style={i > 0 ? { borderTop: '0.5px solid var(--color-line)' } : undefined}>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-medium leading-tight">{a.label}</div>
                          <div className="text-[10.5px] text-ink-3 leading-tight mt-0.5">{a.hint}</div>
                        </div>
                        {draft[a.key] != null && (
                          <button type="button" onClick={() => clearAspect(a.key)}
                            className="text-[10.5px] text-ink-3 hover:text-booking shrink-0">ล้าง</button>
                        )}
                        <StarInput value={draft[a.key]} onChange={(n) => setAspect(a.key, n)} size={21} label={a.label} />
                      </div>
                    ))}
                  </div>

                  <div className="text-[15px] font-extrabold text-center mt-7 mb-3">คุณประทับใจสิ่งใด?</div>
                  <div className="flex flex-wrap gap-1.5 justify-center">
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
                    {draft.tags.filter((k) => !catalog.some((t) => t.key === k)).map((k) => (
                      <button key={k} type="button" onClick={() => toggleTag(k)}
                        className="inline-flex items-center gap-1 rounded-full px-3 h-9 text-[12.5px] font-medium"
                        style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '1px solid var(--color-brand)' }}>
                        {tagDef(k).label}<IconCheck size={13} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="pt-5">
              {/* ── write ── */}
              <div className="text-[15px] font-extrabold">เขียนรีวิว</div>
              {draft.tags.length > 0 && (
                <div className="text-[11.5px] text-ink-3 mt-1">
                  หัวข้อแนะนำ: {draft.tags.map((k) => tagDef(k).label).join(' · ')}
                </div>
              )}
              <div className="relative mt-2">
                <textarea value={draft.body} rows={6} maxLength={BODY_MAX}
                  onChange={(ev) => setDraft((d) => ({ ...d, body: ev.target.value }))}
                  placeholder="เล่าให้ฟังหน่อยว่าเป็นยังไงบ้าง…"
                  className="w-full resize-none rounded-[12px] bg-surface px-3.5 py-3 pb-7 text-[13.5px] outline-none focus:ring-1 focus:ring-brand"
                  style={{ border: '0.5px solid var(--color-line-2)' }} />
                <span className="absolute bottom-2.5 right-3.5 text-[11px] text-ink-3 tabular-nums pointer-events-none">
                  {draft.body.length}/{BODY_MAX}
                </span>
              </div>

              {/* ── photos ── */}
              <div className="text-[15px] font-extrabold mt-6">แชร์โมเมนต์ดีๆ</div>
              <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
                {draft.photos.map((url) => (
                  <div key={url} className="relative shrink-0 w-24 h-24 rounded-[12px] overflow-hidden bg-surface-2">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button type="button" aria-label="เอารูปออก"
                      onClick={() => setDraft((d) => ({ ...d, photos: d.photos.filter((p) => p !== url) }))}
                      className="absolute top-1 right-1 size-6 rounded-full bg-black/55 text-white grid place-items-center">
                      <IconX size={13} />
                    </button>
                  </div>
                ))}
                {draft.photos.length < REVIEW_PHOTO_MAX && (
                  <label htmlFor="review-photo-input"
                    className="shrink-0 w-24 h-24 rounded-[12px] grid place-items-center cursor-pointer text-ink-3"
                    style={{ border: '1.5px dashed var(--color-line-2)' }}>
                    <span className="flex flex-col items-center gap-1">
                      {uploading ? <IconLoader2 size={20} className="animate-spin" /> : <IconPhotoPlus size={20} />}
                      <span className="text-[10.5px]">{draft.photos.length} จาก {REVIEW_PHOTO_MAX}</span>
                    </span>
                  </label>
                )}
                <input id="review-photo-input" ref={photoInput} type="file" accept="image/*" multiple hidden onChange={onPickPhotos} />
              </div>

              {/* ── dishes worth ordering ── */}
              {food && (
                <>
                  <div className="text-[15px] font-extrabold mt-6">สิ่งที่อยากแนะนำ</div>
                  <div className="text-[11.5px] text-ink-3 mt-0.5 mb-2">คนอื่นจะเห็นเป็นอันดับ “สั่งอะไรดี” ของร้านนี้</div>

                  {menu.length > 4 && (
                    <div className="flex items-center gap-2 h-10 rounded-[10px] bg-surface-2 px-3 mb-2">
                      <IconSearch size={15} className="text-ink-3 shrink-0" />
                      <input value={dishQuery} onChange={(ev) => setDishQuery(ev.target.value)} placeholder="ค้นหารายการ"
                        className="flex-1 bg-transparent text-[13px] outline-none" />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {dishes.map((row) => {
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
                  </div>

                  <div className="flex gap-2 mt-2">
                    <input value={newDish} onChange={(ev) => setNewDish(ev.target.value)}
                      onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); addDish() } }}
                      placeholder="พิมพ์ชื่อเมนูที่อยากแนะนำ…" maxLength={60}
                      className="flex-1 min-w-0 h-11 rounded-[10px] bg-surface-2 px-3 text-[13px] outline-none focus:ring-1 focus:ring-brand" />
                    <button type="button" onClick={addDish} disabled={!newDish.trim()}
                      className="inline-flex items-center gap-1 h-11 px-3.5 rounded-[10px] bg-brand text-white text-[12.5px] font-medium disabled:opacity-40 shrink-0">
                      <IconPlus size={15} /> เพิ่ม
                    </button>
                  </div>
                </>
              )}

              <div className="text-[11px] text-ink-3 text-center mt-6">รีวิวของคุณจะแสดงให้ทุกคนเห็น</div>
            </div>
          )}
        </div>
      </div>

      {/* sticky action bar */}
      <div className="shrink-0 px-5 pt-3 bg-canvas" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 14px)', boxShadow: '0 -10px 16px -12px rgba(0,0,0,.14)' }}>
        <div className="max-w-[480px] mx-auto">
          {step === 0 ? (
            <button onClick={() => setStep(1)} disabled={!complete} className="btn-primary w-full h-12 disabled:opacity-40">ต่อไป</button>
          ) : (
            <button onClick={submit} disabled={!complete || busy || uploading} className="btn-primary w-full h-12 disabled:opacity-40">
              {busy ? <IconLoader2 size={17} className="animate-spin" /> : mine ? 'บันทึกการแก้ไข' : 'ส่งรีวิว'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
