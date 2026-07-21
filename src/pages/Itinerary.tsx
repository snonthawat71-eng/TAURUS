import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  IconGripVertical, IconPlus, IconMapPin, IconPencil, IconTrash, IconCalendarPlus, IconRoute, IconInfoCircle, IconChevronDown, IconCheck, IconLayoutGrid, IconCopy, IconClipboard, IconTarget, IconLayoutList, IconChevronRight,
} from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { MetroRoute } from '@/components/MetroRoute'
import { StopSuggestions, suggestForStop, type DaySuggestion } from '@/components/DaySuggestions'
import { coordsForPlace } from '@/lib/placeGeo'
import type { LatLng } from '@/lib/geo'
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
import { planMapUrl } from '@/lib/branches'
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
  stop, matchedPlace, canEdit, isNext, preview, suggestions, onAddSuggestion, onDismissSug, onToggleDone, onOpenDetail, onEdit, onDelete, onEditRoute, onSkipRoute, onCopy, onMoveBackup,
}: {
  stop: ItineraryStop
  matchedPlace: Place | null
  canEdit: boolean
  isNext: boolean
  /** while THIS stop is being dragged: the time it will have if dropped here
   *  (null = untimed). undefined = not dragging → show the stored time. */
  preview?: string | null
  suggestions: DaySuggestion[]
  onAddSuggestion: (p: Place) => void
  onDismissSug: () => void
  onToggleDone: () => void
  onOpenDetail: (p: Place) => void
  onEdit: () => void
  onDelete: () => void
  onEditRoute: () => void
  onSkipRoute: () => void
  onCopy: () => void
  onMoveBackup: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver, index, activeIndex } = useSortable({
    id: stop.id, disabled: !canEdit,
    // snappier, springier shuffle when neighbours make way for the dragged card
    transition: { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  })
  const done = !!stop.done
  const base = CSS.Transform.toString(transform)
  const style = {
    // the dragged card LIFTS: slight grow + tilt on top of the pointer-follow
    transform: isDragging ? [base, 'scale(1.03) rotate(0.6deg)'].filter(Boolean).join(' ') : base,
    transition,
    opacity: done && !isDragging ? 0.5 : 1,
    zIndex: isDragging ? 60 : undefined,
  }
  const mode = stop.link_mode ?? 'map'
  const detailMode = mode === 'detail' && !!matchedPlace
  const tapAction = mode === 'none' ? null : detailMode ? () => onOpenDetail(matchedPlace!) : () => openMap(stop.map_url)

  return (
    <div ref={setNodeRef} id={`stop-${stop.id}`} style={style} className="relative">
      {/* drop indicator — a brand line marking exactly where the dragged card
          will land relative to this one */}
      {isOver && !isDragging && activeIndex >= 0 && activeIndex !== index && (
        <div className="absolute left-1 right-1 h-[3px] rounded-full bg-brand pointer-events-none z-10"
          style={activeIndex > index ? { top: -5 } : { bottom: -5 }} />
      )}
      {/* PLACE CARD — one to-do-style card per stop; the 💡 bar is a full-width
          footer strip flush with the card's bottom edge */}
      <div className="rounded-[10px] overflow-hidden" style={{
        background: isNext ? 'var(--color-brand-soft)' : 'var(--color-surface)',
        border: `0.5px solid ${isNext ? 'var(--color-brand-border)' : 'var(--color-line)'}`,
        boxShadow: isDragging ? '0 16px 40px rgba(10,20,40,.28), 0 3px 10px rgba(10,20,40,.14)' : undefined,
      }}>
      <div className="flex gap-2.5 p-3">
      {/* grip + check-in + time, top-aligned so the time sits on the SAME line as
          the place name's first line */}
      <div className="flex items-start gap-1.5 shrink-0">
        {canEdit ? (
          // padded + negative-margined: a ~32px finger target while the icon
          // keeps its exact visual spot in the row
          <button {...attributes} {...listeners} className="p-2 -mx-2 -mb-2 -mt-1.5 text-ink-3 cursor-grab active:cursor-grabbing touch-none shrink-0" aria-label="ลากจัดเรียง">
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
        {/* while dragging, the cell previews the time this stop WILL have if
            dropped here (brand color); "—" = it stays untimed */}
        <div className="w-10 text-[13px] font-medium tabular-nums leading-snug"
          style={isDragging && preview !== undefined ? { color: 'var(--color-brand)', fontWeight: 700 } : undefined}>
          {isDragging && preview !== undefined ? (preview ?? '—') : stop.time}
        </div>
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
      {/* 💡 nearby-in-plan — full-width strip across the card's bottom */}
      {!done && canEdit && suggestions.length > 0 && (
        <StopSuggestions items={suggestions} onAdd={onAddSuggestion} onOpenDetail={onOpenDetail} onDismiss={onDismissSug} />
      )}
      </div>
    </div>
  )
}

/** A backup card inside the 🎯 zone — draggable straight into the schedule
 *  (dropping it among the day's stops promotes it to a main stop there). */
function SortableBackup({ stop, canEdit, onPromote, onEdit, onDelete }: {
  stop: ItineraryStop
  canEdit: boolean
  onPromote: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stop.id, disabled: !canEdit,
    transition: { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  })
  const bBase = CSS.Transform.toString(transform)
  const style = {
    transform: isDragging ? [bBase, 'scale(1.03) rotate(0.6deg)'].filter(Boolean).join(' ') : bBase,
    transition,
    opacity: 1,
    zIndex: isDragging ? 60 : undefined,
    filter: isDragging ? 'drop-shadow(0 14px 30px rgba(10,20,40,.26))' : undefined,
  }
  return (
    <div ref={setNodeRef} style={style} className="relative rounded-[10px] p-2.5 bg-surface" >
      <div className="flex items-start gap-2">
        {canEdit && (
          <button {...attributes} {...listeners} className="p-2 -mx-2 -mb-2 -mt-1.5 text-ink-3 cursor-grab active:cursor-grabbing touch-none shrink-0" aria-label="ลากเข้าตาราง">
            <IconGripVertical size={16} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-ink-2 flex items-center gap-1.5">
            <span className="truncate">{stop.place_name || 'จุดสำรอง'}</span>
            <span className="text-[9px] font-semibold rounded-full px-1.5 py-0.5 shrink-0" style={{ background: '#FDF1E3', color: '#D97706', border: '0.5px solid #F3DDBD' }}>สำรอง</span>
          </div>
          {stop.note && <div className="text-[11px] text-ink-3 mt-0.5">{stop.note}</div>}
        </div>
        {canEdit && (
          <PopMenu items={[
            { label: 'แก้ไข', icon: <IconPencil size={15} />, onClick: onEdit },
            { label: 'ลบ', icon: <IconTrash size={15} />, onClick: onDelete, danger: true },
          ]} />
        )}
      </div>
      {canEdit && (
        <button onClick={onPromote}
          className="mt-2 w-full h-8 rounded-full text-[11.5px] font-medium flex items-center justify-center gap-1.5"
          style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)', border: '0.5px solid var(--color-brand-border)' }}>
          <IconPlus size={13} /> เพิ่มเข้าตาราง — หรือลาก ⠿ ไปวางตรงไหนก็ได้
        </button>
      )}
    </div>
  )
}

/** A collapsed 🎯 แผนสำรอง fold — sits under the main stop it shares a time
 *  slot with (or at the day's end for backups with no matching time). The
 *  cards inside are draggable straight into the schedule. */
function BackupFold({ backups, canEdit, label, onPromote, onEditStop, onDeleteStop }: {
  backups: ItineraryStop[]
  canEdit: boolean
  label?: string
  onPromote: (b: ItineraryStop) => void
  onEditStop: (b: ItineraryStop) => void
  onDeleteStop: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-[10px] p-2.5 mt-1.5 ml-6" style={{ border: '0.5px dashed var(--color-line-2)', background: 'rgba(238,241,246,.5)' }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 text-[12px] font-medium text-ink-2" aria-expanded={open}>
        <IconTarget size={14} className="text-ink-3" /> {label ?? 'แผนสำรอง'}
        <span className="text-[10.5px] text-ink-3 bg-surface-2 rounded-full px-1.5 py-px tabular-nums">{backups.length}</span>
        <span className="ml-auto text-[11px] text-ink-3 flex items-center gap-0.5">
          {open ? 'พับเก็บ' : 'แตะเพื่อเปิด'} <IconChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="space-y-2 mt-2.5">
          {backups.map((b) => (
            <SortableBackup key={b.id} stop={b} canEdit={canEdit}
              onPromote={() => onPromote(b)}
              onEdit={() => onEditStop(b)}
              onDelete={() => onDeleteStop(b.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function DayCard({
  day, index, stops, backups, getMatchedPlace, canEdit, collapsed, nextStopId, wx, isPast, dragStopId, dragPreview, suggestionsFor, onAddSuggestion, onDismissSug, onToggleCollapse, onToggleDone, onOpenDetail, onEditDay, onDeleteDay, onAddStop, onInsertStop, onEditStop, onDeleteStop, onEditRoute, onSkipRoute, onCopyStop, canPaste, onPaste, onMoveToBackup, onPromoteBackup,
}: {
  day: ItineraryDay
  index: number
  stops: ItineraryStop[]
  backups: ItineraryStop[]
  dragStopId: string | null
  dragPreview: string | null
  getMatchedPlace: (s: ItineraryStop) => Place | null
  canEdit: boolean
  collapsed: boolean
  nextStopId: string | null
  wx: DayWeather | null | undefined
  isPast: boolean
  suggestionsFor: (s: ItineraryStop) => DaySuggestion[]
  onAddSuggestion: (p: Place) => void
  onDismissSug: (stopId: string) => void
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
  onMoveToBackup: (s: ItineraryStop) => void
  onPromoteBackup: (b: ItineraryStop) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: day.id, disabled: !canEdit,
    transition: { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  })
  const dBase = CSS.Transform.toString(transform)
  const style = {
    transform: isDragging ? [dBase, 'scale(1.01)'].filter(Boolean).join(' ') : dBase,
    transition,
    opacity: 1,
    zIndex: isDragging ? 30 : undefined,
    // drop-shadow follows the card's rounded silhouette (strip + card)
    filter: isDragging ? 'drop-shadow(0 18px 36px rgba(10,20,40,.28))' : undefined,
  }
  const doneCount = stops.filter((s) => s.done).length

  // แผนสำรองไปพับอยู่ใต้จุดหลักที่ "เวลาตรงกัน"; ที่เหลือ (เวลาไม่ตรง/ไม่ระบุ) รวมท้ายวัน
  const backupsForStop = new Map<string, ItineraryStop[]>()
  const looseBackups: ItineraryStop[] = []
  const timeToStop = new Map<string, string>()
  for (const s of stops) { const k = s.time?.slice(0, 5); if (k && !timeToStop.has(k)) timeToStop.set(k, s.id) }
  for (const b of backups) {
    const k = b.time?.slice(0, 5)
    const sid = k ? timeToStop.get(k) : undefined
    if (sid) { const arr = backupsForStop.get(sid) ?? []; arr.push(b); backupsForStop.set(sid, arr) }
    else looseBackups.push(b)
  }

  return (
    <div ref={setNodeRef} style={style} className="relative flex flex-col">
      {/* Blue strip — sits BEHIND the content card (z-0) and peeks out at the TOP with
          its own rounded top corners (layered look; mirrors the trip card's bottom
          strip, flipped to the top). Day N · weather · collapse live here. */}
      <div className="relative -mb-3 pt-1 pb-4 px-3.5 rounded-t-[14px] flex items-center justify-between gap-2 text-white" style={{ background: isPast ? '#5B6573' : 'var(--color-brand)' }}>
        <div className="flex items-center gap-1.5 min-w-0">
          {canEdit && (
            <button {...attributes} {...listeners} className="p-2 -m-2 text-white/70 cursor-grab active:cursor-grabbing touch-none shrink-0" aria-label="ลากย้ายวัน">
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
            <SortableContext items={[...stops.map((s) => s.id), ...backups.map((s) => s.id)]} strategy={verticalListSortingStrategy}>
              <div className={canEdit ? '' : 'space-y-2.5'}>
                {stops.flatMap((s, i) => {
                  const nodes = [
                    <SortableStop key={s.id} stop={s} matchedPlace={getMatchedPlace(s)} canEdit={canEdit} isNext={s.id === nextStopId} preview={s.id === dragStopId ? dragPreview : undefined} suggestions={suggestionsFor(s)} onAddSuggestion={onAddSuggestion} onDismissSug={() => onDismissSug(s.id)} onToggleDone={() => onToggleDone(s)} onOpenDetail={onOpenDetail} onEdit={() => onEditStop(s)} onDelete={() => onDeleteStop(s.id)} onEditRoute={() => onEditRoute(s)} onSkipRoute={() => onSkipRoute(s)} onCopy={() => onCopyStop(s)} onMoveBackup={() => onMoveToBackup(s)} />,
                  ]
                  // 🎯 แผนสำรองของช่วงเวลานี้ — พับไว้ใต้จุดหลักที่เวลาตรงกัน
                  const mine = backupsForStop.get(s.id)
                  if (mine?.length) {
                    nodes.push(
                      <BackupFold key={`bk-${s.id}`} backups={mine} canEdit={canEdit}
                        label={`แผนสำรอง · ${s.time?.slice(0, 5) ?? ''}`}
                        onPromote={onPromoteBackup} onEditStop={onEditStop} onDeleteStop={onDeleteStop} />,
                    )
                  }
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
              {/* แผนสำรองที่เวลาไม่ตรงกับจุดไหน (หรือยังไม่ระบุเวลา) — รวมไว้ท้ายวัน
                  (inside the SortableContext so the cards stay draggable into the schedule) */}
              {looseBackups.length > 0 && (
                <BackupFold backups={looseBackups} canEdit={canEdit}
                  onPromote={onPromoteBackup} onEditStop={onEditStop} onDeleteStop={onDeleteStop} />
              )}
            </SortableContext>

            {canEdit && <button onClick={onAddStop} className="btn-link flex items-center gap-1.5 pt-1"><IconPlus size={15} /> เพิ่มกิจกรรม</button>}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Itinerary() {
  const { trip, days, stops, places, interests, memberProfiles, reload, patch, canEdit } = useTrip()
  const navigate = useNavigate()
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

  // every place name already scheduled somewhere (any day, incl. backups) — the
  // suggestion strip only offers in-list places that aren't on the plan yet
  const scheduledNames = useMemo(() => {
    const set = new Set<string>()
    for (const s of localStops) if (s.place_name) set.add(s.place_name.trim().toLowerCase())
    return set
  }, [localStops])

  // Coordinates for in-list + scheduled places, pulled from their map links
  // (short links resolve once via /api/resolve-map and cache). Fills lat/lng on
  // the rows as a side effect, so this gets cheaper on every visit. Drives the
  // real-distance ranking of the 💡 suggestion strip.
  const [coordsMap, setCoordsMap] = useState<Map<string, LatLng | null>>(new Map())
  useEffect(() => {
    if (!canEdit) return
    const wanted = places.filter((p) =>
      (p.in_plan || (p.name && scheduledNames.has(p.name.trim().toLowerCase()))) && !coordsMap.has(p.id))
    if (!wanted.length) return
    let cancelled = false
    ;(async () => {
      for (const p of wanted) {
        const c = await coordsForPlace(p)
        if (cancelled) return
        setCoordsMap((prev) => { const n = new Map(prev); n.set(p.id, c); return n })
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, scheduledNames, canEdit])

  // stops whose 💡 bar was dismissed via "ไม่สนใจ" — remembered per trip
  const sugHideKey = trip?.id ? `taurus:itin:sug-hide:${trip.id}` : null
  const [sugHidden, setSugHidden] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!sugHideKey) { setSugHidden(new Set()); return }
    try { setSugHidden(new Set(JSON.parse(localStorage.getItem(sugHideKey) ?? '[]') as string[])) }
    catch { setSugHidden(new Set()) }
  }, [sugHideKey])
  function dismissSug(stopId: string) {
    setSugHidden((prev) => {
      const n = new Set(prev).add(stopId)
      if (sugHideKey) { try { localStorage.setItem(sugHideKey, JSON.stringify([...n])) } catch { /* ignore */ } }
      return n
    })
  }

  // one-tap add from the 💡 strip — appends to the end of the day's schedule
  async function addSuggested(dayId: string, p: Place) {
    if (!trip) return
    const mains = mainsOf(dayId)
    const pos = mains.length ? Math.max(...mains.map((s) => s.position)) + 1 : 0
    await addStop(trip.id, dayId, pos, { place_name: p.name, map_url: planMapUrl(p) })
    await reload()
    toast.success(`เพิ่ม "${p.name}" เข้าวันแล้ว`)
  }

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

  // ── drag UX: haptic ticks + a live "what time will it get" preview ────────
  const [dragStopId, setDragStopId] = useState<string | null>(null)
  const [dragPreview, setDragPreview] = useState<string | null>(null)
  const lastOverRef = useRef<string | null>(null)
  // tiny vibration ticks (no-op where unsupported, e.g. iOS Safari)
  const buzz = (ms: number) => { try { navigator.vibrate?.(ms) } catch { /* unsupported */ } }

  /** The time the dragged stop WILL have if dropped at the current hover spot —
   *  mirrors onDragEnd exactly: same-day timed drag re-pins times across the
   *  timed stops; untimed / cross-day stops keep their own time. */
  function previewTimeFor(activeId: string, overId: string): string | null {
    const cur = stopsRef.current
    const moving = cur.find((s) => s.id === activeId)
    if (!moving) return null
    const crossed = dragOrigin.current != null && dragOrigin.current !== moving.day_id
    if (crossed || moving.time == null) return moving.time ?? null
    const list = cur.filter((s) => s.day_id === moving.day_id && s.role !== 'backup').sort((a, b) => a.position - b.position)
    const oldIdx = list.findIndex((s) => s.id === activeId)
    let newIdx = list.findIndex((s) => s.id === overId)
    if (newIdx < 0) newIdx = list.length - 1
    const reordered = oldIdx >= 0 ? arrayMove(list, oldIdx, newIdx) : list
    const timedValues = list.filter((s) => s.time != null).map((s) => s.time)
    let ti = 0
    for (const s of reordered) {
      const t = s.time != null ? (timedValues[ti++] ?? null) : null
      if (s.id === activeId) return t
    }
    return moving.time ?? null
  }

  function onDragStart(e: DragStartEvent) {
    const s = stopsRef.current.find((x) => x.id === String(e.active.id))
    dragOrigin.current = s ? s.day_id : null
    if (s && s.role !== 'backup') { setDragStopId(s.id); setDragPreview(s.time ?? null) }
    lastOverRef.current = null
    buzz(8) // picked up
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
    if (!moving || moving.role === 'backup') return // days & backups: handled on drop only
    if (overId !== lastOverRef.current) { lastOverRef.current = overId; buzz(4) } // tick per slot
    const toDay = dayOf(overId, cur)
    if (toDay && moving.day_id !== toDay) {
      const without = cur.filter((s) => s.id !== activeId)
      const dst = without.filter((s) => s.day_id === toDay && s.role !== 'backup').sort((a, b) => a.position - b.position)
      const overIdx = dst.findIndex((s) => s.id === overId)
      dst.splice(overIdx >= 0 ? overIdx : dst.length, 0, { ...moving, day_id: toDay })
      const next = [...without.filter((s) => s.day_id !== toDay || s.role === 'backup'), ...dst.map((s, i) => ({ ...s, position: i }))]
      stopsRef.current = next
      setLocalStops(next)
    }
    setDragPreview(previewTimeFor(activeId, overId))
  }

  function onDragCancel() {
    dragOrigin.current = null
    lastOverRef.current = null
    setDragStopId(null)
    setDragPreview(null)
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    const origin = dragOrigin.current
    dragOrigin.current = null
    lastOverRef.current = null
    setDragStopId(null)
    setDragPreview(null)
    if (!over) return
    buzz(12) // dropped
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

    // a BACKUP dragged into the schedule → becomes a main stop right where it
    // was dropped; nobody else's time moves (the backup itself stays untimed)
    if (moving.role === 'backup') {
      const toDay = dayOf(overId, cur) ?? moving.day_id
      const mains = cur.filter((s) => s.day_id === toDay && s.role !== 'backup' && s.id !== activeId).sort((a, b) => a.position - b.position)
      let at = mains.findIndex((s) => s.id === overId)
      if (at < 0) at = mains.length
      const promoted = { ...moving, role: null, day_id: toDay }
      const ordered = [...mains.slice(0, at), promoted, ...mains.slice(at)].map((s, i) => ({ ...s, position: i }))
      const next = [...cur.filter((s) => s.id !== activeId && (s.day_id !== toDay || s.role === 'backup')), ...ordered]
      stopsRef.current = next
      setLocalStops(next)
      await updateStop(moving.id, { role: null }, moving.version)
      await persistStopOrder(ordered)
      await reload()
      toast.success('เพิ่มเข้าตารางแล้ว')
      return
    }
    const finalDay = moving.day_id
    const list = cur.filter((s) => s.day_id === finalDay && s.role !== 'backup').sort((a, b) => a.position - b.position)
    const oldIdx = list.findIndex((s) => s.id === activeId)
    let newIdx = list.findIndex((s) => s.id === overId)
    if (newIdx < 0) newIdx = list.length - 1 // dropped on day area → end
    const reordered = (oldIdx >= 0 && newIdx >= 0) ? arrayMove(list, oldIdx, newIdx) : list
    const crossed = origin != null && origin !== finalDay
    // How times behave on a reorder:
    //  • cross-day move → the stop carries its OWN time (no reassignment)
    //  • same-day, dragging a TIMED stop = "rearrange the schedule": the time
    //    VALUES stay pinned to the timed stops top→bottom (two timed stops thus
    //    swap), while UNTIMED stops are transparent — they never gain or lose a
    //    time. So a timed stop dragged down into the untimed zone KEEPS its time.
    //  • same-day, dragging an UNTIMED stop = just move it: every stop keeps its
    //    own time, so an untimed place can sit ABOVE a timed one without stealing
    //    its time (the reason this branch exists).
    const swap = !crossed && moving.time != null
    // the timed values in their current top→bottom order (untimed skipped)
    const timedValues = list.filter((s) => s.time != null).map((s) => s.time)
    let ti = 0
    const finalPos = reordered.map((s, i) => ({
      ...s,
      position: i,
      ...(swap ? { time: s.time != null ? (timedValues[ti++] ?? null) : null } : {}),
    }))
    let next = [...cur.filter((s) => s.day_id !== finalDay || s.role === 'backup'), ...finalPos]
    let toPersist = [...finalPos]
    if (crossed) {
      const originPos = next.filter((s) => s.day_id === origin && s.role !== 'backup').sort((a, b) => a.position - b.position).map((s, i) => ({ ...s, position: i }))
      next = [...next.filter((s) => s.day_id !== origin || s.role === 'backup'), ...originPos]
      toPersist = [...toPersist, ...originPos]
    }
    stopsRef.current = next
    setLocalStops(next)
    // only the timed-swap rewrites time values; a plain move / cross-day keeps them
    await persistStopOrder(toPersist, { withTime: swap })
    if (swap && timedValues.length && oldIdx !== newIdx) toast.success('สลับเวลาตามตำแหน่งใหม่แล้ว')
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
    // reflect a chronological/slot re-order in the UI IMMEDIATELY (don't wait for
    // reload) so the stop is seen to move the instant its time is saved
    const applyOrder = (ordered: ItineraryStop[]) => {
      const repositioned = ordered.map((s, i) => ({ ...s, position: i }))
      const merged = [...stopsRef.current.filter((s) => s.day_id !== dayId || s.role === 'backup'), ...repositioned]
      stopsRef.current = merged
      setLocalStops(merged)
      return repositioned
    }
    // a stop with a clear time slots into its chronological position AMONG THE
    // OTHER TIMED stops — even if it was dragged elsewhere before: giving/editing
    // a time snaps it back to where the clock says it belongs. If nothing is
    // scheduled later, it sits at the end of the timed group (above untimed ones).
    if (input.time && input.role !== 'backup') {
      const rest = dayStops.filter((s) => s.id !== target.id)
      let insertAt = rest.findIndex((s) => s.time != null && s.time > input.time!)
      if (insertAt < 0) insertAt = rest.map((s) => s.time != null).lastIndexOf(true) + 1
      const ordered = applyOrder([...rest.slice(0, insertAt), target, ...rest.slice(insertAt)])
      await persistStopOrder(ordered)
    } else if (!editor.stop && editor.at != null) {
      // inserted via the "+" between two activities (no time given) → drop it
      // exactly at the chosen slot rather than at the end of the day.
      const rest = dayStops.filter((s) => s.id !== target.id)
      const at = Math.min(editor.at, rest.length)
      const ordered = applyOrder([...rest.slice(0, at), target, ...rest.slice(at)])
      await persistStopOrder(ordered)
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

      {/* All plans moved here from the nav — one prominent tap under the reminder card */}
      <button onClick={() => navigate('/plans')}
        className="w-full rounded-[12px] px-4 py-3 flex items-center gap-3 text-white"
        style={{ background: 'linear-gradient(120deg, var(--color-brand), var(--color-accent))' }}>
        <span className="size-9 rounded-full grid place-items-center shrink-0" style={{ background: 'rgba(255,255,255,.2)' }}>
          <IconLayoutList size={18} />
        </span>
        <span className="flex-1 min-w-0 text-left">
          <span className="block text-[14px] font-semibold leading-tight">All Location</span>
          <span className="block text-[11px] text-white/85 mt-0.5">สถานที่ในแพลนทั้งหมด · {places.filter((p) => p.in_plan).length} ที่</span>
        </span>
        <IconChevronRight size={18} className="shrink-0 text-white/90" />
      </button>

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

      <DndContext sensors={daySensors} collisionDetection={closestCenter}
        onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}
        // stronger edge auto-scroll: kicks in within the outer 22% of the
        // viewport and accelerates harder, so long cross-day drags flow
        autoScroll={{ threshold: { x: 0, y: 0.22 }, acceleration: 18 }}>
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
                dragStopId={dragStopId}
                dragPreview={dragPreview}
                getMatchedPlace={getMatchedPlace}
                canEdit={canEdit}
                wx={day.day_date ? dayWx[day.day_date] : undefined}
                // When a single day is picked via the filter, show it expanded.
                // Otherwise past days auto-collapse: for them the stored toggle means
                // "deviate from the default" (default = collapsed), so entry = expanded.
                collapsed={activeFilter ? false : isPast ? !collapsed.has(day.id) : collapsed.has(day.id)}
                nextStopId={nextStopId}
                suggestionsFor={(s) => (canEdit && !sugHidden.has(s.id) ? suggestForStop(s, places, scheduledNames, coordsMap) : [])}
                onAddSuggestion={(p) => addSuggested(day.id, p)}
                onDismissSug={dismissSug}
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
