import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  IconGripVertical, IconPlus, IconMapPin, IconPencil, IconTrash, IconCalendarPlus, IconRoute, IconInfoCircle,
} from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { MetroRoute } from '@/components/MetroRoute'
import { StopEditor } from '@/components/StopEditor'
import { DayEditor } from '@/components/DayEditor'
import { TransitEditor } from '@/components/TransitEditor'
import { PopMenu } from '@/components/PopMenu'
import { openMap } from '@/lib/maps'
import { formatLongDate } from '@/lib/format'
import {
  addDay, updateDay, deleteDay, addStop, updateStop, deleteStop, persistStopOrder, persistDayOrder,
  type StopInput,
} from '@/lib/mutations'
import type { ItineraryDay, ItineraryStop } from '@/lib/database.types'

function SortableStop({
  stop, placeLink, onEdit, onDelete, onEditRoute,
}: {
  stop: ItineraryStop
  placeLink: string | null
  onEdit: () => void
  onDelete: () => void
  onEditRoute: () => void
}) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2.5">
      <button {...attributes} {...listeners} className="mt-0.5 text-ink-3 cursor-grab active:cursor-grabbing touch-none shrink-0" aria-label="ลากจัดเรียง">
        <IconGripVertical size={16} />
      </button>
      <div className="w-11 shrink-0 pt-0.5">
        {stop.time && <div className="text-[13px] font-medium tabular-nums">{stop.time}</div>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <button
              onClick={() => (placeLink ? navigate(placeLink) : openMap(stop.map_url))}
              disabled={!placeLink && !stop.map_url}
              className="text-[14px] font-medium text-left leading-snug enabled:hover:text-brand-mid">
              {stop.place_name}
            </button>
            <div className="flex items-center gap-2.5">
              {placeLink && (
                <button onClick={() => navigate(placeLink)} className="inline-flex items-center gap-0.5 text-[11px] text-brand-mid mt-0.5">
                  <IconInfoCircle size={11} /> รายละเอียด
                </button>
              )}
              {stop.map_url && (
                <button onClick={() => openMap(stop.map_url)} className="inline-flex items-center gap-0.5 text-[11px] text-brand-mid mt-0.5">
                  <IconMapPin size={11} /> ดูแผนที่
                </button>
              )}
            </div>
            {stop.note && <div className="text-[12px] text-ink-2 mt-0.5">{stop.note}</div>}
          </div>
          <PopMenu items={[
            { label: 'แก้ไข', icon: <IconPencil size={15} />, onClick: onEdit },
            { label: stop.transit ? 'แก้ไขเส้นทาง' : 'เพิ่มเส้นทางรถไฟฟ้า', icon: <IconRoute size={15} />, onClick: onEditRoute },
            { label: 'ลบ', icon: <IconTrash size={15} />, onClick: onDelete, danger: true },
          ]} />
        </div>
        {stop.transit && <MetroRoute transit={stop.transit} onEdit={onEditRoute} />}
      </div>
    </div>
  )
}

function DayCard({
  day, index, stops, getPlaceLink, onEditDay, onDeleteDay, onAddStop, onStopDragEnd, onEditStop, onDeleteStop, onEditRoute,
}: {
  day: ItineraryDay
  index: number
  stops: ItineraryStop[]
  getPlaceLink: (s: ItineraryStop) => string | null
  onEditDay: () => void
  onDeleteDay: () => void
  onAddStop: () => void
  onStopDragEnd: (e: DragEndEvent) => void
  onEditStop: (s: ItineraryStop) => void
  onDeleteStop: (id: string) => void
  onEditRoute: (s: ItineraryStop) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: day.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 10 : undefined }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  return (
    <div ref={setNodeRef} style={style} className="card">
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '0.5px solid var(--color-line)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <button {...attributes} {...listeners} className="text-ink-3 cursor-grab active:cursor-grabbing touch-none shrink-0" aria-label="ลากย้ายวัน">
            <IconGripVertical size={16} />
          </button>
          <span className="chip !bg-brand-soft !text-brand-dark !font-medium shrink-0">Day {index + 1}</span>
          <div className="min-w-0">
            <div className="text-[13px] font-medium truncate">{formatLongDate(day.day_date)}</div>
            {day.label && <div className="text-[11px] text-ink-3 truncate">{day.label}</div>}
          </div>
        </div>
        <PopMenu items={[
          { label: 'แก้ไขวัน', icon: <IconPencil size={15} />, onClick: onEditDay },
          { label: 'ลบวัน', icon: <IconTrash size={15} />, onClick: onDeleteDay, danger: true },
        ]} />
      </div>

      <div className="p-4 space-y-3">
        {stops.length === 0 && <div className="text-[12px] text-ink-3 text-center py-2">ยังไม่มีจุดแวะในวันนี้</div>}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onStopDragEnd}>
          <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {stops.map((s) => (
                <SortableStop key={s.id} stop={s} placeLink={getPlaceLink(s)} onEdit={() => onEditStop(s)} onDelete={() => onDeleteStop(s.id)} onEditRoute={() => onEditRoute(s)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <button onClick={onAddStop} className="btn-link flex items-center gap-1.5 pt-1"><IconPlus size={15} /> เพิ่มกิจกรรม</button>
      </div>
    </div>
  )
}

export default function Itinerary() {
  const { trip, days, stops, places, reload } = useTrip()

  const placeByName = useMemo(() => {
    const m = new Map<string, { id: string; group: string }>()
    for (const p of places) if (p.name) m.set(p.name.trim().toLowerCase(), { id: p.id, group: p.group_type ?? 'place' })
    return m
  }, [places])
  const getPlaceLink = (s: ItineraryStop): string | null => {
    const match = s.place_name ? placeByName.get(s.place_name.trim().toLowerCase()) : undefined
    if (!match) return null
    return match.group === 'food' ? `/food?focus=${match.id}` : `/places?focus=${match.id}`
  }
  const [localStops, setLocalStops] = useState<ItineraryStop[]>(stops)
  const [localDays, setLocalDays] = useState<ItineraryDay[]>(days)
  const [editor, setEditor] = useState<{ dayId: string; stop?: ItineraryStop } | null>(null)
  const [dayEdit, setDayEdit] = useState<{ id: string; label: string | null; day_date: string | null } | null>(null)
  const [routeEdit, setRouteEdit] = useState<ItineraryStop | null>(null)

  useEffect(() => setLocalStops(stops), [stops])
  useEffect(() => setLocalDays(days), [days])

  const daySensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const stopsByDay = useMemo(() => {
    const map = new Map<string, ItineraryStop[]>()
    for (const d of localDays) map.set(d.id, [])
    for (const s of [...localStops].sort((a, b) => a.position - b.position)) {
      if (!map.has(s.day_id)) map.set(s.day_id, [])
      map.get(s.day_id)!.push(s)
    }
    return map
  }, [localStops, localDays])

  async function onStopDragEnd(e: DragEndEvent, dayId: string) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const list = stopsByDay.get(dayId) ?? []
    const oldIdx = list.findIndex((s) => s.id === active.id)
    const newIdx = list.findIndex((s) => s.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const reordered = arrayMove(list, oldIdx, newIdx)
    const others = localStops.filter((s) => s.day_id !== dayId)
    setLocalStops([...others, ...reordered.map((s, i) => ({ ...s, position: i }))])
    await persistStopOrder(reordered)
    await reload()
  }

  async function onDayDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = localDays.findIndex((d) => d.id === active.id)
    const newIdx = localDays.findIndex((d) => d.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const reordered = arrayMove(localDays, oldIdx, newIdx)
    setLocalDays(reordered)
    await persistDayOrder(reordered)
    await reload()
  }

  async function saveStop(input: StopInput) {
    if (!trip || !editor) return
    if (editor.stop) await updateStop(editor.stop.id, input)
    else await addStop(trip.id, editor.dayId, stopsByDay.get(editor.dayId)?.length ?? 0, input)
    await reload()
  }
  async function removeStop(id: string) {
    if (!confirm('ลบจุดแวะนี้?')) return
    await deleteStop(id); await reload()
  }
  async function saveRoute(transit: Parameters<typeof updateStop>[1]['transit']) {
    if (!routeEdit) return
    await updateStop(routeEdit.id, { transit }); await reload()
  }
  async function onAddDay() {
    if (!trip) return
    const last = localDays[localDays.length - 1]
    const nextDate = last?.day_date
      ? new Date(new Date(last.day_date).getTime() + 86400000).toISOString().slice(0, 10)
      : trip.start_date
    await addDay(trip.id, localDays.length, nextDate); await reload()
  }
  async function saveDay(fields: { label: string; day_date: string | null }) {
    if (!dayEdit) return
    await updateDay(dayEdit.id, fields); await reload()
  }
  async function removeDay(id: string) {
    if (!confirm('ลบวันนี้และจุดแวะทั้งหมดในวัน?')) return
    await deleteDay(id); await reload()
  }

  return (
    <div className="space-y-4">
      <DndContext sensors={daySensors} collisionDetection={closestCenter} onDragEnd={onDayDragEnd}>
        <SortableContext items={localDays.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {localDays.map((day, idx) => (
              <DayCard
                key={day.id}
                day={day}
                index={idx}
                stops={stopsByDay.get(day.id) ?? []}
                getPlaceLink={getPlaceLink}
                onEditDay={() => setDayEdit({ id: day.id, label: day.label, day_date: day.day_date })}
                onDeleteDay={() => removeDay(day.id)}
                onAddStop={() => setEditor({ dayId: day.id })}
                onStopDragEnd={(e) => onStopDragEnd(e, day.id)}
                onEditStop={(s) => setEditor({ dayId: day.id, stop: s })}
                onDeleteStop={removeStop}
                onEditRoute={(s) => setRouteEdit(s)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button onClick={onAddDay} className="card w-full flex items-center justify-center gap-2 py-3 text-[13px] text-ink-2 hover:bg-surface-2/50 border-dashed">
        <IconCalendarPlus size={16} /> เพิ่มวัน
      </button>

      <StopEditor open={!!editor} onClose={() => setEditor(null)} initial={editor?.stop ?? null} onSave={saveStop} />
      <DayEditor open={!!dayEdit} onClose={() => setDayEdit(null)} initial={dayEdit} onSave={saveDay} />
      <TransitEditor open={!!routeEdit} onClose={() => setRouteEdit(null)} initial={routeEdit?.transit ?? null} onSave={saveRoute} />
    </div>
  )
}
