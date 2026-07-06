import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  IconGripVertical, IconPlus, IconMapPin, IconPencil, IconTrash, IconCalendarPlus, IconRoute, IconInfoCircle, IconChevronDown, IconCheck, IconLayoutGrid, IconCopy, IconClipboard, IconTarget, IconSwitchHorizontal,
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
import { confirmDialog, choiceDialog } from '@/lib/confirm'
import { offerUndo } from '@/lib/undo'
import { toast } from '@/lib/toast'
import { formatLongDate } from '@/lib/format'
import { setInPlan, toggleInterest } from '@/lib/placeMutations'
import { useWeather, tripCityCandidates, type DayWeather } from '@/lib/weather'
import { tripTz } from '@/lib/segments'
import { WeatherBadge } from '@/components/WeatherBadge'
import { ReminderSettings } from '@/components/ReminderSettings'
import {
  addDay, updateDay, deleteDay, addStop, updateStop, deleteStop, setStopDone, persistStopOrder, persistDayOrder,
  type StopInput,
} from '@/lib/mutations'
import type { ItineraryDay, ItineraryStop, Place } from '@/lib/database.types'

function SortableStop({
  stop, matchedPlace, canEdit, isNext, onToggleDone, onOpenDetail, onEdit, onDelete, onEditRoute, onSkipRoute, onCopy, onMoveBackup,
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
  onCopy: () => void
  onMoveBackup: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id, disabled: !canEdit })
  const done = !!stop.done
  const style = {
    transform: CSS.Transform.toString(transform), transition,
    opacity: isDragging ? 0.5 : done ? 0.5 : 1,
  }
  const mode = stop.link_mode ?? 'map'
  const detailMode = mode === 'detail' && !!matchedPlace
  const tapAction = mode === 'none' ? null : detailMode ? () => onOpenDetail(matchedPlace!) : () => openMap(stop.map_url)

  return (
    <div ref={setNodeRef} id={`stop-${stop.id}`} style={style}>
      {/* PLACE CARD — one to-do-style card per stop */}
      <div className="flex gap-2.5 rounded-[10px] p-3" style={{
        background: isNext ? 'var(--color-brand-soft)' : 'var(--color-surface)',
        border: `0.5px solid ${isNext ? 'var(--color-brand-border)' : 'var(--color-line)'}`,
      }}>
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
              { label: 'คัดลอก', icon: <IconCopy size={15} />, onClick: onCopy },
              { label: 'ย้ายไปแผนสำรอง', icon: <IconTarget size={15} />, onClick: onMoveBackup },
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
        {/* TRANSIT SUB-CARD — the route to this stop nests inside its place card */}
        {!done && stop.transit && <MetroRoute transit={stop.transit} onEdit={canEdit ? onEditRoute : undefined} />}
      </div>
      </div>
    </div>
  )
}

function DayCard({
  day, index, stops, backups, getMatchedPlace, canEdit, collapsed, nextStopId, wx, isPast, onToggleCollapse, onToggleDone, onOpenDetail, onEditDay, onDeleteDay, onAddStop, onInsertStop, onEditStop, onDeleteStop, onEditRoute, onSkipRoute, onCopyStop, canPaste, onPaste, onUseBackup, onMoveToBackup, onPromoteBackup,
}: {
  day: ItineraryDay
  index: number
  stops: ItineraryStop[]
  backups: ItineraryStop[]
  getMatchedPlace: (s: ItineraryStop) => Place | null
  canEdit: boolean
  collapsed: boolean
  nextStopId: string | null
  wx: DayWeather | null | undefined
  isPast: boolean
  onToggleCollapse: () => void
  onToggleDone: (s: ItineraryStop) => void
  onOpenDetail: (p: Place) => void
  onEditDay: () => void
  onDeleteDay: () => void
  onAddStop: () => void
  onInsertStop: (at: number) => void
  onEditStop: (s: ItineraryStop) => void
  onDeleteStop: (id: string) => void
  onEditRoute: (s: ItineraryStop) => void
  onSkipRoute: (s: ItineraryStop) => void
  onCopyStop: (s: ItineraryStop) => void
  canPaste: boolean
  onPaste: () => void
  onUseBackup: (b: ItineraryStop) => void
  onMoveToBackup: (s: ItineraryStop) => void
  onPromoteBackup: (b: ItineraryStop) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: day.id, disabled: !canEdit })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 10 : undefined }
  const doneCount = stops.filter((s) => s.done).length
  const [bkOpen, setBkOpen] = useState(false)

  return (
    <div ref={setNodeRef} style={style} className="relative flex flex-col">
      {/* Blue strip — sits BEHIND the content card (z-0) and peeks out at the TOP with
          its own rounded top corners (layered look; mirrors the trip card's bottom
          strip, flipped to the top). Day N · weather · collapse live here. */}
      <div className="relative -mb-3 pt-1 pb-4 px-3.5 rounded-t-[14px] flex items-center justify-between gap-2 text-white" style={{ background: isPast ? '#5B6573' : 'var(--color-brand)' }}>
        <div className="flex items-center gap-1.5 min-w-0">
          {canEdit && (
            <button {...attributes} {...listeners} className="text-white/70 cursor-grab active:cursor-grabbing touch-none shrink-0" aria-label="ลากย้ายวัน">
              <IconGripVertical size={14} />
            </button>
          )}
          <span className="inline-flex items-center rounded-full px-2 py-px text-[10px] font-semibold shrink-0 bg-white/20">Day {index + 1}</span>
          {wx && <WeatherBadge wx={wx} size={11} className="text-[10px] text-white/90 shrink-0" />}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {canEdit && (
            <PopMenu size={22} buttonClassName="!bg-transparent !text-white hover:!bg-white/15" items={[
              { label: 'แก้ไขวัน', icon: <IconPencil size={15} />, onClick: onEditDay },
              ...(canPaste ? [{ label: 'วางจุดแวะที่คัดลอก', icon: <IconClipboard size={15} />, onClick: onPaste }] : []),
              { label: 'ลบวัน', icon: <IconTrash size={15} />, onClick: onDeleteDay, danger: true },
            ]} />
          )}
          <button onClick={onToggleCollapse} className="!size-[22px] grid place-items-center rounded-md text-white/90 hover:bg-white/15" aria-label={collapsed ? 'เปิดวัน' : 'พับวัน'} aria-expanded={!collapsed}>
            <IconChevronDown size={15} className={`transition-transform ${collapsed ? '-rotate-90' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content card paints over the strip's bottom via DOM order (no z-index, so the
          strip's PopMenu dropdown isn't trapped in a stacking context behind it). */}
      <div className="card relative overflow-hidden">
        {/* Date row — date + activity count inline, separated by • */}
        <button onClick={onToggleCollapse} className="w-full text-left px-4 py-3" style={collapsed ? undefined : { borderBottom: '0.5px solid var(--color-line)' }} aria-expanded={!collapsed}>
          <div className="truncate leading-tight">
            <span className="text-[14px] font-semibold">{formatLongDate(day.day_date)}</span>
            <span className="text-[12px] text-ink-3 font-normal"> • {stops.length} กิจกรรม{doneCount > 0 ? ` · เสร็จ ${doneCount}/${stops.length}` : ''}</span>
          </div>
          {day.label && <div className="text-[12px] text-ink-3 truncate mt-0.5">{day.label}</div>}
        </button>

        {!collapsed && (
          <div className="p-3 space-y-2.5 min-h-[60px] bg-surface-2">
            {stops.length === 0 && <div className="text-[12px] text-ink-3 text-center py-2">ยังไม่มีจุดแวะในวันนี้ — ลากกิจกรรมมาวางที่นี่ได้</div>}
            <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className={canEdit ? '' : 'space-y-2.5'}>
                {stops.flatMap((s, i) => {
                  const nodes = [
                    <SortableStop key={s.id} stop={s} matchedPlace={getMatchedPlace(s)} canEdit={canEdit} isNext={s.id === nextStopId} onToggleDone={() => onToggleDone(s)} onOpenDetail={onOpenDetail} onEdit={() => onEditStop(s)} onDelete={() => onDeleteStop(s.id)} onEditRoute={() => onEditRoute(s)} onSkipRoute={() => onSkipRoute(s)} onCopy={() => onCopyStop(s)} onMoveBackup={() => onMoveToBackup(s)} />,
                  ]
                  // subtle "+" between two activities → insert a new stop right here
                  if (canEdit && i < stops.length - 1) {
                    nodes.push(
                      <div key={`ins-${s.id}`} className="flex justify-center py-0.5">
                        <button onClick={() => onInsertStop(i + 1)} aria-label="แทรกกิจกรรมตรงนี้" title="แทรกกิจกรรมตรงนี้"
                          className="size-[18px] rounded-full grid place-items-center text-ink-3 hover:text-brand-mid transition-colors"
                          style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-line)' }}>
                          <IconPlus size={12} />
                        </button>
                      </div>,
                    )
                  }
                  return nodes
                })}
              </div>
            </SortableContext>

            {/* 🎯 แผนสำรอง — collapsed dashed bar; expands to dimmed backup cards.
                Backups have no time, aren't counted and never fire reminders. */}
            {backups.length > 0 && (
              <div className="rounded-[10px] p-2.5" style={{ border: '0.5px dashed var(--color-line-2)', background: 'rgba(238,241,246,.5)' }}>
                <button onClick={() => setBkOpen((o) => !o)} className="w-full flex items-center gap-2 text-[12px] font-medium text-ink-2" aria-expanded={bkOpen}>
                  <IconTarget size={14} className="text-ink-3" /> แผนสำรอง
                  <span className="text-[10.5px] text-ink-3 bg-surface-2 rounded-full px-1.5 py-px tabular-nums">{backups.length}</span>
                  <span className="ml-auto text-[11px] text-ink-3 flex items-center gap-0.5">
                    {bkOpen ? 'พับเก็บ' : 'แตะเพื่อเปิด'} <IconChevronDown size={12} className={`transition-transform ${bkOpen ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                {bkOpen && (
                  <div className="space-y-2 mt-2.5">
                    {backups.map((b) => (
                      <div key={b.id} className="rounded-[10px] p-2.5 bg-surface" style={{ border: '0.5px solid var(--color-line)' }}>
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium text-ink-2 flex items-center gap-1.5">
                              <span className="truncate">{b.place_name || 'จุดสำรอง'}</span>
                              <span className="text-[9px] font-semibold rounded-full px-1.5 py-0.5 shrink-0" style={{ background: '#FDF1E3', color: '#D97706', border: '0.5px solid #F3DDBD' }}>สำรอง</span>
                            </div>
                            {b.note && <div className="text-[11px] text-ink-3 mt-0.5">{b.note}</div>}
                          </div>
                          {canEdit && (
                            <PopMenu items={[
                              { label: 'แก้ไข', icon: <IconPencil size={15} />, onClick: () => onEditStop(b) },
                              { label: 'เพิ่มเข้าตาราง (ไม่แทนใคร)', icon: <IconPlus size={15} />, onClick: () => onPromoteBackup(b) },
                              { label: 'ลบ', icon: <IconTrash size={15} />, onClick: () => onDeleteStop(b.id), danger: true },
                            ]} />
                          )}
                        </div>
                        {canEdit && (
                          <button onClick={() => onUseBackup(b)}
                            className="mt-2 w-full h-8 rounded-full text-[11.5px] font-medium flex items-center justify-center gap-1.5"
                            style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }}>
                            <IconSwitchHorizontal size={13} /> ใช้ตัวนี้แทน
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {canEdit && <button onClick={onAddStop} className="btn-link flex items-center gap-1.5 pt-1"><IconPlus size={15} /> เพิ่มกิจกรรม</button>}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Itinerary() {
  const { trip, days, stops, places, interests, memberProfiles, reload, patch, canEdit } = useTrip()
  const { user } = useAuth()
  const [detailPlace, setDetailPlace] = useState<Place | null>(null)
  const dayWx = useWeather(trip ? tripCityCandidates(trip) : [], days.map((d) => d.day_date).filter(Boolean) as string[])

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
  const [editor, setEditor] = useState<{ dayId: string; stop?: ItineraryStop; at?: number } | null>(null)
  const [dayEdit, setDayEdit] = useState<{ id: string; label: string | null; day_date: string | null; version?: number } | null>(null)
  const [routeEdit, setRouteEdit] = useState<ItineraryStop | null>(null)

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  // date filter above the day cards: null = show all days, otherwise a single day
  const [filterDayId, setFilterDayId] = useState<string | null>(null)
  // desktop click-drag to scroll the filter strip (touch uses native scrolling)
  const filterScrollRef = useRef<HTMLDivElement>(null)
  const filterDrag = useRef({ down: false, startX: 0, startLeft: 0, moved: false })
  function onFilterPointerDown(e: ReactPointerEvent) {
    if (e.pointerType !== 'mouse' || !filterScrollRef.current) return
    filterDrag.current = { down: true, startX: e.clientX, startLeft: filterScrollRef.current.scrollLeft, moved: false }
  }
  function onFilterPointerMove(e: ReactPointerEvent) {
    const d = filterDrag.current
    if (!d.down || !filterScrollRef.current) return
    const dx = e.clientX - d.startX
    if (Math.abs(dx) > 3) d.moved = true
    filterScrollRef.current.scrollLeft = d.startLeft - dx
  }
  function endFilterDrag() { filterDrag.current.down = false }
  // a drag shouldn't also fire the chip's click; the choice is remembered per trip
  function pickDay(id: string | null) {
    if (filterDrag.current.moved) return
    setFilterDayId(id)
    const key = trip?.id ? `taurus:itin:filter:${trip.id}` : null
    if (key) { try { id ? localStorage.setItem(key, id) : localStorage.removeItem(key) } catch { /* ignore */ } }
  }
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

  // remember the selected date filter, per trip, across tab switches / reloads
  const filterKey = trip?.id ? `taurus:itin:filter:${trip.id}` : null
  useEffect(() => {
    if (!filterKey) { setFilterDayId(null); return }
    try { setFilterDayId(localStorage.getItem(filterKey) || null) } catch { setFilterDayId(null) }
  }, [filterKey])

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
      return new Intl.DateTimeFormat('en-CA', { timeZone: tripTz(trip) || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    } catch { return new Date().toISOString().slice(0, 10) }
  }, [trip])
  const nextStopId = useMemo(() => {
    const today = localDays.find((d) => d.day_date === todayStr)
    if (!today) return null
    return (stopsByDay.get(today.id) ?? []).find((s) => !s.done && s.role !== 'backup')?.id ?? null
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
    const toggled = { ...s, done, done_at }
    const updated = stopsRef.current.map((x) => (x.id === s.id ? toggled : x))
    const dayList = updated.filter((x) => x.day_id === s.day_id && x.role !== 'backup').sort((a, b) => a.position - b.position)
    // Build the day order: active items first, done items last.
    const active = dayList.filter((x) => !x.done && x.id !== s.id)
    const doneItems = dayList.filter((x) => x.done && x.id !== s.id)
    let orderedDay: ItineraryStop[]
    if (done) {
      // checked → sinks to the very bottom of the done group
      orderedDay = [...active, ...doneItems, toggled]
    } else {
      // un-checked → returns to its planned (time-sorted) slot among the active items
      const t = toggled.time
      let at = active.length
      if (t != null) {
        const after = active.findIndex((o) => o.time != null && o.time > t)
        at = after >= 0 ? after : active.map((o) => o.time != null).lastIndexOf(true) + 1
      }
      orderedDay = [...active.slice(0, at), toggled, ...active.slice(at), ...doneItems]
    }
    const ordered = orderedDay.map((x, i) => ({ ...x, position: i }))
    const byId = new Map(ordered.map((x) => [x.id, x]))
    const next = updated.map((x) => byId.get(x.id) ?? x)
    // optimistic only — no reload() here (a full refetch re-renders every card and
    // looks like a flicker). The realtime subscription reconciles in the background.
    // setStopDone has no version guard, so rapid taps always persist the latest state.
    patch((d) => ({ stops: d.stops.map((x) => (byId.get(x.id) ?? x)) }))
    setLocalStops(next)
    stopsRef.current = next
    setStopDone(s.id, done, done_at)
    persistStopOrder(ordered)
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
    const dst = without.filter((s) => s.day_id === toDay && s.role !== 'backup').sort((a, b) => a.position - b.position)
    const overIdx = dst.findIndex((s) => s.id === overId)
    dst.splice(overIdx >= 0 ? overIdx : dst.length, 0, { ...moving, day_id: toDay })
    const next = [...without.filter((s) => s.day_id !== toDay || s.role === 'backup'), ...dst.map((s, i) => ({ ...s, position: i }))]
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
      // Cards render with past days sunk to the bottom, so visual indices only
      // match localDays indices within the same group (past vs upcoming — the
      // stable sort preserves relative order inside each). A drag across the
      // two groups would land somewhere the user didn't aim for → ignore it.
      const isPast = (d: ItineraryDay) => !!d.day_date && d.day_date < todayStr
      if (isPast(localDays[oldIdx]) !== isPast(localDays[newIdx])) return
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
    const list = cur.filter((s) => s.day_id === finalDay && s.role !== 'backup').sort((a, b) => a.position - b.position)
    const oldIdx = list.findIndex((s) => s.id === activeId)
    let newIdx = list.findIndex((s) => s.id === overId)
    if (newIdx < 0) newIdx = list.length - 1 // dropped on day area → end
    const reordered = (oldIdx >= 0 && newIdx >= 0) ? arrayMove(list, oldIdx, newIdx) : list
    const crossed = origin != null && origin !== finalDay
    // Same-day reorder: the TIME SLOTS stay put (top→bottom order preserved) and
    // only the places move between them — so dragging a place onto an earlier
    // slot swaps their times. Cross-day move: the stop carries its own time.
    const slotTimes = list.map((s) => s.time)
    const finalPos = reordered.map((s, i) => ({ ...s, position: i, ...(crossed ? {} : { time: slotTimes[i] ?? null }) }))
    let next = [...cur.filter((s) => s.day_id !== finalDay || s.role === 'backup'), ...finalPos]
    let toPersist = [...finalPos]
    if (crossed) {
      const originPos = next.filter((s) => s.day_id === origin && s.role !== 'backup').sort((a, b) => a.position - b.position).map((s, i) => ({ ...s, position: i }))
      next = [...next.filter((s) => s.day_id !== origin || s.role === 'backup'), ...originPos]
      toPersist = [...toPersist, ...originPos]
    }
    stopsRef.current = next
    setLocalStops(next)
    await persistStopOrder(toPersist, { withTime: !crossed })
    // same-day reorder re-pins the time labels to their slots → tell the user so
    // (also a clear signal this build is live)
    if (!crossed && slotTimes.some(Boolean) && oldIdx !== newIdx) toast.success('สลับเวลาตามตำแหน่งใหม่แล้ว')
    await reload()
  }

  async function saveStop(input: StopInput) {
    if (!trip || !editor) return
    const dayId = editor.dayId
    const dayStops = (stopsByDay.get(dayId) ?? []).filter((s) => s.role !== 'backup')
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
      const pos = editor.at ?? dayStops.length
      await addStop(trip.id, dayId, pos, input, id)
      target = {
        id, day_id: dayId, trip_id: trip.id, position: pos,
        time: input.time ?? null, place_name: input.place_name ?? null, map_url: input.map_url ?? null,
        note: input.note ?? null, transit: input.transit ?? null, link_mode: input.link_mode ?? null,
        created_at: new Date().toISOString(),
      }
    }
    // a stop with a clear time slots into its chronological position AMONG THE
    // OTHER TIMED stops. If nothing is scheduled later, it sits at the end of the
    // timed group (just above any not-yet-timed stops) — never below them.
    if (input.time && input.role !== 'backup') {
      const rest = dayStops.filter((s) => s.id !== target.id)
      let insertAt = rest.findIndex((s) => s.time != null && s.time > input.time!)
      if (insertAt < 0) insertAt = rest.map((s) => s.time != null).lastIndexOf(true) + 1
      const ordered = [...rest.slice(0, insertAt), target, ...rest.slice(insertAt)]
      await persistStopOrder(ordered.map((s, i) => ({ ...s, position: i })))
    } else if (!editor.stop && editor.at != null) {
      // inserted via the "+" between two activities (no time given) → drop it
      // exactly at the chosen slot rather than at the end of the day.
      const rest = dayStops.filter((s) => s.id !== target.id)
      const at = Math.min(editor.at, rest.length)
      const ordered = [...rest.slice(0, at), target, ...rest.slice(at)]
      await persistStopOrder(ordered.map((s, i) => ({ ...s, position: i })))
    }
    await reload()
  }
  // Copy/paste a stop's content (place + arranged transit) across days. The
  // clipboard lives for the session; paste drops a fresh copy into a day.
  type StopClip = Pick<ItineraryStop, 'time' | 'place_name' | 'note' | 'map_url' | 'transit' | 'link_mode' | 'skip_transit'>
  const [clipboard, setClipboard] = useState<StopClip | null>(null)
  function copyStop(s: ItineraryStop) {
    setClipboard({ time: s.time, place_name: s.place_name, note: s.note, map_url: s.map_url, transit: s.transit, link_mode: s.link_mode, skip_transit: s.skip_transit })
    toast.success(`คัดลอก "${s.place_name || 'จุดแวะ'}" แล้ว — กด ⋯ ของวันเพื่อวาง`)
  }
  // Paste the clipboard into a day. `at` = a specific slot (from the "+" between
  // stops); omitted = slot by time (timed) or append (untimed), as the day menu does.
  async function pasteStop(dayId: string, at?: number) {
    if (!trip || !clipboard) return
    const dayStops = stopsByDay.get(dayId) ?? []
    const id = crypto.randomUUID()
    const input: StopInput = {
      time: clipboard.time ?? null, place_name: clipboard.place_name ?? null, note: clipboard.note ?? null,
      map_url: clipboard.map_url ?? null, transit: clipboard.transit ?? null,
      link_mode: clipboard.link_mode ?? null, skip_transit: clipboard.skip_transit ?? null,
    }
    let ordered: ItineraryStop[]
    const fresh = { id, day_id: dayId, trip_id: trip.id, position: dayStops.length, created_at: new Date().toISOString(), ...input } as ItineraryStop
    if (at != null) {
      const idx = Math.min(Math.max(at, 0), dayStops.length)
      ordered = [...dayStops.slice(0, idx), fresh, ...dayStops.slice(idx)]
    } else if (clipboard.time) {
      let a = dayStops.findIndex((s) => s.time != null && s.time > clipboard.time!)
      if (a < 0) a = dayStops.map((s) => s.time != null).lastIndexOf(true) + 1
      ordered = [...dayStops.slice(0, a), fresh, ...dayStops.slice(a)]
    } else {
      ordered = [...dayStops, fresh]
    }
    await addStop(trip.id, dayId, ordered.indexOf(fresh), input, id)
    await persistStopOrder(ordered.map((s, i) => ({ ...s, position: i })))
    await reload()
    toast.success('วางจุดแวะแล้ว')
  }
  // "+" between stops: paste here or add new when the clipboard has content,
  // otherwise open the add editor directly at that slot.
  async function insertAt(dayId: string, at: number) {
    if (clipboard) {
      const choice = await choiceDialog({
        title: 'แทรกตรงนี้',
        choices: [
          { label: `วาง "${clipboard.place_name || 'จุดแวะ'}"`, value: 'paste' },
          { label: 'เพิ่มกิจกรรมใหม่', value: 'new' },
        ],
      })
      if (!choice) return
      if (choice === 'paste') { await pasteStop(dayId, at); return }
    }
    setEditor({ dayId, at })
  }
  // ---- แผนหลัก/สำรอง ----
  const mainsOf = (dayId: string) => (stopsByDay.get(dayId) ?? []).filter((s) => s.role !== 'backup')

  async function moveToBackup(s: ItineraryStop) {
    patch((d) => ({ stops: d.stops.map((x) => (x.id === s.id ? { ...x, role: 'backup' } : x)) }))
    await updateStop(s.id, { role: 'backup' }, s.version)
    await reload()
    toast.success('ย้ายไปแผนสำรองแล้ว')
  }
  async function promoteBackup(b: ItineraryStop) {
    const mains = mainsOf(b.day_id)
    patch((d) => ({ stops: d.stops.map((x) => (x.id === b.id ? { ...x, role: null } : x)) }))
    await updateStop(b.id, { role: null }, b.version)
    await persistStopOrder([...mains, { ...b, role: null }].map((s, i) => ({ ...s, position: i })))
    await reload()
    toast.success('เพิ่มเข้าตารางแล้ว')
  }
  async function useBackup(b: ItineraryStop) {
    const mains = mainsOf(b.day_id)
    if (mains.length === 0) { await promoteBackup(b); return }
    const pick = await choiceDialog({
      title: `ใช้ "${b.place_name || 'จุดสำรอง'}" แทนจุดไหน?`,
      message: 'จุดที่ถูกแทนจะย้ายลงไปอยู่แผนสำรองแทน (สลับที่กัน) — เวลาของช่องเดิมยังอยู่ครบ',
      choices: [
        ...mains.map((m) => ({ value: m.id, label: `แทนที่ ${m.place_name ?? '-'}${m.time ? ` · ${m.time.slice(0, 5)}` : ''}` })),
        { value: 'append', label: '＋ เพิ่มเข้าตารางเฉยๆ (ไม่แทนใคร)' },
      ],
    })
    if (!pick) return
    if (pick === 'append') { await promoteBackup(b); return }
    const target = mains.find((m) => m.id === pick)
    if (!target) return
    // the backup takes over the slot: its time + position (+ the slot's route
    // when the backup has none of its own); the old stop drops to สำรอง
    patch((d) => ({ stops: d.stops.map((x) =>
      x.id === b.id ? { ...x, role: null, time: target.time, transit: x.transit ?? target.transit }
        : x.id === target.id ? { ...x, role: 'backup' } : x) }))
    await updateStop(b.id, { role: null, time: target.time, transit: b.transit ?? target.transit }, b.version)
    await updateStop(target.id, { role: 'backup' }, target.version)
    const ordered = mains.map((m) => (m.id === target.id ? { ...b } : m))
    await persistStopOrder(ordered.map((s, i) => ({ ...s, position: i })))
    await reload()
    toast.success(`สลับแผนแล้ว — "${b.place_name ?? ''}" เข้าตาราง`)
  }

  async function removeStop(id: string) {
    const row = stops.find((s) => s.id === id)
    if (!row) return
    const name = row.place_name || 'จุดแวะนี้'
    // other days this stop could move to (exclude its current one)
    const otherDays = localDays.filter((d) => d.id !== row.day_id)

    const place = getMatchedPlace(row)
    const action = await choiceDialog({
      title: name,
      message: 'ต้องการทำอะไรกับจุดแวะนี้?',
      choices: [
        ...(otherDays.length ? [{ label: 'เปลี่ยนวัน', value: 'move' }] : []),
        // only meaningful when this stop is linked to an in-plan place
        ...(place?.in_plan ? [{ label: 'เอาออกจากวันนี้ (ยังอยู่ในแพลน)', value: 'unschedule' }] : []),
        { label: 'เอาออกจากแพลน', value: 'remove', danger: true },
      ],
    })
    if (!action) return

    if (action === 'move') {
      const pick = await choiceDialog({
        title: `ย้าย "${name}" ไปวันไหน`,
        choices: otherDays.map((d) => {
          const n = localDays.indexOf(d) + 1
          return { value: d.id, label: `Day ${n}${d.day_date ? ` · ${formatLongDate(d.day_date)}` : ''}` }
        }),
      })
      if (!pick) return
      // append to the end of the chosen day, keeping every row's current position
      const dayStops = stops.filter((s) => s.day_id === pick)
      const nextPos = dayStops.length ? Math.max(...dayStops.map((s) => s.position)) + 1 : 0
      patch((d) => ({ stops: d.stops.map((s) => (s.id === id ? { ...s, day_id: pick, position: nextPos } : s)) }))
      await persistStopOrder([{ ...row, day_id: pick, position: nextPos }])
      await reload()
      toast.success('ย้ายวันแล้ว')
      return
    }

    // unschedule = drop the stop off the day but KEEP the place in the plan
    // (stays on Places "in plan" + All plans); remove = also clear in_plan so it
    // disappears everywhere.
    const clearPlan = action === 'remove' && !!place?.in_plan
    await deleteStop(id)
    if (clearPlan) {
      patch((d) => ({ places: d.places.map((x) => (x.id === place!.id ? { ...x, in_plan: false } : x)) }))
      await setInPlan(place!.id, false)
    }
    await reload()
    offerUndo(action === 'remove' ? 'เอาออกจากแพลนแล้ว' : 'เอาออกจากวันแล้ว',
      [{ table: 'itinerary_stops', rows: [row] }],
      async () => { if (clearPlan) await setInPlan(place!.id, true); await reload() })
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

  // A day is "past" once its date is before today (trip timezone). Past days keep
  // their chronological Day number but sink to the bottom of the list (stable sort).
  const displayDays = localDays
    .map((day, idx) => ({ day, idx, isPast: !!day.day_date && day.day_date < todayStr }))
    .sort((a, b) => Number(a.isPast) - Number(b.isPast))

  // the selected day must still exist; otherwise fall back to "all"
  const activeFilter = filterDayId && localDays.some((d) => d.id === filterDayId) ? filterDayId : null
  const shownDays = activeFilter ? displayDays.filter((d) => d.day.id === activeFilter) : displayDays
  const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  return (
    <div className="space-y-4">
      {localDays.length > 0 && <ReminderSettings />}

      {/* Date filter — "ดูทั้งหมด" + one chip per planned day (past days go gray).
          Sized so 6 chips fill the row; extra days scroll (faint fade hints at more).
          Desktop: click-drag to scroll; touch uses native scrolling. */}
      {localDays.length > 0 && (
        <div className="relative">
          <div ref={filterScrollRef}
            onPointerDown={onFilterPointerDown} onPointerMove={onFilterPointerMove}
            onPointerUp={endFilterDrag} onPointerLeave={endFilterDrag}
            className="flex gap-2 overflow-x-auto pb-1 select-none cursor-grab active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none' }}>
            <button onClick={() => pickDay(null)} aria-pressed={activeFilter == null}
              className="shrink-0 grow-0 basis-[calc((100%-2.5rem)/6)] py-3 rounded-[12px] flex flex-col items-center justify-center gap-1 transition-colors"
              style={activeFilter == null
                ? { background: 'var(--color-brand)', color: '#fff' }
                : { background: 'var(--color-surface)', color: 'var(--color-ink-2)', border: '0.5px solid var(--color-line)' }}>
              <IconLayoutGrid size={18} />
              <span className="text-[10px] font-medium leading-none">ทั้งหมด</span>
            </button>
            {/* chips follow displayDays so their order always matches the cards below */}
            {displayDays.map(({ day, isPast }) => {
              const dt = day.day_date ? new Date(day.day_date) : null
              const selected = activeFilter === day.id
              return (
                <button key={day.id} onClick={() => pickDay(day.id)} aria-pressed={selected}
                  className="shrink-0 grow-0 basis-[calc((100%-2.5rem)/6)] py-3 rounded-[12px] flex flex-col items-center justify-center gap-1 transition-colors"
                  style={selected
                    ? { background: 'var(--color-brand)', color: '#fff' }
                    : isPast
                      ? { background: 'var(--color-surface-2)', color: 'var(--color-ink-3)', border: '0.5px solid var(--color-line)' }
                      : { background: 'var(--color-surface)', color: 'var(--color-ink)', border: '0.5px solid var(--color-line)' }}>
                  <span className="text-[19px] font-bold leading-none tabular-nums">{dt ? dt.getDate() : '–'}</span>
                  <span className="text-[10px] font-medium uppercase leading-none opacity-80">{dt ? WD[dt.getDay()] : ''}</span>
                </button>
              )
            })}
          </div>
          {/* faint fade on the right edge when there are more than 6 chips to slide to */}
          {localDays.length + 1 > 6 && (
            <div className="pointer-events-none absolute top-0 right-0 bottom-1 w-12 rounded-r-[12px]"
              style={{ background: 'linear-gradient(to left, var(--color-canvas), transparent)' }} />
          )}
        </div>
      )}

      <DndContext sensors={daySensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        <SortableContext items={shownDays.map((d) => d.day.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {shownDays.map(({ day, idx, isPast }) => (
              <DayCard
                key={day.id}
                day={day}
                index={idx}
                isPast={isPast}
                stops={(stopsByDay.get(day.id) ?? []).filter((s) => s.role !== 'backup')}
                backups={(stopsByDay.get(day.id) ?? []).filter((s) => s.role === 'backup')}
                getMatchedPlace={getMatchedPlace}
                canEdit={canEdit}
                wx={day.day_date ? dayWx[day.day_date] : undefined}
                // When a single day is picked via the filter, show it expanded.
                // Otherwise past days auto-collapse: for them the stored toggle means
                // "deviate from the default" (default = collapsed), so entry = expanded.
                collapsed={activeFilter ? false : isPast ? !collapsed.has(day.id) : collapsed.has(day.id)}
                nextStopId={nextStopId}
                onToggleCollapse={() => toggleCollapse(day.id)}
                onToggleDone={toggleDone}
                onOpenDetail={setDetailPlace}
                onEditDay={() => setDayEdit({ id: day.id, label: day.label, day_date: day.day_date, version: day.version })}
                onDeleteDay={() => removeDay(day.id)}
                onAddStop={() => setEditor({ dayId: day.id })}
                onInsertStop={(at) => insertAt(day.id, at)}
                onEditStop={(s) => setEditor({ dayId: day.id, stop: s })}
                onDeleteStop={removeStop}
                onEditRoute={(s) => setRouteEdit(s)}
                onSkipRoute={skipRoute}
                onCopyStop={copyStop}
                canPaste={!!clipboard}
                onPaste={() => pasteStop(day.id)}
                onUseBackup={useBackup}
                onMoveToBackup={moveToBackup}
                onPromoteBackup={promoteBackup}
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
