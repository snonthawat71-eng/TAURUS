import { useEffect, useMemo, useState } from 'react'
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
import { useAuth } from '@/contexts/AuthContext'
import { MetroRoute } from '@/components/MetroRoute'
import { StopEditor } from '@/components/StopEditor'
import { DayEditor } from '@/components/DayEditor'
import { TransitEditor } from '@/components/TransitEditor'
import { PopMenu } from '@/components/PopMenu'
import { PlaceDetail } from '@/components/PlaceDetail'
import { openMap } from '@/lib/maps'
import { formatLongDate } from '@/lib/format'
import { setInPlan, toggleInterest } from '@/lib/placeMutations'
import {
  addDay, updateDay, deleteDay, addStop, updateStop, deleteStop, persistStopOrder, persistDayOrder,
  type StopInput,
} from '@/lib/mutations'
import type { ItineraryDay, ItineraryStop, Place } from '@/lib/database.types'

function SortableStop({
  stop, matchedPlace, canEdit, onOpenDetail, onEdit, onDelete, onEditRoute,
}: {
  stop: ItineraryStop
  matchedPlace: Place | null
  canEdit: boolean
  onOpenDetail: (p: Place) => void
  onEdit: () => void
  onDelete: () => void
  onEditRoute: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id, disabled: !canEdit })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const mode = stop.link_mode ?? 'map'
  const detailMode = mode === 'detail' && !!matchedPlace
  const tapAction = mode === 'none' ? null : detailMode ? () => onOpenDetail(matchedPlace!) : () => openMap(stop.map_url)

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2.5">
      {canEdit ? (
        <button {...attributes} {...listeners} className="mt-0.5 text-ink-3 cursor-grab active:cursor-grabbing touch-none shrink-0" aria-label="ลากจัดเรียง">
          <IconGripVertical size={16} />
        </button>
      ) : <span className="w-1 shrink-0" />}
      <div className="w-11 shrink-0 pt-0.5">
        {stop.time && <div className="text-[13px] font-medium tabular-nums">{stop.time}</div>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <button
              onClick={() => tapAction?.()}
              disabled={!tapAction || (mode === 'map' && !stop.map_url)}
              className="text-[14px] font-medium text-left leading-snug enabled:hover:text-brand-mid">
              {stop.place_name}
            </button>
            <div className="flex items-center gap-2.5">
              {matchedPlace && (
                <button onClick={() => onOpenDetail(matchedPlace)} className="inline-flex items-center gap-0.5 text-[11px] text-brand-mid mt-0.5">
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
          {canEdit && (
            <PopMenu items={[
              { label: 'แก้ไข', icon: <IconPencil size={15} />, onClick: onEdit },
              { label: stop.transit ? 'แก้ไขเส้นทาง' : 'เพิ่มเส้นทางรถไฟฟ้า', icon: <IconRoute size={15} />, onClick: onEditRoute },
              { label: 'ลบ', icon: <IconTrash size={15} />, onClick: onDelete, danger: true },
            ]} />
          )}
        </div>
        {stop.transit && <MetroRoute transit={stop.transit} onEdit={canEdit ? onEditRoute : undefined} />}
      </div>
    </div>
  )
}

function DayCard({
  day, index, stops, getMatchedPlace, canEdit, onOpenDetail, onEditDay, onDeleteDay, onAddStop, onStopDragEnd, onEditStop, onDeleteStop, onEditRoute,
}: {
  day: ItineraryDay
  index: number
  stops: ItineraryStop[]
  getMatchedPlace: (s: ItineraryStop) => Place | null
  canEdit: boolean
  onOpenDetail: (p: Place) => void
  onEditDay: () => void
  onDeleteDay: () => void
  onAddStop: () => void
  onStopDragEnd: (e: DragEndEvent) => void
  onEditStop: (s: ItineraryStop) => void
  onDeleteStop: (id: string) => void
  onEditRoute: (s: ItineraryStop) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: day.id, disabled: !canEdit })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 10 : undefined }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  return (
    <div ref={setNodeRef} style={style} className="card">
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '0.5px solid var(--color-line)' }}>
        <div className="flex items-center gap-2 min-w-0">
          {canEdit && (
            <button {...attributes} {...listeners} className="text-ink-3 cursor-grab active:cursor-grabbing touch-none shrink-0" aria-label="ลากย้ายวัน">
              <IconGripVertical size={16} />
            </button>
          )}
          <span className="chip !bg-brand-soft !text-brand-dark !font-medium shrink-0">Day {index + 1}</span>
          <div className="min-w-0">
            <div className="text-[13px] font-medium truncate">{formatLongDate(day.day_date)}</div>
            {day.label && <div className="text-[11px] text-ink-3 truncate">{day.label}</div>}
          </div>
        </div>
        {canEdit && (
          <PopMenu items={[
            { label: 'แก้ไขวัน', icon: <IconPencil size={15} />, onClick: onEditDay },
            { label: 'ลบวัน', icon: <IconTrash size={15} />, onClick: onDeleteDay, danger: true },
          ]} />
        )}
      </div>

      <div className="p-4 space-y-3">
        {stops.length === 0 && <div className="text-[12px] text-ink-3 text-center py-2">ยังไม่มีจุดแวะในวันนี้</div>}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onStopDragEnd}>
          <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {stops.map((s) => (
                <SortableStop key={s.id} stop={s} matchedPlace={getMatchedPlace(s)} canEdit={canEdit} onOpenDetail={onOpenDetail} onEdit={() => onEditStop(s)} onDelete={() => onDeleteStop(s.id)} onEditRoute={() => onEditRoute(s)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        {canEdit && <button onClick={onAddStop} className="btn-link flex items-center gap-1.5 pt-1"><IconPlus size={15} /> เพิ่มกิจกรรม</button>}
      </div>
    </div>
  )
}

export default function Itinerary() {
  const { trip, days, stops, places, interests, memberProfiles, reload, canEdit } = useTrip()
  const { user } = useAuth()
  const [detailPlace, setDetailPlace] = useState<Place | null>(null)

  const placeByName = useMemo(() => {
    const m = new Map<string, Place>()
    for (const p of places) if (p.name) m.set(p.name.trim().toLowerCase(), p)
    return m
  }, [places])
  const getMatchedPlace = (s: ItineraryStop): Place | null =>
    (s.place_name ? placeByName.get(s.place_name.trim().toLowerCase()) : undefined) ?? null

  // keep the open popup in sync with refreshed data
  useEffect(() => {
    if (detailPlace) setDetailPlace(places.find((p) => p.id === detailPlace.id) ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places])

  const interestFor = (place: Place) => {
    const rows = interests.filter((i) => i.place_id === place.id)
    const list = rows.map((r) => {
      const p = memberProfiles.find((mp) => mp.id === r.user_id)
      return { name: p?.nickname ?? 'ผู้ใช้', color: p?.avatar_color ?? undefined }
    })
    return { list, mine: !!user && rows.some((r) => r.user_id === user.id) }
  }
  async function togglePlan(p: Place) { await setInPlan(p.id, !p.in_plan); await reload() }
  async function toggleWant(p: Place) {
    if (!user) return
    const mine = interests.some((i) => i.place_id === p.id && i.user_id === user.id)
    await toggleInterest(p.id, user.id, mine); await reload()
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
                getMatchedPlace={getMatchedPlace}
                canEdit={canEdit}
                onOpenDetail={setDetailPlace}
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

      {canEdit && (
        <button onClick={onAddDay} className="card w-full flex items-center justify-center gap-2 py-3 text-[13px] text-ink-2 hover:bg-surface-2/50 border-dashed">
          <IconCalendarPlus size={16} /> เพิ่มวัน
        </button>
      )}
      {days.length === 0 && !canEdit && <div className="card p-8 text-center text-[12px] text-ink-3">ยังไม่มีแผนการเดินทาง</div>}

      <StopEditor open={!!editor} onClose={() => setEditor(null)} initial={editor?.stop ?? null} onSave={saveStop} />
      <DayEditor open={!!dayEdit} onClose={() => setDayEdit(null)} initial={dayEdit} onSave={saveDay} />
      <TransitEditor open={!!routeEdit} onClose={() => setRouteEdit(null)} initial={routeEdit?.transit ?? null} onSave={saveRoute} />

      {(() => {
        if (!detailPlace) return null
        const { list, mine } = interestFor(detailPlace)
        return (
          <PlaceDetail place={detailPlace} interested={list} mine={mine} open={!!detailPlace} canEdit={canEdit}
            onClose={() => setDetailPlace(null)}
            onTogglePlan={() => togglePlan(detailPlace)}
            onToggleInterest={() => toggleWant(detailPlace)} />
        )
      })()}
    </div>
  )
}
