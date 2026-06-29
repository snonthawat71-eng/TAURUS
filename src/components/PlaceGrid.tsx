import { useEffect, useMemo, useState } from 'react'
import { IconPlus, IconAdjustmentsHorizontal, IconChevronDown, IconCheck, IconSearch, IconX, IconStar } from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { PlaceCard, type Interested, type CardMode } from './PlaceCard'
import { PlaceEditor } from './PlaceEditor'
import { PlaceDetail } from './PlaceDetail'
import { SaveToTripDialog } from './SaveToTripDialog'
import { AddToDayDialog } from './AddToDayDialog'
import { addPlace, updatePlace, deletePlace, setInPlan, toggleInterest } from '@/lib/placeMutations'
import { confirmDialog } from '@/lib/confirm'
import { offerUndo } from '@/lib/undo'
import { toast } from '@/lib/toast'
import { catMeta, catTabKey, type CategoryTab } from '@/lib/placeMeta'
import { hscroll } from '@/lib/hscroll'
import type { Place, PlaceGroup } from '@/lib/database.types'

type Dim = 'none' | 'category' | 'city'

export function PlaceGrid({
  group, tabs, title, addLabel, focusId,
}: {
  group: PlaceGroup
  tabs: CategoryTab[]
  title: string
  addLabel: string
  focusId?: string | null
}) {
  const { trip, places, interests, memberProfiles, reload, patch, canEdit, myPermission } = useTrip()
  const { user } = useAuth()
  const mode: CardMode = canEdit ? 'edit' : myPermission === 'places' ? 'pin' : 'view'
  const [dim, setDim] = useState<Dim>('none')
  const [chip, setChip] = useState('all')
  const [query, setQuery] = useState('')
  const [dimMenu, setDimMenu] = useState(false)
  const [editor, setEditor] = useState<'new' | Place | null>(null)
  const [detail, setDetail] = useState<Place | null>(null)
  const [pinPlace, setPinPlace] = useState<Place | null>(null)
  const [dayPickFor, setDayPickFor] = useState<Place | null>(null)

  const cities = trip?.cities ?? []
  const profilesById = useMemo(() => new Map(memberProfiles.map((p) => [p.id, p])), [memberProfiles])

  const cityOrder = useMemo(() => {
    const set = new Set<string>()
    cities.forEach((c) => set.add(c))
    places.filter((p) => p.group_type === group).forEach((p) => { if (p.city) set.add(p.city) })
    return Array.from(set)
  }, [cities, places, group])
  const hasCityData = cityOrder.length > 0

  // if cities disappear, fall back to category dimension
  useEffect(() => { if (dim === 'city' && !hasCityData) { setDim('category'); setChip('all') } }, [dim, hasCityData])

  const interestFor = (place: Place): { list: Interested[]; mine: boolean } => {
    const rows = interests.filter((i) => i.place_id === place.id)
    const list = rows.map((r) => {
      const p = profilesById.get(r.user_id)
      return { name: p?.nickname ?? 'ผู้ใช้', color: p?.avatar_color ?? undefined }
    })
    return { list, mine: !!user && rows.some((r) => r.user_id === user.id) }
  }

  const valueOf = (p: Place) =>
    dim === 'city' ? (p.city || 'ไม่ระบุเมือง')
      : catTabKey(p.category, group)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return places
      .filter((p) => p.group_type === group)
      .filter((p) => !q || (p.name ?? '').toLowerCase().includes(q) || (p.station_name ?? '').toLowerCase().includes(q) || (p.note ?? '').toLowerCase().includes(q))
      .filter((p) => dim === 'none' || chip === 'all' || valueOf(p) === chip)
      .sort((a, b) => Number(a.in_plan) - Number(b.in_plan))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, group, query, chip, dim])

  // chips reflect the selected dimension (none = no value chips)
  const chipList: CategoryTab[] = dim === 'none'
    ? []
    : dim === 'city'
      ? [{ key: 'all', label: 'ทั้งหมด' }, ...cityOrder.map((c) => ({ key: c, label: c }))]
      : tabs

  const DIM_OPTIONS: { key: Dim; label: string }[] = [
    { key: 'none', label: 'ทั้งหมด' },
    { key: 'category', label: 'ตามประเภท' },
    ...(hasCityData ? [{ key: 'city' as Dim, label: 'ตามเมือง' }] : []),
  ]
  const dimLabel = DIM_OPTIONS.find((o) => o.key === dim)?.label ?? 'ทั้งหมด'

  useEffect(() => {
    if (focusId) { const p = places.find((x) => x.id === focusId); if (p) setDetail(p) }
  }, [focusId, places])
  useEffect(() => {
    if (detail) setDetail(places.find((p) => p.id === detail.id) ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places])

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
  async function remove(p: Place) {
    if (!(await confirmDialog({ message: 'ลบรายการนี้?', danger: true, confirmLabel: 'ลบ' }))) return
    patch((d) => ({ places: d.places.filter((x) => x.id !== p.id) })) // vanish instantly
    await deletePlace(p.id); await reload()
    offerUndo('ลบรายการแล้ว', [{ table: 'places', rows: [p] }], reload)
  }

  const renderCard = (p: Place) => {
    const { list, mine } = interestFor(p)
    return (
      <PlaceCard key={p.id} place={p} interested={list} mine={mine} mode={mode}
        onOpen={() => setDetail(p)} onTogglePlan={() => (p.in_plan ? togglePlan(p) : setDayPickFor(p))} onToggleInterest={() => toggleWant(p)}
        onEdit={() => setEditor(p)} onDelete={() => remove(p)} onPin={() => setPinPlace(p)} />
    )
  }

  // sections shown only when grouping by a dimension and chip === 'all'
  const sections = useMemo(() => {
    if (dim === 'none' || chip !== 'all') return []
    if (dim === 'city') {
      return [...cityOrder, 'ไม่ระบุเมือง'].filter((c) => filtered.some((p) => valueOf(p) === c)).map((c) => ({ key: c, label: c }))
    }
    return tabs.filter((t) => t.key !== 'all' && filtered.some((p) => valueOf(p) === t.key)).map((t) => ({ key: t.key, label: t.label }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chip, dim, filtered, cityOrder, tabs])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-medium text-ink-2">{title} · {filtered.length}</h2>
        {canEdit && <button onClick={() => setEditor('new')} className="btn-link flex items-center gap-1"><IconPlus size={14} /> {addLabel}</button>}
      </div>
      {mode === 'pin' && (
        <div className="mb-3 rounded-md p-2.5 text-[12px] flex items-center gap-2"
          style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-dark)' }}>
          <IconStar size={15} /> แตะ ⭐ ที่การ์ดเพื่อเซฟสถานที่นั้นไปไว้ในทริปของคุณ
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 rounded-md hairline px-3 h-10 bg-surface mb-3">
        <IconSearch size={16} className="text-ink-3" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาสถานที่ / ร้าน / สถานี"
          className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-ink-3" />
        {query && <button onClick={() => setQuery('')} className="text-ink-3"><IconX size={15} /></button>}
      </div>

      {/* Filter dimension + value chips */}
      <div className="flex items-center gap-1.5 mb-3">
        <div className="relative shrink-0">
          <button onClick={() => setDimMenu((v) => !v)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium hairline bg-surface whitespace-nowrap">
            <IconAdjustmentsHorizontal size={14} /> {dimLabel} <IconChevronDown size={13} className="text-ink-3" />
          </button>
          {dimMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDimMenu(false)} />
              <div className="absolute left-0 mt-1 w-40 card p-1 shadow-lg z-50">
                {DIM_OPTIONS.map((o) => (
                  <button key={o.key} onClick={() => { setDim(o.key); setChip('all'); setDimMenu(false) }}
                    className="w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-[13px] text-ink-2 hover:bg-surface-2">
                    <span className="flex-1 text-left">{o.label}</span>
                    {dim === o.key && <IconCheck size={14} className="text-brand" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div ref={hscroll} className="flex gap-1.5 overflow-x-auto no-scrollbar min-w-0" style={chipList.length === 0 ? { display: 'none' } : undefined}>
          {chipList.map((t) => (
            <button key={t.key} onClick={() => setChip(t.key)}
              className={['px-3 h-8 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors',
                chip === t.key ? 'bg-ink text-white' : 'bg-surface-2 text-ink-2 hover:bg-surface-2/70'].join(' ')}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-8 flex flex-col items-center gap-2 text-center">
          <IconSearch size={28} className="text-ink-3" />
          <p className="text-[13px] text-ink-2">{query ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีรายการในหมวดนี้'}</p>
          {canEdit && !query && <button onClick={() => setEditor('new')} className="btn-primary h-9 px-4 flex items-center gap-1.5 text-[13px] mt-1"><IconPlus size={15} /> {addLabel}</button>}
        </div>
      ) : (dim === 'none' || chip !== 'all') ? (
        <div className="grid grid-cols-2 gap-2.5">{filtered.map(renderCard)}</div>
      ) : (
        <div className="space-y-6">
          {sections.map((s) => {
            const list = filtered.filter((p) => valueOf(p) === s.key)
            const Icon = dim === 'category' ? catMeta(s.key).icon : null
            return (
              <div key={s.key}>
                <div className="flex items-center gap-1.5 mb-2 text-[13px] font-medium text-ink-2">
                  {Icon && <Icon size={15} />}{s.label} <span className="text-ink-3 font-normal">{list.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">{list.map(renderCard)}</div>
              </div>
            )
          })}
        </div>
      )}

      <PlaceEditor
        open={editor !== null} onClose={() => setEditor(null)} group={group} tripId={trip?.id ?? ''}
        initial={editor && editor !== 'new' ? editor : null}
        onSave={async (fields) => {
          if (editor === 'new' || !editor) await addPlace(trip!.id, fields)
          else {
            const r = await updatePlace(editor.id, fields, editor.version)
            if (r.conflict) toast.error('มีคนอื่นแก้ไขรายการนี้ก่อนหน้า — โหลดข้อมูลล่าสุดให้แล้ว ลองใหม่อีกครั้ง')
          }
          await reload()
        }}
        onDelete={editor && editor !== 'new' ? async () => { await deletePlace(editor.id); await reload() } : undefined}
      />

      {(() => {
        if (!detail) return null
        const { list, mine } = interestFor(detail)
        return (
          <PlaceDetail place={detail} interested={list} mine={mine} open={!!detail} canEdit={canEdit}
            onClose={() => setDetail(null)} onToggleInterest={() => toggleWant(detail)}
            onTogglePlan={() => { if (detail.in_plan) togglePlan(detail); else { setDayPickFor(detail); setDetail(null) } }}
            onEdit={canEdit ? () => { setEditor(detail); setDetail(null) } : undefined}
            onPin={mode === 'pin' ? () => { setPinPlace(detail); setDetail(null) } : undefined} />
        )
      })()}

      <SaveToTripDialog place={pinPlace} open={!!pinPlace} onClose={() => setPinPlace(null)} />
      <AddToDayDialog place={dayPickFor} open={!!dayPickFor} onClose={() => setDayPickFor(null)} />
    </div>
  )
}
