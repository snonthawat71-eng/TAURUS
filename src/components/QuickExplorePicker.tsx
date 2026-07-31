import { useEffect, useMemo, useState } from 'react'
import { IconCheck, IconLoader2, IconSearch, IconInfoCircle } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { SignedImage } from './SignedImage'
import { ExploreDetail } from './ExploreDetail'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { listExplore, exploreAsPlace, logExploreEvent } from '@/lib/exploreMutations'
import { copyPlaceToTrip, removeExploreCopies } from '@/lib/placeMutations'
import { planMapUrl } from '@/lib/branches'
import { catMeta } from '@/lib/placeMeta'
import type { ExplorePlace } from '@/lib/database.types'

/** The new (or existing) plan place handed back so the caller can pre-select it. */
export interface QuickPick { id: string; name: string | null; map_url: string | null; note: string | null }

/** Normalize a city name for matching — a trip's "Bangkok" and an Explore
 *  place's "bangkok " are the same city (typed by different people). */
const normCity = (s?: string | null) => (s ?? '').trim().toLowerCase()

/**
 * Quick-pick a place straight from the Explore pool while adding an activity.
 * Tapping a result copies it into THIS trip's places (so it also shows up in
 * Places/Food) and hands it back to be selected for the stop at once — which is
 * what puts it in the plan.
 */
export function QuickExplorePicker({ open, onClose, onPicked, multi, initialGroup, title }: {
  open: boolean
  onClose: () => void
  /** called after a single pick (stop flow). Omit in `multi` mode. */
  onPicked?: (pick: QuickPick) => void
  /** stay open after each add, so several places can be saved in one go (used
   *  from the Places page); those adds land in Places without a day. */
  multi?: boolean
  initialGroup?: 'all' | 'place' | 'food'
  title?: string
}) {
  const { trip, places, reload } = useTrip()
  const { user } = useAuth()
  const [pool, setPool] = useState<ExplorePlace[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [groupFilter, setGroupFilter] = useState<'all' | 'place' | 'food'>('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ExplorePlace | null>(null)

  // Explore items already saved into this trip → mark them "เพิ่มแล้ว"
  const savedHere = useMemo(
    () => new Set(places.map((p) => p.source_explore_id).filter(Boolean) as string[]),
    [places],
  )

  useEffect(() => {
    if (!open) return
    setQ(''); setGroupFilter(initialGroup ?? 'all'); setCityFilter('all'); setBusyId(null); setDetail(null)
    // refresh the trip so the "เพิ่มแล้ว" badge reflects the latest places
    // (e.g. after a place was deleted from Places/Food)
    reload()
    setLoading(true)
    listExplore().then(({ data }) => {
      setPool((data ?? []) as ExplorePlace[])
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const groupOf = (e: ExplorePlace) =>
    e.group_type === 'food' || catMeta(e.category).group === 'food' ? 'food' : 'place'

  // only the cities this trip actually visits (original casing for the chips)
  const tripCities = useMemo(
    () => [...new Set((trip?.cities ?? []).filter(Boolean) as string[])],
    [trip],
  )
  // matched case/whitespace-insensitively so "Bangkok" (trip) finds "bangkok"
  // (Explore) — the two are typed by different people
  const tripCitySet = useMemo(() => new Set(tripCities.map(normCity)), [tripCities])
  // narrow the whole Explore pool to those cities (if the trip lists any) — so
  // quick-select only ever offers places in the cities you're going to
  const cityScoped = useMemo(
    () => (tripCitySet.size ? pool.filter((e) => e.city != null && tripCitySet.has(normCity(e.city))) : pool),
    [pool, tripCitySet],
  )
  const cities = useMemo(() => tripCities, [tripCities])

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    return cityScoped.filter((e) =>
      (groupFilter === 'all' || groupOf(e) === groupFilter) &&
      (cityFilter === 'all' || normCity(e.city) === normCity(cityFilter)) &&
      (!term || (e.name || '').toLowerCase().includes(term) || (e.city || '').toLowerCase().includes(term)),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityScoped, q, groupFilter, cityFilter])

  function finishPick(pick: QuickPick) {
    onPicked?.(pick)
    setBusyId(null); setDetail(null); onClose()
  }

  async function pick(e: ExplorePlace) {
    if (!trip) return
    // already in this trip → just select it. Nothing to flag: it lands in the
    // plan by becoming a stop, which is what the caller does with this pick.
    const existing = places.find((p) => p.source_explore_id === e.id)
    if (existing) {
      setBusyId(e.id)
      if (multi) { setBusyId(null); return } // already in this trip → nothing to do
      finishPick({ id: existing.id, name: existing.name, map_url: planMapUrl(existing), note: existing.note })
      return
    }
    // A multi-branch place is saved WITHOUT asking which branch: at this point
    // it's just being collected. Which branch you actually go to is decided per
    // day, on the itinerary stop (see stop_branch.sql / StopEditor).
    await saveNew(e)
  }

  async function saveNew(e: ExplorePlace) {
    if (!trip) return
    setBusyId(e.id)
    const id = crypto.randomUUID()
    await copyPlaceToTrip(exploreAsPlace(e), trip.id, e.id, { id, planBranch: null })
    if (user) logExploreEvent(e.id, user.id, 'save')
    await reload()
    if (multi) { setBusyId(null); return } // stay open for more; badge flips to "เพิ่มแล้ว"
    finishPick({ id, name: e.name, map_url: e.map_url, note: e.note })
  }

  // tap an already-added item again → cancel: remove its copy from this trip
  async function unpick(e: ExplorePlace) {
    if (!trip) return
    setBusyId(e.id)
    await removeExploreCopies(e.id, [trip.id])
    await reload()
    setBusyId(null)
  }
  const toggle = (e: ExplorePlace) => (savedHere.has(e.id) ? unpick(e) : pick(e))

  return (
    <Drawer open={open} onClose={onClose} title={title ?? 'เลือกด่วนจาก Explore'}>
      <div className="space-y-3">
        <p className="text-[12px] text-ink-3 -mt-1">
          {multi
            ? (tripCities.length ? `เลือกจาก Explore มาเก็บไว้ในทริป — แสดงเฉพาะเมืองที่จะไป (${cities.join(', ')}) · เพิ่มได้หลายที่` : 'เลือกจาก Explore มาเก็บไว้ในทริป — เพิ่มได้หลายที่')
            : (tripCities.length
              ? `แสดงเฉพาะเมืองที่ทริปนี้จะไป (${cities.join(', ')}) — แตะเพื่อเพิ่มเข้าแพลนและเซฟไว้ในหน้า Places/Food ทันที`
              : 'เลือกสถานที่จาก Explore — จะถูกเพิ่มเข้าแพลนและเซฟไว้ในหน้า Places/Food ทันที')}
        </p>

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
        {cities.length > 1 && (
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
          <p className="text-[13px] text-ink-3 text-center py-10">
            {tripCities.length
              ? 'ยังไม่มีสถานที่ใน Explore สำหรับเมืองที่ทริปนี้จะไป'
              : 'ไม่พบสถานที่ใน Explore ที่ตรงกับที่ค้นหา'}
          </p>
        ) : (
          <div className="space-y-2 max-h-[55vh] overflow-y-auto -mx-1 px-1">
            {shown.map((e) => {
              const meta = catMeta(e.category)
              const Icon = meta.icon
              const saved = savedHere.has(e.id)
              return (
                <div key={e.id} className="flex items-center gap-2.5 card p-2">
                  {/* tap the place → open its full Explore detail before deciding */}
                  <button onClick={() => setDetail(e)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                    <div className="size-14 shrink-0 rounded-[10px] overflow-hidden relative" style={{ background: meta.bg }}>
                      <SignedImage url={e.photo_url} focus={e.photo_focus} alt={e.name ?? ''} className="w-full h-full object-cover" width={160}
                        fallback={<div className="w-full h-full grid place-items-center" style={{ background: meta.bg }}><Icon size={20} style={{ color: meta.fg }} /></div>} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium leading-snug line-clamp-1">{e.name}</div>
                      <div className="flex items-center gap-1.5 text-[11px] mt-0.5" style={{ color: meta.fg }}>
                        <Icon size={12} /> <span className="truncate">{meta.label}{e.city ? ` · ${e.city}` : ''}</span>
                      </div>
                      <span className="inline-flex items-center gap-0.5 text-[11px] text-brand-mid mt-1"><IconInfoCircle size={11} /> ดูรายละเอียด</span>
                    </div>
                  </button>
                  {/* add/select — or, if already added, tap again to cancel */}
                  <button onClick={() => toggle(e)} disabled={busyId === e.id}
                    title={saved ? 'แตะเพื่อยกเลิก' : undefined} className="shrink-0 disabled:opacity-60">
                    {busyId === e.id ? <IconLoader2 size={16} className="animate-spin text-ink-3" />
                      : saved ? <span className="chip !bg-brand-soft !text-brand-dark"><IconCheck size={12} /> เพิ่มแล้ว</span>
                        : <span className="btn-primary inline-flex items-center h-8 px-3 text-[12px] rounded-full">เพิ่ม</span>}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* full Explore detail on top — the heart adds it to the plan & selects it */}
      <ExploreDetail e={detail} open={!!detail} saved={detail ? savedHere.has(detail.id) : false}
        onClose={() => setDetail(null)} onFav={() => detail && toggle(detail)} />
    </Drawer>
  )
}
