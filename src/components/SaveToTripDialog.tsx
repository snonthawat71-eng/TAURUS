import { useEffect, useState } from 'react'
import { IconCheck, IconLoader2, IconHeartFilled } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { copyPlaceToTrip, exploreSavedInTrips } from '@/lib/placeMutations'
import { logExploreEvent } from '@/lib/exploreMutations'
import { countryFlag } from '@/lib/countries'
import { formatDateRange } from '@/lib/format'
import type { Place } from '@/lib/database.types'

export function SaveToTripDialog({ place, open, sourceExploreId, onClose, onChanged }: {
  place: Place | null
  open: boolean
  sourceExploreId?: string
  onClose: () => void
  onChanged?: () => void
}) {
  const { trips } = useTrip()
  const { user } = useAuth()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())

  // trips the user owns (can save into)
  const myTrips = trips.filter((t) => t.owner_id === user?.id)

  useEffect(() => {
    if (!open) return
    setBusyId(null)
    setDone(new Set())
    if (sourceExploreId) {
      exploreSavedInTrips(sourceExploreId, myTrips.map((t) => t.id)).then((ids) => setDone(new Set(ids)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sourceExploreId])

  async function save(tripId: string) {
    if (!place || done.has(tripId)) return
    setBusyId(tripId)
    await copyPlaceToTrip(place, tripId, sourceExploreId)
    if (sourceExploreId && user) logExploreEvent(sourceExploreId, user.id, 'save')
    setBusyId(null)
    setDone((prev) => new Set(prev).add(tripId))
    onChanged?.()
  }

  return (
    <Drawer open={open} onClose={onClose} title="เซฟสถานที่ไปทริปไหน">
      <div className="flex items-center gap-2 mb-3 text-[13px]">
        <IconHeartFilled size={15} className="text-brand" />
        <span className="font-medium truncate">{place?.name}</span>
      </div>
      {myTrips.length === 0 ? (
        <div className="card p-5 text-center text-[12px] text-ink-3">
          คุณยังไม่มีทริปของตัวเอง — สร้างทริปก่อนแล้วค่อยเซฟสถานที่ที่แชร์มาได้
        </div>
      ) : (
        <div className="space-y-1.5">
          {myTrips.map((t) => {
            const saved = done.has(t.id)
            return (
              <button key={t.id} onClick={() => save(t.id)} disabled={busyId === t.id || saved}
                className="relative w-full flex items-center gap-2.5 card p-3 text-left enabled:hover:bg-surface-2/40">
                <span className="text-[20px] shrink-0">{t.flag || countryFlag(t.country)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium truncate">{t.name}</div>
                  <div className="text-[11px] text-ink-3">{formatDateRange(t.start_date, t.end_date) || t.country || '—'}</div>
                </div>
                {busyId === t.id ? <IconLoader2 size={16} className="animate-spin text-ink-3" />
                  : saved ? <span className="chip !bg-brand-soft !text-brand-dark"><IconCheck size={12} /> เซฟแล้ว</span>
                  : <span className="btn-link text-[12px]">เซฟที่นี่</span>}
                {saved && <div className="absolute inset-0 rounded-[12px] pointer-events-none" style={{ background: 'rgba(120,118,110,0.16)' }} />}
              </button>
            )
          })}
        </div>
      )}
    </Drawer>
  )
}
