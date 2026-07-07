import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconNotes, IconX, IconPencil, IconTrash, IconCheck, IconLoader2, IconChevronLeft } from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { listNotes, addNote, updateNote, deleteNote, isNotesMissing } from '@/lib/noteMutations'
import { confirmDialog } from '@/lib/confirm'
import { toast } from '@/lib/toast'
import type { TripNote } from '@/lib/database.types'

const OPEN_THRESHOLD = 90 // px of pull before releasing opens the panel

/** The liquid tongue: a brand-coloured sheet anchored to the right edge whose
 *  left border bulges toward the finger (classic "liquid swipe" reveal). */
function liquidPath(pull: number, y: number) {
  const W = window.innerWidth, H = window.innerHeight
  const edge = W - pull * 0.2             // the flat part of the sheet's edge
  const apex = W - Math.min(pull, W * 0.6) // the tip of the bulge, at finger Y
  const R = 60 + pull * 0.45              // vertical reach of the bulge (short wave)
  const top = Math.max(0, y - R), bottom = Math.min(H, y + R)
  return [
    `M ${W} 0`, `L ${edge} 0`, `L ${edge} ${top}`,
    `C ${edge} ${y - R * 0.45}, ${apex} ${y - R * 0.45}, ${apex} ${y}`,
    `C ${apex} ${y + R * 0.45}, ${edge} ${y + R * 0.45}, ${edge} ${bottom}`,
    `L ${edge} ${H}`, `L ${W} ${H}`, 'Z',
  ].join(' ')
}

function noteTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

export function NotePanel() {
  const { trip, memberProfiles } = useTrip()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [drag, setDrag] = useState<{ pull: number; y: number } | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const raf = useRef(0)

  // ----- notes data -----
  const [notes, setNotes] = useState<TripNote[]>([])
  const [loading, setLoading] = useState(false)
  const [missing, setMissing] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<TripNote | null>(null)
  const [editText, setEditText] = useState('')

  async function load() {
    if (!trip) return
    setLoading(true)
    const { data, error } = await listNotes(trip.id)
    if (error) { if (isNotesMissing(error.message)) setMissing(true); else toast.error(error.message) }
    else { setMissing(false); setNotes((data ?? []) as TripNote[]) }
    setLoading(false)
  }
  useEffect(() => { if (open) load() /* eslint-disable-line react-hooks/exhaustive-deps */ }, [open, trip?.id])

  // Esc closes (matches Drawer behaviour)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // ----- liquid drag from the edge handle -----
  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, y: e.clientY }
    cancelAnimationFrame(raf.current)
  }
  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!start.current) return
    const pull = Math.max(0, start.current.x - e.clientX)
    setDrag({ pull, y: e.clientY })
  }
  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (!start.current) return
    const pull = Math.max(0, start.current.x - e.clientX)
    start.current = null
    if (pull >= OPEN_THRESHOLD || pull < 8) {
      // committed pull — or a plain tap — both open the panel
      setDrag(null)
      setOpen(true)
      return
    }
    // not far enough — ease the tongue back into the edge
    const y = e.clientY
    const t0 = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 150)
      const p = pull * (1 - k) * (1 - k)
      if (k < 1) { setDrag({ pull: p, y }); raf.current = requestAnimationFrame(step) }
      else setDrag(null)
    }
    raf.current = requestAnimationFrame(step)
  }

  // ----- actions -----
  const myProfile = memberProfiles.find((p) => p.id === user?.id)
  async function submit() {
    const body = text.trim()
    if (!body || !trip) return
    setBusy(true)
    const { error } = await addNote(trip.id, body, myProfile?.nickname ?? null, myProfile?.avatar_color ?? null)
    setBusy(false)
    if (error) { if (isNotesMissing(error.message)) setMissing(true); else toast.error(`บันทึกไม่สำเร็จ: ${error.message}`); return }
    setText('')
    await load()
  }
  async function saveEdit() {
    if (!editing) return
    const body = editText.trim()
    if (!body) return
    setBusy(true)
    const { error } = await updateNote(editing.id, body)
    setBusy(false)
    if (error) { toast.error(`แก้ไขไม่สำเร็จ: ${error.message}`); return }
    setEditing(null)
    await load()
  }
  async function remove(n: TripNote) {
    if (!(await confirmDialog({ message: 'ลบโน้ตนี้?', danger: true, confirmLabel: 'ลบ' }))) return
    const { error } = await deleteNote(n.id)
    if (error) toast.error(`ลบไม่สำเร็จ: ${error.message}`)
    await load()
  }

  if (!trip) return null
  const isOwner = user?.id === trip.owner_id

  return (
    <>
      {/* edge handle — tap to open, or drag left for the liquid pull */}
      {!open && (
        <button
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          onPointerCancel={() => { start.current = null; setDrag(null) }}
          className="fixed right-0 top-[46%] z-[70] h-14 w-[22px] rounded-l-full grid place-items-center text-ink-3 select-none bg-surface"
          style={{ opacity: drag ? 0 : 1, touchAction: 'none', boxShadow: '-2px 2px 10px rgba(15,30,60,.16)', border: '0.5px solid var(--color-line)', borderRight: 0 }}
          aria-label="โน้ตทริป — แตะหรือลากออกมา">
          <IconChevronLeft size={15} />
        </button>
      )}

      {/* the liquid tongue while dragging */}
      {drag && drag.pull > 0 && createPortal(
        <>
          <div className="fixed inset-0 z-[98] pointer-events-none" style={{ background: `rgba(10,20,35,${Math.min(0.18, drag.pull / 900)})` }} />
          <svg className="fixed inset-0 z-[99] pointer-events-none" width="100%" height="100%"
            style={{ filter: 'drop-shadow(-4px 0 14px rgba(15,30,60,.22))' }}>
            <path d={liquidPath(drag.pull, drag.y)} fill="var(--color-surface)" />
          </svg>
          {/* just the pull arrow, riding the tip of the wave */}
          <IconChevronLeft size={18} className="fixed z-[100] pointer-events-none text-ink-3"
            style={{ left: window.innerWidth - Math.min(drag.pull, window.innerWidth * 0.6) + 4, top: drag.y - 9, opacity: Math.min(1, drag.pull / 50) }} />
        </>,
        document.body,
      )}

      {/* the note sheet */}
      {open && createPortal(
        <div className="fixed inset-0 z-[100]" role="presentation">
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px] animate-[toast-in_.15s_ease-out]" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-[min(88vw,360px)] bg-canvas shadow-2xl flex flex-col animate-[note-in_.24s_cubic-bezier(.22,1,.36,1)]"
            role="dialog" aria-modal="true" aria-label="โน้ตทริป">
            <header className="flex items-center gap-2.5 px-4 h-14 shrink-0 text-white" style={{ background: 'var(--color-brand)' }}>
              <IconNotes size={18} />
              <h2 className="text-[14.5px] font-semibold flex-1">โน้ตทริป</h2>
              {notes.length > 0 && <span className="text-[11px] bg-white/20 rounded-full px-2 py-0.5 tabular-nums">{notes.length}</span>}
              <button onClick={() => setOpen(false)} className="grid place-items-center size-8 rounded-full hover:bg-white/15" aria-label="ปิด">
                <IconX size={17} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
              {missing ? (
                <div className="card p-4 text-[12.5px] text-ink-2 leading-relaxed">
                  ⚙️ ยังไม่ได้เปิดใช้โน้ตทริป — รัน SQL ไฟล์ <code className="text-[11.5px] bg-surface-2 rounded px-1">supabase/notes.sql</code> ใน Supabase SQL Editor ก่อน แล้วเปิดแผงนี้ใหม่อีกครั้ง
                </div>
              ) : loading && notes.length === 0 ? (
                <div className="grid place-items-center py-10 text-ink-3"><IconLoader2 size={20} className="animate-spin" /></div>
              ) : notes.length === 0 ? (
                <div className="text-center py-10">
                  <IconNotes size={26} className="mx-auto text-ink-3" />
                  <p className="text-[12.5px] text-ink-3 mt-2">ยังไม่มีโน้ต — จดอะไรก็ได้ที่อยากบอกทุกคนในทริป</p>
                </div>
              ) : notes.map((n) => {
                const mine = !!user && n.user_id === user.id
                const isEditing = editing?.id === n.id
                return (
                  <div key={n.id} className="card p-3 flex gap-2.5">
                    <span className="w-1 rounded-full shrink-0 self-stretch" style={{ background: n.author_color || 'var(--color-brand)' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11.5px] font-medium text-ink-2 truncate">{n.author_name || 'สมาชิกทริป'}</span>
                        <span className="text-[10.5px] text-ink-3 shrink-0">{noteTime(n.created_at)}</span>
                        {(mine || isOwner) && !isEditing && (
                          <span className="ml-auto flex items-center gap-0.5 shrink-0">
                            {mine && (
                              <button onClick={() => { setEditing(n); setEditText(n.body) }} className="grid place-items-center size-6 rounded-md text-ink-3 hover:bg-surface-2" aria-label="แก้ไขโน้ต">
                                <IconPencil size={13} />
                              </button>
                            )}
                            <button onClick={() => remove(n)} className="grid place-items-center size-6 rounded-md text-ink-3 hover:text-[#D85A30] hover:bg-surface-2" aria-label="ลบโน้ต">
                              <IconTrash size={13} />
                            </button>
                          </span>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="mt-1.5">
                          <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} autoFocus
                            className="w-full hairline rounded-md p-2.5 text-[13px] bg-surface outline-none focus:border-brand resize-none" />
                          <div className="flex justify-end gap-1.5 mt-1.5">
                            <button onClick={() => setEditing(null)} className="h-8 px-3 rounded-md text-[12px] text-ink-2 hairline hover:bg-surface-2">ยกเลิก</button>
                            <button onClick={saveEdit} disabled={busy || !editText.trim()}
                              className="h-8 px-3 rounded-md text-[12px] font-medium text-white flex items-center gap-1 disabled:opacity-50" style={{ background: 'var(--color-brand)' }}>
                              <IconCheck size={13} /> บันทึก
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[13px] text-ink mt-1 leading-relaxed whitespace-pre-wrap break-words">{n.body}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {!missing && (
              <footer className="p-3 shrink-0" style={{ borderTop: '0.5px solid var(--color-line)' }}>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="จดโน้ตถึงทุกคนในทริป…"
                  className="w-full hairline rounded-md p-2.5 text-[13px] bg-surface outline-none focus:border-brand resize-none" />
                <button onClick={submit} disabled={busy || !text.trim()}
                  className="btn-primary w-full h-10 mt-2 flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {busy ? <IconLoader2 size={15} className="animate-spin" /> : <IconNotes size={15} />} เพิ่มโน้ต
                </button>
              </footer>
            )}
          </aside>
        </div>,
        document.body,
      )}
    </>
  )
}
