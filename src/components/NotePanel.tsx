import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconNotes, IconX, IconPencil, IconTrash, IconChevronLeft, IconChevronRight, IconLoader2, IconPlus,
  IconListCheck, IconNote, IconLock, IconUsers, IconArrowLeft,
} from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { listNotes, addNote, updateNote, deleteNote, isNotesMissing, type NoteInsert } from '@/lib/noteMutations'
import { STATUS_META, STATUS_ORDER, StatusIcon } from './NoteStatus'
import { confirmDialog } from '@/lib/confirm'
import { toast } from '@/lib/toast'
import type { TripNote, NoteKind, TodoItem } from '@/lib/database.types'

const OPEN_THRESHOLD = 90 // px of pull before releasing opens the panel

/** The liquid tongue: a sheet anchored to the right edge whose left border
 *  bulges toward the finger (classic "liquid swipe" reveal). */
function liquidPath(pull: number, y: number) {
  const W = window.innerWidth, H = window.innerHeight
  const edge = W - pull * 0.2
  const apex = W - Math.min(pull, W * 0.6)
  const R = 60 + pull * 0.45
  const top = Math.max(0, y - R), bottom = Math.min(H, y + R)
  return [
    `M ${W} 0`, `L ${edge} 0`, `L ${edge} ${top}`,
    `C ${edge} ${y - R * 0.45}, ${apex} ${y - R * 0.45}, ${apex} ${y}`,
    `C ${apex} ${y + R * 0.45}, ${edge} ${y + R * 0.45}, ${edge} ${bottom}`,
    `L ${edge} ${H}`, `L ${W} ${H}`, 'Z',
  ].join(' ')
}

/** The resting pull handle: a wavy tab budding off the right edge — pinched at
 *  top & bottom, bulging out at the middle (a liquid-drip silhouette). */
function handlePath(w: number, h: number) {
  return [
    `M ${w} 0`,
    `C ${w * 0.15} ${h * 0.10}, ${w} ${h * 0.32}, 0 ${h * 0.5}`,
    `C ${w} ${h * 0.68}, ${w * 0.15} ${h * 0.90}, ${w} ${h}`,
    'Z',
  ].join(' ')
}

function noteTime(iso: string) {
  try { return new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

const uid = () => crypto.randomUUID()
function blankNote(kind: NoteKind): TripNote {
  return {
    id: uid(), trip_id: '', kind, title: '', status: 'draft', shared: false,
    body: kind === 'note' ? '' : null,
    items: kind === 'todo' ? [{ id: uid(), text: '', done: false }] : null,
    created_at: new Date().toISOString(),
  }
}

export function NotePanel() {
  const { trip, memberProfiles } = useTrip()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [drag, setDrag] = useState<{ pull: number; y: number } | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const raf = useRef(0)

  const [notes, setNotes] = useState<TripNote[]>([])
  const [loading, setLoading] = useState(false)
  const [missing, setMissing] = useState(false)
  const [editing, setEditing] = useState<TripNote | null>(null) // editor view when set
  const [isNew, setIsNew] = useState(false)

  async function load() {
    if (!trip) return
    setLoading(true)
    const { data, error } = await listNotes(trip.id)
    if (error) { if (isNotesMissing(error.message)) setMissing(true); else toast.error(error.message) }
    else { setMissing(false); setNotes((data ?? []) as TripNote[]) }
    setLoading(false)
  }
  useEffect(() => { if (open) load() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [open, trip?.id])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (editing) setEditing(null); else setOpen(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, editing])

  // ----- liquid drag from the edge handle -----
  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, y: e.clientY }
    cancelAnimationFrame(raf.current)
  }
  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!start.current) return
    setDrag({ pull: Math.max(0, start.current.x - e.clientX), y: e.clientY })
  }
  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (!start.current) return
    const pull = Math.max(0, start.current.x - e.clientX)
    start.current = null
    if (pull >= OPEN_THRESHOLD || pull < 8) { setDrag(null); setOpen(true); return }
    const y = e.clientY, t0 = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 150)
      if (k < 1) { setDrag({ pull: pull * (1 - k) * (1 - k), y }); raf.current = requestAnimationFrame(step) }
      else setDrag(null)
    }
    raf.current = requestAnimationFrame(step)
  }

  const myProfile = memberProfiles.find((p) => p.id === user?.id)

  function startNew(kind: NoteKind) {
    setEditing(blankNote(kind))
    setIsNew(true)
  }
  function startEdit(n: TripNote) { setEditing({ ...n }); setIsNew(false) }

  async function saveEditing(n: TripNote) {
    if (!trip) return
    const title = (n.title ?? '').trim()
    const items = (n.items ?? []).filter((it) => it.text.trim()).map((it) => ({ ...it, text: it.text.trim() }))
    if (!title && !((n.body ?? '').trim()) && !items.length) { toast.error('ใส่หัวข้อหรือเนื้อหาก่อนบันทึก'); return }
    const payload: NoteInsert = {
      kind: n.kind, title: title || null, status: n.status, shared: !!n.shared,
      body: n.kind === 'note' ? (n.body ?? '') : null,
      items: n.kind === 'todo' ? items : null,
    }
    const res = isNew
      ? await addNote(trip.id, payload, myProfile?.nickname ?? null, myProfile?.avatar_color ?? null)
      : await updateNote(n.id, payload)
    if (res.error) { if (isNotesMissing(res.error.message)) setMissing(true); else toast.error(`บันทึกไม่สำเร็จ: ${res.error.message}`); return }
    setEditing(null)
    await load()
  }

  async function patchNote(n: TripNote, patch: Partial<TripNote>) {
    setNotes((cur) => cur.map((x) => (x.id === n.id ? { ...x, ...patch } : x))) // optimistic
    const { error } = await updateNote(n.id, patch)
    if (error) { toast.error(`อัปเดตไม่สำเร็จ: ${error.message}`); load() }
  }
  async function removeNote(n: TripNote) {
    if (!(await confirmDialog({ message: `ลบ "${n.title || 'รายการนี้'}"?`, danger: true, confirmLabel: 'ลบ' }))) return
    setNotes((cur) => cur.filter((x) => x.id !== n.id))
    const { error } = await deleteNote(n.id)
    if (error) { toast.error(`ลบไม่สำเร็จ: ${error.message}`); load() }
  }
  function toggleItem(n: TripNote, itemId: string) {
    const items = (n.items ?? []).map((it) => (it.id === itemId ? { ...it, done: !it.done } : it))
    patchNote(n, { items })
  }

  if (!trip) return null

  return (
    <>
      {/* edge handle — tap or drag left */}
      {!open && (
        <button
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          onPointerCancel={() => { start.current = null; setDrag(null) }}
          className="fixed right-0 top-[44%] z-[70] grid place-items-center text-ink-3 select-none"
          style={{ width: 22, height: 104, opacity: drag ? 0 : 1, touchAction: 'none' }}
          aria-label="โน้ตทริป — แตะหรือลากออกมา">
          <svg width="22" height="104" viewBox="0 0 22 104" className="absolute inset-0" style={{ filter: 'drop-shadow(-3px 0 8px rgba(15,30,60,.16))' }}>
            <path d={handlePath(22, 104)} fill="var(--color-surface)" stroke="var(--color-line)" strokeWidth="0.5" />
          </svg>
          <IconChevronLeft size={16} className="relative -ml-1" />
        </button>
      )}

      {/* liquid tongue while dragging */}
      {drag && drag.pull > 0 && createPortal(
        <>
          <div className="fixed inset-0 z-[98] pointer-events-none" style={{ background: `rgba(10,20,35,${Math.min(0.18, drag.pull / 900)})` }} />
          <svg className="fixed inset-0 z-[99] pointer-events-none" width="100%" height="100%" style={{ filter: 'drop-shadow(-4px 0 14px rgba(15,30,60,.22))' }}>
            <path d={liquidPath(drag.pull, drag.y)} fill="var(--color-surface)" />
          </svg>
          <IconChevronLeft size={18} className="fixed z-[100] pointer-events-none text-ink-3"
            style={{ left: window.innerWidth - Math.min(drag.pull, window.innerWidth * 0.6) + 4, top: drag.y - 9, opacity: Math.min(1, drag.pull / 50) }} />
        </>,
        document.body,
      )}

      {/* the sheet */}
      {open && createPortal(
        <div className="fixed inset-0 z-[100]" role="presentation">
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px] animate-[toast-in_.15s_ease-out]" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-[min(90vw,380px)] bg-canvas shadow-2xl flex flex-col animate-[note-in_.24s_cubic-bezier(.22,1,.36,1)]"
            role="dialog" aria-modal="true" aria-label="โน้ตทริป">

            {editing ? (
              <NoteEditor note={editing} isNew={isNew} onChange={setEditing} onBack={() => setEditing(null)}
                onSave={() => saveEditing(editing)} onDelete={!isNew ? () => { removeNote(editing); setEditing(null) } : undefined} />
            ) : (
              <>
                <header className="flex items-center gap-2 px-4 h-14 shrink-0 text-white" style={{ background: 'var(--color-brand)' }}>
                  <IconNotes size={18} />
                  <h2 className="text-[14.5px] font-semibold flex-1">โน้ตของฉัน</h2>
                  {/* two icon-only add buttons — pick note or to-do straight away */}
                  <button onClick={() => startNew('note')} className="grid place-items-center size-8 rounded-full bg-white/20 hover:bg-white/30" aria-label="เพิ่ม Note" title="เพิ่ม Note"><IconNote size={17} /></button>
                  <button onClick={() => startNew('todo')} className="grid place-items-center size-8 rounded-full bg-white/20 hover:bg-white/30" aria-label="เพิ่ม To-do" title="เพิ่ม To-do"><IconListCheck size={17} /></button>
                  <button onClick={() => setOpen(false)} className="grid place-items-center size-8 rounded-full hover:bg-white/15 ml-0.5" aria-label="ปิด"><IconX size={17} /></button>
                </header>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {missing ? (
                    <div className="card p-4 text-[12.5px] text-ink-2 leading-relaxed">
                      ⚙️ ยังไม่ได้เปิดใช้ / อัปเกรดโน้ต — รัน SQL <code className="text-[11.5px] bg-surface-2 rounded px-1">supabase/notes.sql</code> ใน Supabase SQL Editor ก่อน แล้วเปิดแผงนี้ใหม่
                    </div>
                  ) : loading && notes.length === 0 ? (
                    <div className="grid place-items-center py-10 text-ink-3"><IconLoader2 size={20} className="animate-spin" /></div>
                  ) : notes.length === 0 ? (
                    <div className="text-center py-12">
                      <IconNotes size={26} className="mx-auto text-ink-3" />
                      <p className="text-[12.5px] text-ink-3 mt-2">ยังไม่มีรายการ — แตะไอคอน 📝 / ✅ ด้านบนเพื่อเพิ่ม</p>
                    </div>
                  ) : notes.map((n) => (
                    <NoteCard key={n.id} note={n} mine={!!user && n.user_id === user.id}
                      onEdit={() => startEdit(n)} onDelete={() => removeNote(n)}
                      onCycleStatus={() => {
                        const i = STATUS_ORDER.indexOf(n.status)
                        patchNote(n, { status: STATUS_ORDER[(i + 1) % STATUS_ORDER.length] })
                      }}
                      onToggleShare={() => patchNote(n, { shared: !n.shared })}
                      onToggleItem={(id) => toggleItem(n, id)} />
                  ))}
                </div>
              </>
            )}
          </aside>
        </div>,
        document.body,
      )}
    </>
  )
}

// ---------------------------------------------------------------- card ------

function NoteCard({ note, mine, onEdit, onDelete, onCycleStatus, onToggleShare, onToggleItem }: {
  note: TripNote
  mine: boolean
  onEdit: () => void
  onDelete: () => void
  onCycleStatus: () => void
  onToggleShare: () => void
  onToggleItem: (id: string) => void
}) {
  const items = note.items ?? []
  const done = items.filter((it) => it.done).length
  const m = STATUS_META[note.status]
  return (
    <div className="relative flex flex-col">
      {/* status-tinted strip peeks out the top with rounded corners; the white
          card overlaps it (layered look, like the itinerary day cards) */}
      <div className="relative -mb-3 pt-1.5 pb-4 px-3 rounded-t-[14px] flex items-center gap-1.5" style={{ background: m.bg }}>
        {/* tap to advance status → chevron hints it's changeable (mine only) */}
        <button onClick={mine ? onCycleStatus : undefined} disabled={!mine}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold active:scale-95 transition-transform" style={{ color: m.color }}>
          <StatusIcon status={note.status} size={15} /> {m.label}
          {mine && <IconChevronRight size={13} className="opacity-70 -ml-0.5" />}
        </button>
        <span className="ml-auto flex items-center gap-1 shrink-0">
          {mine ? (
            <button onClick={onToggleShare}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10.5px] font-medium bg-white/70"
              style={{ color: note.shared ? 'var(--color-brand-dark)' : 'var(--color-ink-3)' }}>
              {note.shared ? <><IconUsers size={12} /> แชร์แล้ว</> : <><IconLock size={12} /> ส่วนตัว</>}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10.5px] font-medium bg-white/70" style={{ color: 'var(--color-brand-dark)' }}>
              <IconUsers size={12} /> แชร์
            </span>
          )}
          {mine && (
            <>
              <button onClick={onEdit} className="grid place-items-center size-6 rounded-md text-ink-3 hover:bg-white/60" aria-label="แก้ไข"><IconPencil size={13} /></button>
              <button onClick={onDelete} className="grid place-items-center size-6 rounded-md text-ink-3 hover:text-[#D85A30] hover:bg-white/60" aria-label="ลบ"><IconTrash size={13} /></button>
            </>
          )}
        </span>
      </div>

      <div className="card relative p-3">
        <div className="flex items-center gap-1.5">
          {note.kind === 'todo' ? <IconListCheck size={15} className="text-ink-3 shrink-0" /> : <IconNote size={15} className="text-ink-3 shrink-0" />}
          <h3 className="text-[14px] font-semibold text-ink truncate">{note.title || (note.kind === 'todo' ? 'To-do' : 'ไม่มีหัวข้อ')}</h3>
        </div>

        {note.kind === 'note' ? (
          note.body?.trim() && <p className="text-[12.5px] text-ink-2 mt-1 leading-relaxed whitespace-pre-wrap line-clamp-4 break-words">{note.body}</p>
        ) : items.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {items.slice(0, 5).map((it) => (
              <button key={it.id} onClick={mine ? () => onToggleItem(it.id) : undefined} disabled={!mine}
                className="w-full flex items-start gap-2 text-left">
                <span className="mt-[1px] grid place-items-center size-4 rounded-[5px] shrink-0"
                  style={it.done ? { background: 'var(--color-brand)', color: '#fff' } : { border: '1.4px solid var(--color-line-2)' }}>
                  {it.done && <IconCheckSmall />}
                </span>
                <span className={`text-[12.5px] leading-snug ${it.done ? 'line-through text-ink-3' : 'text-ink-2'}`}>{it.text}</span>
              </button>
            ))}
            {items.length > 5 && <div className="text-[11px] text-ink-3 pl-6">+{items.length - 5} รายการ</div>}
            <div className="text-[11px] text-ink-3 pl-6 pt-0.5">{done}/{items.length} เสร็จ</div>
          </div>
        )}

        {!mine && (
          <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-ink-3">
            <span className="size-4 rounded-full grid place-items-center text-[8px] font-bold text-white shrink-0" style={{ background: note.author_color || 'var(--color-brand)' }}>
              {(note.author_name || 'U').slice(0, 1).toUpperCase()}
            </span>
            {note.author_name || 'สมาชิกทริป'} · {noteTime(note.created_at)}
          </div>
        )}
      </div>
    </div>
  )
}

function IconCheckSmall() {
  return <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.2 l2 2 l4 -4.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

// -------------------------------------------------------------- editor ------

function NoteEditor({ note, isNew, onChange, onBack, onSave, onDelete }: {
  note: TripNote
  isNew: boolean
  onChange: (n: TripNote) => void
  onBack: () => void
  onSave: () => void
  onDelete?: () => void
}) {
  const set = (patch: Partial<TripNote>) => onChange({ ...note, ...patch })
  const items = note.items ?? []
  const setItems = (next: TodoItem[]) => set({ items: next })

  return (
    <>
      <header className="flex items-center gap-2 px-3 h-14 shrink-0 text-white" style={{ background: 'var(--color-brand)' }}>
        <button onClick={onBack} className="grid place-items-center size-8 rounded-full hover:bg-white/15" aria-label="ย้อนกลับ"><IconArrowLeft size={18} /></button>
        <h2 className="text-[14.5px] font-semibold flex-1">{isNew ? 'สร้างใหม่' : 'แก้ไข'}</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* kind switch */}
        <div className="inline-flex gap-0.5 p-0.5 rounded-md bg-surface-2 w-full">
          {([['note', 'Note', IconNote], ['todo', 'To-do list', IconListCheck]] as const).map(([k, l, Ic]) => (
            <button key={k} onClick={() => set({ kind: k, body: k === 'note' ? (note.body ?? '') : null, items: k === 'todo' ? (items.length ? items : [{ id: crypto.randomUUID(), text: '', done: false }]) : null })}
              className={['flex-1 h-9 rounded-[6px] text-[12.5px] font-medium flex items-center justify-center gap-1.5', note.kind === k ? 'bg-surface text-ink shadow-sm' : 'text-ink-3'].join(' ')}>
              <Ic size={15} /> {l}
            </button>
          ))}
        </div>

        <div>
          <div className="text-[11px] text-ink-3 mb-1">หัวข้อ</div>
          <input value={note.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder="เรื่องนี้เกี่ยวกับอะไร"
            className="w-full hairline rounded-md h-10 px-3 text-[13.5px] font-medium bg-surface outline-none focus:border-brand" autoFocus />
        </div>

        {/* status picker */}
        <div>
          <div className="text-[11px] text-ink-3 mb-1.5">สถานะ</div>
          <div className="grid grid-cols-2 gap-1.5">
            {STATUS_ORDER.map((s) => {
              const sel = note.status === s
              const m = STATUS_META[s]
              return (
                <button key={s} onClick={() => set({ status: s })}
                  className="flex items-center gap-2 h-10 px-2.5 rounded-md text-[12.5px] font-medium transition-all"
                  style={sel
                    ? { background: m.bg, color: m.color, boxShadow: `inset 0 0 0 1.5px ${m.color}` }
                    : { background: 'var(--color-surface)', color: 'var(--color-ink-3)', border: '0.5px solid var(--color-line)' }}>
                  <span style={{ color: m.color }}><StatusIcon status={s} size={16} /></span> {m.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* share toggle */}
        <div>
          <div className="text-[11px] text-ink-3 mb-1.5">การมองเห็น</div>
          <div className="inline-flex gap-0.5 p-0.5 rounded-md bg-surface-2 w-full">
            <button onClick={() => set({ shared: false })}
              className={['flex-1 h-9 rounded-[6px] text-[12.5px] font-medium flex items-center justify-center gap-1.5', !note.shared ? 'bg-surface text-ink shadow-sm' : 'text-ink-3'].join(' ')}>
              <IconLock size={14} /> ส่วนตัว
            </button>
            <button onClick={() => set({ shared: true })}
              className={['flex-1 h-9 rounded-[6px] text-[12.5px] font-medium flex items-center justify-center gap-1.5', note.shared ? 'bg-surface text-brand shadow-sm' : 'text-ink-3'].join(' ')}>
              <IconUsers size={14} /> แชร์ให้ทุกคน
            </button>
          </div>
        </div>

        {/* body / items */}
        {note.kind === 'note' ? (
          <div>
            <div className="text-[11px] text-ink-3 mb-1">เนื้อหา</div>
            <textarea value={note.body ?? ''} onChange={(e) => set({ body: e.target.value })} rows={7} placeholder="เขียนโน้ต…"
              className="w-full hairline rounded-md p-3 text-[13px] bg-surface outline-none focus:border-brand resize-none leading-relaxed" />
          </div>
        ) : (
          <div>
            <div className="text-[11px] text-ink-3 mb-1.5">รายการที่ต้องทำ</div>
            <div className="space-y-1.5">
              {items.map((it, i) => (
                <div key={it.id} className="flex items-center gap-2">
                  <button onClick={() => setItems(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))}
                    className="grid place-items-center size-5 rounded-[6px] shrink-0"
                    style={it.done ? { background: 'var(--color-brand)', color: '#fff' } : { border: '1.5px solid var(--color-line-2)' }} aria-label="เสร็จ">
                    {it.done && <IconCheckSmall />}
                  </button>
                  <input value={it.text} onChange={(e) => setItems(items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setItems([...items.slice(0, i + 1), { id: crypto.randomUUID(), text: '', done: false }, ...items.slice(i + 1)]) } }}
                    placeholder={`รายการที่ ${i + 1}`}
                    className={`flex-1 hairline rounded-md h-9 px-2.5 text-[13px] bg-surface outline-none focus:border-brand ${it.done ? 'line-through text-ink-3' : ''}`} />
                  <button onClick={() => setItems(items.filter((x) => x.id !== it.id))} className="grid place-items-center size-7 rounded-md text-ink-3 hover:text-[#D85A30] shrink-0" aria-label="ลบรายการ"><IconTrash size={14} /></button>
                </div>
              ))}
            </div>
            <button onClick={() => setItems([...items, { id: crypto.randomUUID(), text: '', done: false }])} className="btn-link flex items-center gap-1.5 text-[12.5px] mt-2">
              <IconPlus size={14} /> เพิ่มรายการ
            </button>
          </div>
        )}

        {onDelete && (
          <button onClick={onDelete} className="w-full h-10 rounded-md text-[13px] font-medium flex items-center justify-center gap-1.5 text-[#D85A30]" style={{ border: '0.5px solid var(--color-line)' }}>
            <IconTrash size={15} /> ลบรายการนี้
          </button>
        )}
      </div>

      {/* save lives at the bottom */}
      <footer className="p-3 shrink-0 bg-canvas" style={{ borderTop: '0.5px solid var(--color-line)' }}>
        <button onClick={onSave} className="btn-primary w-full h-11 text-[14px] font-semibold">บันทึก</button>
      </footer>
    </>
  )
}
