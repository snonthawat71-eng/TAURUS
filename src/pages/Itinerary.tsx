import { useEffect, useMemo, useState } from 'react'
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  IconGripVertical, IconDots, IconPlus, IconMapPin, IconPencil, IconTrash,
  IconCalendarPlus, IconClock,
} from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { MetroRoute } from '@/components/MetroRoute'
import { StopEditor } from '@/components/StopEditor'
import { DayEditor } from '@/components/DayEditor'
import { openMap } from '@/lib/maps'
import { formatLongDate } from '@/lib/format'
import {
  addDay, updateDay, deleteDay, addStop, updateStop, deleteStop, persistStopOrder,
  type StopInput,
} from '@/lib/mutations'
import type { ItineraryStop } from '@/lib/database.types'

function PopMenu({ items }: { items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button className="btn-icon !border-0 !size-7" onClick={() => setOpen((v) => !v)}>
        <IconDots size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-40 card p-1 shadow-lg z-50">
            {items.map((it, i) => (
              <button
                key={i}
                onClick={() => { setOpen(false); it.onClick() }}
                className={[
                  'w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-[13px] hover:bg-surface-2',
                  it.danger ? 'text-[#D85A30]' : 'text-ink-2',
                ].join(' ')}
              >
                {it.icon} {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function SortableStop({
  stop, onEdit, onDelete,
}: {
  stop: ItineraryStop
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2">
      <button
        {...attributes}
        {...listeners}
        className="mt-1 text-ink-3 cursor-grab active:cursor-grabbing touch-none shrink-0"
        aria-label="ลากจัดเรียง"
      >
        <IconGripVertical size={16} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {stop.time && (
              <div className="flex items-center gap-1 text-[11px] text-ink-3">
                <IconClock size={12} /> {stop.time}
              </div>
            )}
            <button
              onClick={() => openMap(stop.map_url)}
              disabled={!stop.map_url}
              className="text-[14px] font-medium text-left leading-snug enabled:hover:text-brand-mid"
            >
              {stop.place_name}
            </button>
            {stop.map_url && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] text-brand-mid align-middle">
                <IconMapPin size={11} /> แผนที่
              </span>
            )}
            {stop.note && <div className="text-[12px] text-ink-2 mt-0.5">{stop.note}</div>}
          </div>
          <PopMenu
            items={[
              { label: 'แก้ไข', icon: <IconPencil size={15} />, onClick: onEdit },
              { label: 'ลบ', icon: <IconTrash size={15} />, onClick: onDelete, danger: true },
            ]}
          />
        </div>
        {stop.transit && <MetroRoute transit={stop.transit} />}
      </div>
    </div>
  )
}

export default function Itinerary() {
  const { trip, days, stops, reload } = useTrip()
  const [local, setLocal] = useState<ItineraryStop[]>(stops)
  const [editor, setEditor] = useState<{ dayId: string; stop?: ItineraryStop } | null>(null)
  const [dayEdit, setDayEdit] = useState<{ id: string; label: string | null; day_date: string | null } | null>(null)

  useEffect(() => setLocal(stops), [stops])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const stopsByDay = useMemo(() => {
    const map = new Map<string, ItineraryStop[]>()
    for (const d of days) map.set(d.id, [])
    for (const s of [...local].sort((a, b) => a.position - b.position)) {
      if (!map.has(s.day_id)) map.set(s.day_id, [])
      map.get(s.day_id)!.push(s)
    }
    return map
  }, [local, days])

  async function onDragEnd(e: DragEndEvent, dayId: string) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const list = stopsByDay.get(dayId) ?? []
    const oldIdx = list.findIndex((s) => s.id === active.id)
    const newIdx = list.findIndex((s) => s.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const reordered = arrayMove(list, oldIdx, newIdx)
    // optimistic: rewrite positions for this day in local state
    const others = local.filter((s) => s.day_id !== dayId)
    setLocal([...others, ...reordered.map((s, i) => ({ ...s, position: i }))])
    await persistStopOrder(reordered)
    await reload()
  }

  async function saveStop(input: StopInput) {
    if (!trip || !editor) return
    if (editor.stop) await updateStop(editor.stop.id, input)
    else {
      const count = stopsByDay.get(editor.dayId)?.length ?? 0
      await addStop(trip.id, editor.dayId, count, input)
    }
    await reload()
  }

  async function removeStop(id: string) {
    if (!confirm('ลบจุดแวะนี้?')) return
    await deleteStop(id)
    await reload()
  }

  async function onAddDay() {
    if (!trip) return
    const last = days[days.length - 1]
    const nextDate = last?.day_date
      ? new Date(new Date(last.day_date).getTime() + 86400000).toISOString().slice(0, 10)
      : trip.start_date
    await addDay(trip.id, days.length, nextDate)
    await reload()
  }

  async function saveDay(fields: { label: string; day_date: string | null }) {
    if (!dayEdit) return
    await updateDay(dayEdit.id, fields)
    await reload()
  }

  async function removeDay(id: string) {
    if (!confirm('ลบวันนี้และจุดแวะทั้งหมดในวัน?')) return
    await deleteDay(id)
    await reload()
  }

  return (
    <div className="space-y-4">
      {days.map((day, idx) => {
        const list = stopsByDay.get(day.id) ?? []
        return (
          <div key={day.id} className="card">
            {/* Day header strip */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '0.5px solid var(--color-line)' }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="chip !bg-brand-soft !text-brand-dark !font-medium shrink-0">Day {idx + 1}</span>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">{formatLongDate(day.day_date)}</div>
                  {day.label && <div className="text-[11px] text-ink-3 truncate">{day.label}</div>}
                </div>
              </div>
              <PopMenu
                items={[
                  { label: 'แก้ไขวัน', icon: <IconPencil size={15} />, onClick: () => setDayEdit({ id: day.id, label: day.label, day_date: day.day_date }) },
                  { label: 'ลบวัน', icon: <IconTrash size={15} />, onClick: () => removeDay(day.id), danger: true },
                ]}
              />
            </div>

            {/* Stops */}
            <div className="p-4 space-y-3">
              {list.length === 0 && (
                <div className="text-[12px] text-ink-3 text-center py-2">ยังไม่มีจุดแวะในวันนี้</div>
              )}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(e, day.id)}>
                <SortableContext items={list.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {list.map((s) => (
                      <SortableStop
                        key={s.id}
                        stop={s}
                        onEdit={() => setEditor({ dayId: day.id, stop: s })}
                        onDelete={() => removeStop(s.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <button
                onClick={() => setEditor({ dayId: day.id })}
                className="btn-link flex items-center gap-1.5 pt-1"
              >
                <IconPlus size={15} /> เพิ่มกิจกรรม
              </button>
            </div>
          </div>
        )
      })}

      <button
        onClick={onAddDay}
        className="card w-full flex items-center justify-center gap-2 py-3 text-[13px] text-ink-2 hover:bg-surface-2/50 border-dashed"
      >
        <IconCalendarPlus size={16} /> เพิ่มวัน
      </button>

      <StopEditor
        open={!!editor}
        onClose={() => setEditor(null)}
        initial={editor?.stop ?? null}
        onSave={saveStop}
      />
      <DayEditor
        open={!!dayEdit}
        onClose={() => setDayEdit(null)}
        initial={dayEdit}
        onSave={saveDay}
      />
    </div>
  )
}
