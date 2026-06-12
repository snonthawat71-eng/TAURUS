import { useEffect, useState } from 'react'
import { IconCheck, IconLoader2, IconStarFilled } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { copyPlaceToTrip } from '@/lib/placeMutations'
import { countryFlag } from '@/lib/countries'
import { formatDateRange } from '@/lib/format'
import type { Place } from '@/lib/database.types'

export function SaveToTripDialog({ place, open, onClose }: { place: Place | null; open: boolean; onClose: () => void }) {
  const { trips } = useTrip()
  const { user } = useAuth()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [doneId, setDoneId] = useState<string | null>(null)

  // trips the user owns (can save into)
  const myTrips = trips.filter((t) => t.owner_id === user?.id)

  useEffect(() => { if (open) { setDoneId(null); setBusyId(null) } }, [open])

  async function save(tripId: string) {
    if (!place) return
    setBusyId(tripId)
    await copyPlaceToTrip(place, tripId)
    setBusyId(null)
    setDoneId(tripId)
  }

  return (
    <Drawer open={open} onClose={onClose} title="เซฟสถานที่ไปทริปไหน">
      <div className="flex items-center gap-2 mb-3 text-[13px]">
        <IconStarFilled size={15} className="text-brand" />
        <span className="font-medium truncate">{place?.name}</span>
      </div>
      {myTrips.length === 0 ? (
        <div className="card p-5 text-center text-[12px] text-ink-3">
          คุณยังไม่มีทริปของตัวเอง — สร้างทริปก่อนแล้วค่อยเซฟสถานที่ที่แชร์มาได้
        </div>
      ) : (
        <div className="space-y-1.5">
          {myTrips.map((t) => (
            <button key={t.id} onClick={() => save(t.id)} disabled={busyId === t.id || doneId === t.id}
              className="w-full flex items-center gap-2.5 card p-3 text-left hover:bg-surface-2/40 disabled:opacity-70">
              <span className="text-[20px] shrink-0">{t.flag || countryFlag(t.country)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium truncate">{t.name}</div>
                <div className="text-[11px] text-ink-3">{formatDateRange(t.start_date, t.end_date) || t.country || '—'}</div>
              </div>
              {busyId === t.id ? <IconLoader2 size={16} className="animate-spin text-ink-3" />
                : doneId === t.id ? <span className="chip !bg-brand-soft !text-brand-dark"><IconCheck size={12} /> เซฟแล้ว</span>
                : <span className="btn-link text-[12px]">เซฟที่นี่</span>}
            </button>
          ))}
        </div>
      )}
    </Drawer>
  )
}
