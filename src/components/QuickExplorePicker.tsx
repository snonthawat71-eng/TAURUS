import { useEffect, useMemo, useState } from 'react'
import { IconCheck, IconLoader2, IconSearch } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { SignedImage } from './SignedImage'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { listExplore, exploreAsPlace, logExploreEvent } from '@/lib/exploreMutations'
import { copyPlaceToTrip, setInPlan } from '@/lib/placeMutations'
import { catMeta } from '@/lib/placeMeta'
import type { ExplorePlace } from '@/lib/database.types'

/** The new (or existing) plan place handed back so the caller can pre-select it. */
export interface QuickPick { id: string; name: string | null; map_url: string | null; note: string | null }

/**
 * Quick-pick a place straight from the Explore pool while adding an activity.
 * Tapping a result copies it into THIS trip's places (flagged in_plan, so it also
 * shows up in Places/Food) and hands it back to be selected for the stop at once.
 */
export function QuickExplorePicker({ open, onClose, onPicked }: {
  open: boolean
  onClose: () => void
  onPicked: (pick: QuickPick) => void
}) {
  const { trip, places, reload } = useTrip()
  const { user } = useAuth()
  const [pool, setPool] = useState<ExplorePlace[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [groupFilter, setGroupFilter] = useState<'all' | 'place' | 'food'>('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [busyId, setBusyId] = useState<string | null>(null)

  // Explore items already saved into this trip → mark them "เพิ่มแล้ว"
  const savedHere = useMemo(
    () => new Set(places.map((p) => p.source_explore_id).filter(Boolean) as string[]),
    [places],
  )

  useEffect(() => {
    if (!open) return
    setQ(''); setGroupFilter('all'); setCityFilter('all'); setBusyId(null)
    setLoading(true)
    listExplore().then(({ data }) => {
      setPool((data ?? []) as ExplorePlace[])
      setLoading(false)
    })
  }, [open])

  const groupOf = (e: ExplorePlace) =>
    e.group_type === 'food' || catMeta(e.category).group === 'food' ? 'food' : 'place'

  // cities to offer: the trip's cities + any city present in the pool
  const cities = useMemo(() => {
    const set = new Set<string>()
    ;(trip?.cities ?? []).forEach((c) => set.add(c))
    pool.forEach((e) => { if (e.city) set.add(e.city) })
    return Array.from(set)
  }, [trip, pool])

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    return pool.filter((e) =>
      (groupFilter === 'all' || groupOf(e) === groupFilter) &&
      (cityFilter === 'all' || (e.city || '') === cityFilter) &&
      (!term || (e.name || '').toLowerCase().includes(term) || (e.city || '').toLowerCase().includes(term)),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, q, groupFilter, cityFilter])

  async function pick(e: ExplorePlace) {
    if (!trip) return
    setBusyId(e.id)
    // already in this trip → just make sure it's in the plan, then select it
    const existing = places.find((p) => p.source_explore_id === e.id)
    if (existing) {
      if (!existing.in_plan) { await setInPlan(existing.id, true); await reload() }
      onPicked({ id: existing.id, name: existing.name, map_url: existing.map_url, note: existing.note })
      setBusyId(null); onClose()
      return
    }
    const id = crypto.randomUUID()
    await copyPlaceToTrip(exploreAsPlace(e), trip.id, e.id, { inPlan: true, id })
    if (user) logExploreEvent(e.id, user.id, 'save')
    await reload()
    onPicked({ id, name: e.name, map_url: e.map_url, note: e.note })
    setBusyId(null); onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title="เลือกด่วนจาก Explore">
      <div className="space-y-3">
        <p className="text-[12px] text-ink-3 -mt-1">เลือกสถานที่จาก Explore — จะถูกเพิ่มเข้าแพลนและเซฟไว้ในหน้า Places/Food ทันที</p>

        <div className="relative">
          <IconSearch size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อสถานที่ / เมือง"
            className="hairline rounded-md text-[13px] h-10 pl-8 pr-3 bg-surface w-full outline-none focus:border-brand" />
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex p-0.5 rounded-full bg-surface-2 shrink-0">
            {([['all', 'ทั้งหมด'], ['place', 'Places'], ['food', 'Food']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setGroupFilter(v)}
                className={['px-2.5 h-7 rounded-full text-[12px] font-medium transition-colors',
                  groupFilter === v ? 'bg-surface shadow-sm text-ink' : 'text-ink-3'].join(' ')}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {cities.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
            {[{ key: 'all', label: 'ทั้งหมด' }, ...cities.map((c) => ({ key: c, label: c }))].map((c) => (
              <button key={c.key} onClick={() => setCityFilter(c.key)}
                className={['px-2.5 h-7 rounded-full text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors',
                  cityFilter === c.key ? 'bg-brand-soft text-brand-dark' : 'text-ink-3'].join(' ')}>
                {c.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-ink-3 text-[13px]"><IconLoader2 size={16} className="animate-spin" /> กำลังโหลด…</div>
        ) : shown.length === 0 ? (
          <p className="text-[13px] text-ink-3 text-center py-10">ไม่พบสถานที่ใน Explore ที่ตรงกับที่ค้นหา</p>
        ) : (
          <div className="space-y-2 max-h-[55vh] overflow-y-auto -mx-1 px-1">
            {shown.map((e) => {
              const meta = catMeta(e.category)
              const Icon = meta.icon
              const saved = savedHere.has(e.id)
              return (
                <button key={e.id} onClick={() => pick(e)} disabled={busyId === e.id}
                  className="w-full flex items-center gap-3 card p-2 text-left enabled:hover:bg-surface-2/40 disabled:opacity-60">
                  <div className="size-14 shrink-0 rounded-[10px] overflow-hidden relative" style={{ background: meta.bg }}>
                    <SignedImage url={e.photo_url} focus={e.photo_focus} alt={e.name ?? ''} className="w-full h-full object-cover" width={160}
                      fallback={<div className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><Icon size={20} style={{ color: meta.fg }} /></div>} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium leading-snug line-clamp-1">{e.name}</div>
                    <div className="flex items-center gap-1.5 text-[11px] mt-0.5" style={{ color: meta.fg }}>
                      <Icon size={12} /> <span className="truncate">{meta.label}{e.city ? ` · ${e.city}` : ''}</span>
                    </div>
                  </div>
                  {busyId === e.id ? <IconLoader2 size={16} className="animate-spin text-ink-3 shrink-0" />
                    : saved ? <span className="chip !bg-brand-soft !text-brand-dark shrink-0"><IconCheck size={12} /> เพิ่มแล้ว</span>
                      : <span className="btn-link text-[12px] shrink-0">เพิ่ม</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Drawer>
  )
}
