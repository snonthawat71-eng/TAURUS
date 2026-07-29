import { useEffect, useMemo, useState } from 'react'
import { IconTrash, IconLoader2, IconCheck, IconSparkles } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { StarRating } from './StarRating'
import { StarInput } from './StarInput'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/contexts/TripContext'
import { toast } from '@/lib/toast'
import { confirmDialog } from '@/lib/confirm'
import {
  aspectsFor, tagsFor, tagDef, overallOf, draftFrom, draftComplete,
  saveReview, clearRating, emptyDraft,
  type ReviewDraft, type AspectKey,
} from '@/lib/exploreReviews'
import type { ExplorePlace, ExploreRating } from '@/lib/database.types'

/**
 * The review form. Fill it in, submit once, done — nothing writes as you tap,
 * which is why the tag picker lives in here rather than as a live tag wall.
 *
 * There is deliberately no "overall stars" control: the headline score is the
 * mean of the four aspects, shown live at the top as you score them. You can't
 * hand a place 5★ overall while calling every aspect terrible.
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
  const aspects = useMemo(() => aspectsFor(e.group_type), [e.group_type])
  const catalog = useMemo(() => tagsFor(e.group_type), [e.group_type])

  const [draft, setDraft] = useState<ReviewDraft>(emptyDraft)
  const [busy, setBusy] = useState(false)

  // reset to what's stored every time the sheet opens — an abandoned edit must
  // not leak into the next one
  useEffect(() => { if (open) setDraft(draftFrom(mine, myTags)) }, [open, mine?.user_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const overall = overallOf(draft)
  const complete = draftComplete(draft)
  const scored = ([draft.taste, draft.worth, draft.vibe, draft.queue] as (number | null)[]).filter(Boolean).length

  const setAspect = (k: AspectKey, v: number) => setDraft((d) => ({ ...d, [k]: v }))
  const toggleTag = (key: string) => setDraft((d) => ({
    ...d, tags: d.tags.includes(key) ? d.tags.filter((t) => t !== key) : [...d.tags, key],
  }))

  async function submit() {
    if (!user || !complete || busy) return
    setBusy(true)
    const res = await saveReview(e.id, user.id, draft, myTags, {
      name: profile?.nickname ?? user.email?.split('@')[0] ?? 'ผู้ใช้',
      color: profile?.avatar_color ?? null,
      photo: profile?.avatar_url ?? null,
      focus: profile?.avatar_focus ?? null,
    })
    setBusy(false)
    if (res.error) { toast.error('บันทึกรีวิวไม่สำเร็จ — ลองใหม่อีกครั้ง'); return }
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

  return (
    <Drawer open={open} onClose={onClose} title={mine ? 'แก้ไขรีวิว' : 'เขียนรีวิว'}>
      <div className="text-[12px] text-ink-3 -mt-1 mb-3.5 truncate">{e.name}</div>

      {/* live headline — the number people will see, computed as you score */}
      <div className="rounded-[14px] px-4 py-3.5 flex items-center gap-3.5"
        style={{ background: 'var(--color-surface-2)' }}>
        <div className="text-[36px] font-extrabold leading-none tabular-nums w-[74px] shrink-0 text-center"
          style={overall ? undefined : { color: 'var(--color-ink-3)' }}>
          {overall ? overall.toFixed(1) : '–'}
        </div>
        <div className="min-w-0">
          <StarRating rating={overall} size={16} empty={!overall} />
          <div className="text-[11px] text-ink-3 mt-1.5 leading-tight">
            {complete
              ? 'คะแนนรวม — เฉลี่ยจากทั้ง 4 ด้าน'
              : `คะแนนรวมคิดให้อัตโนมัติ · ให้ครบอีก ${4 - scored} ด้าน`}
          </div>
        </div>
      </div>

      {/* the four aspects — the only thing you actually tap */}
      <div className="text-[11px] font-medium text-ink-3 mt-4 mb-1.5">ให้คะแนนแต่ละด้าน</div>
      <div className="card overflow-hidden">
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

      {/* tags — part of the same submit, not a live poll */}
      <div className="text-[11px] font-medium text-ink-3 mt-4 mb-1.5">
        แท็ก <span className="font-normal">· เลือกได้หลายอัน (ไม่บังคับ)</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {catalog.map((t) => {
          const on = draft.tags.includes(t.key)
          return (
            <button key={t.key} type="button" onClick={() => toggleTag(t.key)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 h-8 text-[12px] font-medium transition"
              style={on
                ? { background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }
                : { background: 'var(--color-surface-2)', color: 'var(--color-ink-2)', border: '0.5px solid transparent' }}>
              {t.label}{on && <IconCheck size={12} />}
            </button>
          )
        })}
      </div>
      {/* keep tags the user picked that are no longer in the catalog */}
      {draft.tags.filter((k) => !catalog.some((t) => t.key === k)).map((k) => (
        <button key={k} type="button" onClick={() => toggleTag(k)}
          className="inline-flex items-center gap-1 rounded-full px-2.5 h-8 text-[12px] font-medium mt-1.5 mr-1.5"
          style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }}>
          {tagDef(k).label}<IconCheck size={12} />
        </button>
      ))}

      <button onClick={submit} disabled={!complete || busy} className="btn-primary w-full h-11 mt-5 disabled:opacity-50">
        {busy ? <IconLoader2 size={16} className="animate-spin" /> : mine ? 'บันทึกการแก้ไข' : 'ส่งรีวิว'}
      </button>
      {!complete && (
        <div className="text-[11px] text-ink-3 text-center mt-2 inline-flex items-center justify-center gap-1 w-full">
          <IconSparkles size={12} /> ให้ดาวครบทั้ง 4 ด้านก่อนถึงส่งได้
        </div>
      )}
      {mine && (
        <button onClick={remove} disabled={busy} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] mt-1" style={{ color: '#D85A30' }}>
          <IconTrash size={15} /> ลบรีวิวของฉัน
        </button>
      )}
    </Drawer>
  )
}
