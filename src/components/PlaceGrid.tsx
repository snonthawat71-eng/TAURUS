import { useEffect, useMemo, useState } from 'react'
import { IconPlus, IconAdjustmentsHorizontal, IconChevronDown, IconCheck } from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { PlaceCard, type Interested } from './PlaceCard'
import { PlaceEditor } from './PlaceEditor'
import { PlaceDetail } from './PlaceDetail'
import { addPlace, updatePlace, deletePlace, setInPlan, toggleInterest } from '@/lib/placeMutations'
import { catMeta, type CategoryTab } from '@/lib/placeMeta'
import type { Place, PlaceGroup } from '@/lib/database.types'

type GroupBy = 'none' | 'city' | 'category'

export function PlaceGrid({
  group, tabs, title, addLabel, focusId,
}: {
  group: PlaceGroup
  tabs: CategoryTab[]
  title: string
  addLabel: string
  focusId?: string | null
}) {
  const { trip, places, interests, memberProfiles, reload } = useTrip()
  const { user } = useAuth()
  const [tab, setTab] = useState('all')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [groupMenu, setGroupMenu] = useState(false)
  const [editor, setEditor] = useState<'new' | Place | null>(null)
  const [detail, setDetail] = useState<Place | null>(null)

  const cities = trip?.cities ?? []
  const profilesById = useMemo(() => new Map(memberProfiles.map((p) => [p.id, p])), [memberProfiles])

  // cities actually available = trip cities ∪ cities used by this group's places
  const cityOrder = useMemo(() => {
    const set = new Set<string>()
    cities.forEach((c) => set.add(c))
    places.filter((p) => p.group_type === group).forEach((p) => { if (p.city) set.add(p.city) })
    return Array.from(set)
  }, [cities, places, group])
  const hasCityData = cityOrder.length > 0

  const interestFor = (place: Place): { list: Interested[]; mine: boolean } => {
    const rows = interests.filter((i) => i.place_id === place.id)
    const list = rows.map((r) => {
      const p = profilesById.get(r.user_id)
      return { name: p?.nickname ?? 'ผู้ใช้', color: p?.avatar_color ?? undefined }
    })
    return { list, mine: !!user && rows.some((r) => r.user_id === user.id) }
  }

  const items = useMemo(
    () => places
      .filter((p) => p.group_type === group && (tab === 'all' || p.category === tab))
      .sort((a, b) => Number(a.in_plan) - Number(b.in_plan)),
    [places, group, tab],
  )

  useEffect(() => {
    if (focusId) { const p = places.find((x) => x.id === focusId); if (p) setDetail(p) }
  }, [focusId, places])
  useEffect(() => {
    if (detail) setDetail(places.find((p) => p.id === detail.id) ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places])

  async function togglePlan(p: Place) { await setInPlan(p.id, !p.in_plan); await reload() }
  async function toggleWant(p: Place) {
    if (!user) return
    const mine = interests.some((i) => i.place_id === p.id && i.user_id === user.id)
    await toggleInterest(p.id, user.id, mine); await reload()
  }
  async function remove(p: Place) { if (confirm('ลบรายการนี้?')) { await deletePlace(p.id); await reload() } }

  const GROUP_OPTIONS: { key: GroupBy; label: string }[] = [
    { key: 'none', label: 'ทั้งหมด' },
    ...(hasCityData ? [{ key: 'city' as GroupBy, label: 'แยกตามเมือง' }] : []),
    { key: 'category', label: 'แยกตามประเภท' },
  ]
  const groupLabel = GROUP_OPTIONS.find((o) => o.key === groupBy)?.label ?? 'ทั้งหมด'

  const renderCard = (p: Place) => {
    const { list, mine } = interestFor(p)
    return (
      <PlaceCard key={p.id} place={p} interested={list} mine={mine}
        onOpen={() => setDetail(p)} onTogglePlan={() => togglePlan(p)} onToggleInterest={() => toggleWant(p)}
        onEdit={() => setEditor(p)} onDelete={() => remove(p)} />
    )
  }

  // build grouped sections
  const sections: { key: string; label: string }[] = useMemo(() => {
    if (groupBy === 'city') {
      const order = [...cityOrder, 'ไม่ระบุเมือง']
      return order.filter((c) => items.some((p) => (p.city || 'ไม่ระบุเมือง') === c)).map((c) => ({ key: c, label: c }))
    }
    if (groupBy === 'category') {
      return tabs.filter((t) => t.key !== 'all' && items.some((p) => p.category === t.key)).map((t) => ({ key: t.key, label: t.label }))
    }
    return []
  }, [groupBy, items, cityOrder, tabs])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-medium text-ink-2">{title} · {items.length}</h2>
        <button onClick={() => setEditor('new')} className="btn-link flex items-center gap-1"><IconPlus size={14} /> {addLabel}</button>
      </div>

      {/* Filter / group bar */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar items-center">
        <div className="relative shrink-0">
          <button onClick={() => setGroupMenu((v) => !v)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium hairline bg-surface whitespace-nowrap">
            <IconAdjustmentsHorizontal size={14} /> {groupLabel} <IconChevronDown size={13} className="text-ink-3" />
          </button>
          {groupMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setGroupMenu(false)} />
              <div className="absolute left-0 mt-1 w-44 card p-1 shadow-lg z-50">
                {GROUP_OPTIONS.map((o) => (
                  <button key={o.key} onClick={() => { setGroupBy(o.key); setGroupMenu(false) }}
                    className="w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-[13px] text-ink-2 hover:bg-surface-2">
                    <span className="flex-1 text-left">{o.label}</span>
                    {groupBy === o.key && <IconCheck size={14} className="text-brand" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {/* category quick filter */}
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={['px-3 h-8 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors',
              tab === t.key ? 'bg-ink text-white' : 'bg-surface-2 text-ink-2 hover:bg-surface-2/70'].join(' ')}>
            {t.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="card p-8 text-center text-[12px] text-ink-3">ยังไม่มีรายการในหมวดนี้</div>
      ) : groupBy === 'none' ? (
        <div className="grid sm:grid-cols-2 gap-2.5">
          {items.map(renderCard)}
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((s) => {
            const list = items.filter((p) => (groupBy === 'city' ? (p.city || 'ไม่ระบุเมือง') : p.category) === s.key)
            const Icon = groupBy === 'category' ? catMeta(s.key).icon : null
            return (
              <div key={s.key}>
                <div className="flex items-center gap-1.5 mb-2 text-[13px] font-medium text-ink-2">
                  {Icon && <Icon size={15} />}{s.label} <span className="text-ink-3 font-normal">{list.length}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {list.map(renderCard)}
                </div>
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
          else await updatePlace(editor.id, fields)
          await reload()
        }}
        onDelete={editor && editor !== 'new' ? async () => { await deletePlace(editor.id); await reload() } : undefined}
      />

      {(() => {
        if (!detail) return null
        const { list, mine } = interestFor(detail)
        return (
          <PlaceDetail place={detail} interested={list} mine={mine} open={!!detail}
            onClose={() => setDetail(null)} onTogglePlan={() => togglePlan(detail)} onToggleInterest={() => toggleWant(detail)}
            onEdit={() => { setEditor(detail); setDetail(null) }} />
        )
      })()}
    </div>
  )
}
