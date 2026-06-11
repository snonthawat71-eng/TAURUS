import { useEffect, useMemo, useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { PlaceCard, type Interested } from './PlaceCard'
import { PlaceEditor } from './PlaceEditor'
import { PlaceDetail } from './PlaceDetail'
import { addPlace, updatePlace, deletePlace, setInPlan, toggleInterest } from '@/lib/placeMutations'
import type { CategoryTab } from '@/lib/placeMeta'
import type { Place, PlaceGroup } from '@/lib/database.types'

export function PlaceGrid({
  group, tabs, title, addLabel, focusId,
}: {
  group: PlaceGroup
  tabs: CategoryTab[]
  title: string
  addLabel: string
  focusId?: string | null
}) {
  const { places, interests, memberProfiles, trip, reload } = useTrip()
  const { user } = useAuth()
  const [tab, setTab] = useState('all')
  const [editor, setEditor] = useState<'new' | Place | null>(null)
  const [detail, setDetail] = useState<Place | null>(null)

  const profilesById = useMemo(() => {
    const m = new Map(memberProfiles.map((p) => [p.id, p]))
    return m
  }, [memberProfiles])

  const interestFor = (place: Place): { list: Interested[]; mine: boolean } => {
    const rows = interests.filter((i) => i.place_id === place.id)
    const list = rows.map((r) => {
      const p = profilesById.get(r.user_id)
      return { name: p?.nickname ?? 'ผู้ใช้', color: p?.avatar_color ?? undefined }
    })
    return { list, mine: !!user && rows.some((r) => r.user_id === user.id) }
  }

  const items = useMemo(
    () => places.filter((p) => p.group_type === group && (tab === 'all' || p.category === tab)),
    [places, group, tab],
  )

  // Open detail when navigated with a focus id (e.g. from Itinerary)
  useEffect(() => {
    if (focusId) {
      const p = places.find((x) => x.id === focusId)
      if (p) setDetail(p)
    }
  }, [focusId, places])

  // Keep the open detail/editor in sync with refreshed data
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

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-medium text-ink-2">{title} · {items.length}</h2>
        <button onClick={() => setEditor('new')} className="btn-link flex items-center gap-1"><IconPlus size={14} /> {addLabel}</button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={['px-3 h-8 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors',
              tab === t.key ? 'bg-ink text-white' : 'bg-surface-2 text-ink-2 hover:bg-surface-2/70'].join(' ')}>
            {t.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="card p-8 text-center text-[12px] text-ink-3">ยังไม่มีรายการในหมวดนี้</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2.5">
          {items.map((p) => {
            const { list, mine } = interestFor(p)
            return (
              <PlaceCard key={p.id} place={p} interested={list} mine={mine}
                onOpen={() => setDetail(p)}
                onTogglePlan={() => togglePlan(p)}
                onToggleInterest={() => toggleWant(p)}
                onEdit={() => setEditor(p)}
                onDelete={() => remove(p)} />
            )
          })}
        </div>
      )}

      <PlaceEditor
        open={editor !== null}
        onClose={() => setEditor(null)}
        group={group}
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
          <PlaceDetail
            place={detail} interested={list} mine={mine} open={!!detail}
            onClose={() => setDetail(null)}
            onTogglePlan={() => togglePlan(detail)}
            onToggleInterest={() => toggleWant(detail)}
            onEdit={() => { setEditor(detail); setDetail(null) }}
          />
        )
      })()}
    </div>
  )
}
