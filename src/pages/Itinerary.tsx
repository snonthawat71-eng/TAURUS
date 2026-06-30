import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  IconGripVertical, IconPlus, IconMapPin, IconPencil, IconTrash, IconCalendarPlus, IconRoute, IconInfoCircle, IconChevronDown, IconCheck,
} from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { MetroRoute } from '@/components/MetroRoute'
import { StopEditor } from '@/components/StopEditor'
import { DayEditor } from '@/components/DayEditor'
import { TransitEditor } from '@/components/TransitEditor'
import { NotificationSettings } from '@/components/NotificationSettings'
import { PopMenu } from '@/components/PopMenu'
import { PlaceDetail } from '@/components/PlaceDetail'
import { openMap } from '@/lib/maps'
import { confirmDialog } from '@/lib/confirm'
import { offerUndo } from '@/lib/undo'
import { toast } from '@/lib/toast'
import { formatLongDate } from '@/lib/format'
import { setInPlan, toggleInterest } from '@/lib/placeMutations'
import { useWeather, type DayWeather } from '@/lib/weather'
import { WeatherBadge } from '@/components/WeatherBadge'
import {
  addDay, updateDay, deleteDay, addStop, updateStop, deleteStop, setStopDone, persistStopOrder, persistDayOrder,
  type StopInput,
} from '@/lib/mutations'
import type { ItineraryDay, ItineraryStop, Place } from '@/lib/database.types'

function SortableStop({
  stop, matchedPlace, canEdit, isNext, onToggleDone, onOpenDetail, onEdit, onDelete, onEditRoute, onSkipRoute,
}: {
  stop: ItineraryStop
  matchedPlace: Place | null
  canEdit: boolean
  isNext: boolean
  onToggleDone: () => void
  onOpenDetail: (p: Place) => void
  onEdit: () => void
  onDelete: () => void
  onEditRoute: () => void
  onSkipRoute: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id, disabled: !canEdit })
  const done = !!stop.done
  const style = {
    transform: CSS.Transform.toString(transform), transition,
    opacity: isDragging ? 0.5 : done ? 0.5 : 1,
    ...(isNext ? { background: 'var(--color-brand-soft)', boxShadow: 'inset 0 0 0 1px var(--color-brand-border)' } : {}),
  }
  const mode = stop.link_mode ?? 'map'
  const detailMode = mode === 'detail' && !!matchedPlace
  const tapAction = mode === 'none' ? null : detailMode ? () => onOpenDetail(matchedPlace!) : () => openMap(stop.map_url)

  return (
    <div ref={setNodeRef} id={`stop-${stop.id}`} style={style}
      className={['flex gap-2.5', isNext ? 'rounded-[10px] -mx-2 px-2 py-1.5' : ''].join(' ')}>
      {/* grip + check-in + time, top-aligned so the time sits on the SAME line as
          the place name's first line */}
      <div className="flex items-start gap-1.5 shrink-0">
        {canEdit ? (
          <button {...attributes} {...listeners} className="mt-0.5 text-ink-3 cursor-grab active:cursor-grabbing touch-none shrink-0" aria-label="ลากจัดเรียง">
            <IconGripVertical size={16} />
          </button>
        ) : <span className="w-1 shrink-0" />}
        {canEdit ? (
          <button onClick={onToggleDone} aria-label={done ? 'ทำเครื่องหมายว่ายังไม่เสร็จ' : 'เช็คอินว่าไปมาแล้ว'} title={done ? 'ยังไม่เสร็จ' : 'เช็คอินว่าไปมาแล้ว'}
            className="mt-0.5 size-[18px] rounded-full grid place-items-center shrink-0 transition-colors"
            style={done ? { background: 'var(--color-brand)', color: '#fff' } : { border: '1.5px solid var(--color-line-2)' }}>
            {done && <IconCheck size={12} />}
          </button>
        ) : done ? (
          <span className="mt-0.5 size-[18px] rounded-full grid place-items-center shrink-0" style={{ background: 'var(--color-brand)', color: '#fff' }}><IconCheck size={12} /></span>
        ) : <span className="w-[18px] shrink-0" />}
        <div className="w-10 text-[13px] font-medium tabular-nums leading-snug">{stop.time}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {isNext && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold mb-1" style={{ background: 'var(--color-brand)', color: '#fff' }}>ต่อไป</span>
            )}
            <button
              onClick={() => tapAction?.()}
              disabled={!tapAction || (mode === 'map' && !stop.map_url)}
              className="text-[14px] font-medium text-left leading-snug block enabled:hover:text-brand-mid">
              {stop.place_name}
            </button>
            {!done && (
              <>
                <div className="flex items-center gap-2.5 flex-wrap">
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
              </>
            )}
          </div>
          {canEdit && (
            <PopMenu items={[
              { label: done ? 'ยังไม่เสร็จ' : 'เช็คอินว่าไปมาแล้ว', icon: <IconCheck size={15} />, onClick: onToggleDone },
              { label: 'แก้ไข', icon: <IconPencil size={15} />, onClick: onEdit },
              // once the user opted out, the "set transit" action lives here instead
              ...(!stop.transit && stop.skip_transit ? [{ label: 'กำหนดการเดินทาง', icon: <IconRoute size={15} />, onClick: onEditRoute }] : []),
              { label: 'ลบ', icon: <IconTrash size={15} />, onClick: onDelete, danger: true },
            ]} />
          )}
        </div>
        {!done && canEdit && !stop.transit && !stop.skip_transit && (
          <div className="mt-2 flex items-center gap-2">
            <button onClick={onEditRoute}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium"
              style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }}>
              <IconRoute size={14} /> กำหนดการเดินทาง
            </button>
            <button onClick={onSkipRoute}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium text-ink-2 hover:bg-surface-2"
              style={{ border: '0.5px solid var(--color-line)' }}>
              ไม่กำหนดเส้นทาง
            </button>
          </div>
        )}
        {!done && stop.transit && <MetroRoute transit={stop.transit} onEdit={canEdit ? onEditRoute : undefined} />}
      </div>
    </div>
  )
}

function DayCard({
  day, index, stops, getMatchedPlace, canEdit, collapsed, nextStopId, wx, onToggleCollapse, onToggleDone, onOpenDetail, onEditDay, onDeleteDay, onAddStop, onEditStop, onDeleteStop, onEditRoute, onSkipRoute,
}: {
  day: ItineraryDay
  index: number
  stops: ItineraryStop[]
  getMatchedPlace: (s: ItineraryStop) => Place | null
  canEdit: boolean
  collapsed: boolean
  nextStopId: string | null
  wx: DayWeather | null | undefined
  onToggleCollapse: () => void
  onToggleDone: (s: ItineraryStop) => void
  onOpenDetail: (p: Place) => void
  onEditDay: () => void
  onDeleteDay: () => void
  onAddStop: () => void
  onEditStop: (s: ItineraryStop) => void
  onDeleteStop: (id: string) => void
  onEditRoute: (s: ItineraryStop) => void
  onSkipRoute: (s: ItineraryStop) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: day.id, disabled: !canEdit })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 10 : undefined }
  const doneCount = stops.filter((s) => s.done).length

  return (
    <div ref={setNodeRef} style={style} className="card">
      <div className="flex items-center justify-between px-4 py-3" style={collapsed ? undefined : { borderBottom: '0.5px solid var(--color-line)' }}>
        <div className="flex items-center gap-2 min-w-0">
          {canEdit && (
            <button {...attributes} {...listeners} className="text-ink-3 cursor-grab active:cursor-grabbing touch-none shrink-0" aria-label="ลากย้ายวัน">
              <IconGripVertical size={16} />
            </button>
          )}
          <span className="chip !bg-brand-soft !text-brand-dark !font-medium shrink-0">Day {index + 1}</span>
          <button onClick={onToggleCollapse} className="min-w-0 text-left" aria-expanded={!collapsed}>
            <div className="text-[13px] font-medium truncate">{formatLongDate(day.day_date)}</div>
            {collapsed
              ? <div className="text-[11px] text-ink-3 truncate">{stops.length} กิจกรรม{doneCount > 0 ? ` · เสร็จ ${doneCount}/${stops.length}` : ''}{day.label ? ` · ${day.label}` : ''}</div>
              : day.label && <div className="text-[11px] text-ink-3 truncate">{day.label}</div>}
          </button>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {wx && <WeatherBadge wx={wx} className="text-[12px] text-ink-2" />}
          {canEdit && (
            <PopMenu items={[
              { label: 'แก้ไขวัน', icon: <IconPencil size={15} />, onClick: onEditDay },
              { label: 'ลบวัน', icon: <IconTrash size={15} />, onClick: onDeleteDay, danger: true },
            ]} />
          )}
          <button onClick={onToggleCollapse} className="btn-icon !border-0 !size-7 text-ink-3" aria-label={collapsed ? 'เปิดวัน' : 'พับวัน'} aria-expanded={!collapsed}>
            <IconChevronDown size={16} className={`transition-transform ${collapsed ? '-rotate-90' : ''}`} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-4 space-y-3 min-h-[60px]">
          {stops.length === 0 && <div className="text-[12px] text-ink-3 text-center py-2">ยังไม่มีจุดแวะในวันนี้ — ลากกิจกรรมมาวางที่นี่ได้</div>}
          <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {stops.map((s) => (
                <SortableStop key={s.id} stop={s} matchedPlace={getMatchedPlace(s)} canEdit={canEdit} isNext={s.id === nextStopId} onToggleDone={() => onToggleDone(s)} onOpenDetail={onOpenDetail} onEdit={() => onEditStop(s)} onDelete={() => onDeleteStop(s.id)} onEditRoute={() => onEditRoute(s)} onSkipRoute={() => onSkipRoute(s)} />
              ))}
            </div>
          </SortableContext>
          {canEdit && <button onClick={onAddStop} className="btn-link flex items-center gap-1.5 pt-1"><IconPlus size={15} /> เพิ่มกิจกรรม</button>}
        </div>
      )}
    </div>
  )
}

export default function Itinerary() {
  const { trip, days, stops, places, interests, memberProfiles, reload, patch, canEdit } = useTrip()
  const { user } = useAuth()
  const [detailPlace, setDetailPlace] = useState<Place | null>(null)
  const dayWx = useWeather(trip?.cities?.[0] || trip?.country, days.map((d) => d.day_date).filter(Boolean) as string[])

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
  function togglePlan(p: Place) {
    const next = !p.in_plan
    patch((d) => ({ places: d.places.map((x) => (x.id === p.id ? { ...x, in_plan: next } : x)) })) // instant
    setInPlan(p.id, next).then(() => reload()) // persist + reconcile in the background
  }
  function toggleWant(p: Place) {
    if (!user) return
    const mine = interests.some((i) => i.place_id === p.id && i.user_id === user.id)
    patch((d) => ({
      interests: mine
        ? d.interests.filter((i) => !(i.place_id === p.id && i.user_id === user.id))
        : [...d.interests, { place_id: p.id, user_id: user.id }],
    }))
    toggleInterest(p.id, user.id, mine).then(() => reload())
  }
  const [localStops, setLocalStops] = useState<ItineraryStop[]>(stops)
  const [localDays, setLocalDays] = useState<ItineraryDay[]>(days)
  const [editor, setEditor] = useState<{ dayId: string; stop?: ItineraryStop } | null>(null)
  const [dayEdit, setDayEdit] = useState<{ id: string; label: string | null; day_date: string | null; version?: number } | null>(null)
  const [routeEdit, setRouteEdit] = useState<ItineraryStop | null>(null)

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  // a live mirror of localStops so the drag handlers read the latest order, and
  // the day a drag started in (to re-number it after a cross-day move)
  const stopsRef = useRef<ItineraryStop[]>(stops)
  const dragOrigin = useRef<string | null>(null)

  useEffect(() => setLocalStops(stops), [stops])
  useEffect(() => setLocalDays(days), [days])
  useEffect(() => { stopsRef.current = localStops }, [localStops])

  // remember which days are collapsed, per trip, across navigation / reloads
  const collapseKey = trip?.id ? `taurus:itin:collapsed:${trip.id}` : null
  useEffect(() => {
    if (!collapseKey) { setCollapsed(new Set()); return }
    try {
      const raw = localStorage.getItem(collapseKey)
      setCollapsed(new Set(raw ? (JSON.parse(raw) as string[]) : []))
    } catch { setCollapsed(new Set()) }
  }, [collapseKey])
  function toggleCollapse(dayId: string) {
    setCollapsed((prev) => {
      const n = new Set(prev)
      if (n.has(dayId)) n.delete(dayId); else n.add(dayId)
      if (collapseKey) { try { localStorage.setItem(collapseKey, JSON.stringify([...n])) } catch { /* ignore */ } }
      return n
    })
  }

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

  // "Focus the next stop": today's day (in the trip's timezone) → its first stop
  // that isn't checked off yet. That stop gets the "ต่อไป" highlight + auto-scroll.
  const todayStr = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: trip?.timezone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    } catch { return new Date().toISOString().slice(0, 10) }
  }, [trip?.timezone])
  const nextStopId = useMemo(() => {
    const today = localDays.find((d) => d.day_date === todayStr)
    if (!today) return null
    return (stopsByDay.get(today.id) ?? []).find((s) => !s.done)?.id ?? null
  }, [localDays, stopsByDay, todayStr])

  // auto-scroll to the next stop once per visit (only if its day is expanded)
  const scrolledRef = useRef(false)
  useEffect(() => {
    if (scrolledRef.current || !nextStopId) return
    const el = document.getElementById(`stop-${nextStopId}`)
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); scrolledRef.current = true }
  }, [nextStopId])

  function toggleDone(s: ItineraryStop) {
    const done = !s.done
    const done_at = done ? new Date().toISOString() : null
    // optimistic only — no reload() here (a full refetch re-renders every card and
    // looks like a flicker). The realtime subscription reconciles in the background.
    // setStopDone has no version guard, so rapid taps always persist the latest state.
    patch((d) => ({ stops: d.stops.map((x) => (x.id === s.id ? { ...x, done, done_at } : x)) }))
    setLocalStops((prev) => prev.map((x) => (x.id === s.id ? { ...x, done, done_at } : x)))
    setStopDone(s.id, done, done_at)
  }

  // resolve any drop target (a day card, a day's drop area, or a stop) to its day
  const dayOf = (overId: string, list: ItineraryStop[]): string | undefined =>
    localDays.some((d) => d.id === overId) ? overId
      : overId.startsWith('day:') ? overId.slice(4)
        : list.find((s) => s.id === overId)?.day_id

  function onDragStart(e: DragStartEvent) {
    const s = stopsRef.current.find((x) => x.id === String(e.active.id))
    dragOrigin.current = s ? s.day_id : null
  }

  // live-move a dragged stop into whatever day it hovers over, so crossing days
  // feels exactly like reordering within a day (the list shifts immediately)
  function onDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const cur = stopsRef.current
    const moving = cur.find((s) => s.id === activeId)
    if (!moving) return // a day is being dragged, not a stop
    const toDay = dayOf(overId, cur)
    if (!toDay || moving.day_id === toDay) return
    const without = cur.filter((s) => s.id !== activeId)
    const dst = without.filter((s) => s.day_id === toDay).sort((a, b) => a.position - b.position)
    const overIdx = dst.findIndex((s) => s.id === overId)
    dst.splice(overIdx >= 0 ? overIdx : dst.length, 0, { ...moving, day_id: toDay })
    const next = [...without.filter((s) => s.day_id !== toDay), ...dst.map((s, i) => ({ ...s, position: i }))]
    stopsRef.current = next
    setLocalStops(next)
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    const origin = dragOrigin.current
    dragOrigin.current = null
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)

    // --- dragging a DAY → reorder days ---
    if (localDays.some((d) => d.id === activeId)) {
      const overDay = dayOf(overId, localStops)
      const oldIdx = localDays.findIndex((d) => d.id === activeId)
      const newIdx = localDays.findIndex((d) => d.id === overDay)
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return
      const reordered = arrayMove(localDays, oldIdx, newIdx)
      setLocalDays(reordered)
      await persistDayOrder(reordered)
      await reload()
      return
    }

    // --- dragging a STOP --- (onDragOver already moved it to its final day)
    const cur = stopsRef.current
    const moving = cur.find((s) => s.id === activeId)
    if (!moving) return
    const finalDay = moving.day_id
    const list = cur.filter((s) => s.day_id === finalDay).sort((a, b) => a.position - b.position)
    const oldIdx = list.findIndex((s) => s.id === activeId)
    let newIdx = list.findIndex((s) => s.id === overId)
    if (newIdx < 0) newIdx = list.length - 1 // dropped on day area → end
    const reordered = (oldIdx >= 0 && newIdx >= 0) ? arrayMove(list, oldIdx, newIdx) : list
    const crossed = origin != null && origin !== finalDay
    // Within a day the time is pinned to its SLOT: the activities reorder but the
    // time column keeps its order, so dragging swaps the times along with the
    // positions (a stop that had a time hands it to whatever now sits in its slot).
    // Across days the time still travels with the moved card.
    const slotTimes = list.map((s) => s.time ?? null)
    const finalPos = reordered.map((s, i) => ({
      ...s,
      position: i,
      ...(crossed ? {} : { time: slotTimes[i] ?? null }),
    }))
    let next = [...cur.filter((s) => s.day_id !== finalDay), ...finalPos]
    let toPersist = [...finalPos]
    if (crossed) {
      const originPos = next.filter((s) => s.day_id === origin).sort((a, b) => a.position - b.position).map((s, i) => ({ ...s, position: i }))
      next = [...next.filter((s) => s.day_id !== origin), ...originPos]
      toPersist = [...toPersist, ...originPos]
    }
    stopsRef.current = next
    setLocalStops(next)
    await persistStopOrder(toPersist)
    await reload()
  }

  async function saveStop(input: StopInput) {
    if (!trip || !editor) return
    const dayId = editor.dayId
    const dayStops = stopsByDay.get(dayId) ?? []
    let target: ItineraryStop
    if (editor.stop) {
      const r = await updateStop(editor.stop.id, input, editor.stop.version)
      if (r.conflict) {
        toast.error('มีคนอื่นแก้ไขจุดแวะนี้ก่อนหน้า — โหลดข้อมูลล่าสุดให้แล้ว ลองใหม่อีกครั้ง')
        await reload()
        return
      }
      target = { ...editor.stop, ...input, time: input.time ?? null }
    } else {
      const id = crypto.randomUUID()
      await addStop(trip.id, dayId, dayStops.length, input, id)
      target = {
        id, day_id: dayId, trip_id: trip.id, position: dayStops.length,
        time: input.time ?? null, place_name: input.place_name ?? null, map_url: input.map_url ?? null,
        note: input.note ?? null, transit: input.transit ?? null, link_mode: input.link_mode ?? null,
        created_at: new Date().toISOString(),
      }
    }
    // a stop with a clear time slots into its chronological position AMONG THE
    // OTHER TIMED stops. If nothing is scheduled later, it sits at the end of the
    // timed group (just above any not-yet-timed stops) — never below them.
    if (input.time) {
      const rest = dayStops.filter((s) => s.id !== target.id)
      let insertAt = rest.findIndex((s) => s.time != null && s.time > input.time!)
      if (insertAt < 0) insertAt = rest.map((s) => s.time != null).lastIndexOf(true) + 1
      const ordered = [...rest.slice(0, insertAt), target, ...rest.slice(insertAt)]
      await persistStopOrder(ordered.map((s, i) => ({ ...s, position: i })))
    }
    await reload()
  }
  async function removeStop(id: string) {
    if (!(await confirmDialog({ message: 'ลบจุดแวะนี้?', danger: true, confirmLabel: 'ลบ' }))) return
    const row = stops.find((s) => s.id === id)
    await deleteStop(id); await reload()
    if (row) offerUndo('ลบจุดแวะแล้ว', [{ table: 'itinerary_stops', rows: [row] }], reload)
  }
  async function saveRoute(transit: Parameters<typeof updateStop>[1]['transit']) {
    if (!routeEdit) return
    const r = await updateStop(routeEdit.id, { transit }, routeEdit.version)
    if (r.conflict) toast.error('มีคนอื่นแก้ไขจุดแวะนี้ก่อนหน้า — โหลดข้อมูลล่าสุดให้แล้ว ลองใหม่อีกครั้ง')
    await reload()
  }
  // user opted out of a route for this stop → hide the buttons (move into the … menu)
  async function skipRoute(s: ItineraryStop) {
    await updateStop(s.id, { skip_transit: true }, s.version)
    await reload()
  }
  function onAddDay() {
    if (!trip) return
    const last = localDays[localDays.length - 1]
    const nextDate = last?.day_date
      ? new Date(new Date(last.day_date).getTime() + 86400000).toISOString().slice(0, 10)
      : trip.start_date
    const id = crypto.randomUUID()
    const position = localDays.length
    const row: ItineraryDay = { id, trip_id: trip.id, day_date: nextDate, label: 'วันใหม่', position, created_at: new Date().toISOString() }
    patch((d) => ({ days: [...d.days, row] })) // show instantly
    addDay(trip.id, position, nextDate, id).then(() => reload()) // persist + reconcile in the background
  }
  async function saveDay(fields: { label: string; day_date: string | null }) {
    if (!dayEdit) return
    const r = await updateDay(dayEdit.id, fields, dayEdit.version)
    if (r.conflict) toast.error('มีคนอื่นแก้ไขวันนี้ก่อนหน้า — โหลดข้อมูลล่าสุดให้แล้ว ลองใหม่อีกครั้ง')
    await reload()
  }
  async function removeDay(id: string) {
    if (!(await confirmDialog({ message: 'ลบวันนี้และจุดแวะทั้งหมดในวัน?', danger: true, confirmLabel: 'ลบ' }))) return
    const dayRow = days.find((d) => d.id === id)
    const stopRows = stops.filter((s) => s.day_id === id)
    await deleteDay(id); await reload()
    if (dayRow) offerUndo('ลบวันแล้ว', [{ table: 'itinerary_days', rows: [dayRow] }, { table: 'itinerary_stops', rows: stopRows }], reload)
  }

  // The trip's start→end span is the source of truth for how many days the plan
  // should have. Once that many days exist, adding more is "optional" (extra days).
  const plannedDays = (() => {
    if (!trip?.start_date || !trip?.end_date) return null
    const ms = new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()
    return ms >= 0 ? Math.round(ms / 86400000) + 1 : null
  })()
  const atDayCapacity = plannedDays != null && localDays.length >= plannedDays

  return (
    <div className="space-y-4">
      <NotificationSettings />
      <DndContext sensors={daySensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
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
                wx={day.day_date ? dayWx[day.day_date] : undefined}
                collapsed={collapsed.has(day.id)}
                nextStopId={nextStopId}
                onToggleCollapse={() => toggleCollapse(day.id)}
                onToggleDone={toggleDone}
                onOpenDetail={setDetailPlace}
                onEditDay={() => setDayEdit({ id: day.id, label: day.label, day_date: day.day_date, version: day.version })}
                onDeleteDay={() => removeDay(day.id)}
                onAddStop={() => setEditor({ dayId: day.id })}
                onEditStop={(s) => setEditor({ dayId: day.id, stop: s })}
                onDeleteStop={removeStop}
                onEditRoute={(s) => setRouteEdit(s)}
                onSkipRoute={skipRoute}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {canEdit && (
        atDayCapacity ? (
          <button onClick={onAddDay} title="ครบตามจำนวนวันของทริปแล้ว — วันที่เพิ่มจะเป็นวันเสริม (ไม่บังคับ)"
            className="w-full flex items-center justify-center gap-2 py-2.5 text-[12px] text-ink-3 hover:text-ink-2">
            <IconCalendarPlus size={14} /> เพิ่มวันเสริม (optional)
          </button>
        ) : (
          <button onClick={onAddDay} className="card w-full flex items-center justify-center gap-2 py-3 text-[13px] text-ink-2 hover:bg-surface-2/50 border-dashed">
            <IconCalendarPlus size={16} /> เพิ่มวัน
          </button>
        )
      )}
      {days.length === 0 && !canEdit && <div className="card p-8 text-center text-[12px] text-ink-3">ยังไม่มีแผนการเดินทาง</div>}

      <StopEditor open={!!editor} onClose={() => setEditor(null)} initial={editor?.stop ?? null} onSave={saveStop} />
      <DayEditor open={!!dayEdit} onClose={() => setDayEdit(null)} initial={dayEdit} onSave={saveDay} />
      <TransitEditor open={!!routeEdit} onClose={() => setRouteEdit(null)} initial={routeEdit?.transit ?? null} placeName={routeEdit?.place_name ?? null} onSave={saveRoute} />

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
