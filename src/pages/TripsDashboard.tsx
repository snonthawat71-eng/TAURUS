import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconPlus, IconPencil, IconTrash, IconCopy, IconDownload, IconCalendar, IconCrown,
  IconUserCircle, IconLogout, IconDots, IconArrowRight,
} from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { TaurusMark } from '@/components/TaurusMark'
import { TaurusLogo } from '@/components/TaurusLogo'
import { AvatarStack } from '@/components/Avatar'
import { PopMenu } from '@/components/PopMenu'
import { TripEditor } from '@/components/TripEditor'
import { formatDateRange, dayCount } from '@/lib/format'
import { countryFlag } from '@/lib/countries'
import { createTrip, updateTrip, deleteTrip, duplicateTrip } from '@/lib/tripMutations'
import { downloadItineraryPdf } from '@/lib/itineraryPdf'
import type { Trip } from '@/lib/database.types'

interface TravelerLite { id: string; trip_id: string; nickname: string | null }
const AV = ['av1', 'av2', 'av3', 'av4']

export default function TripsDashboard() {
  const { trips, loading, switchTrip, reload } = useTrip()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [travelers, setTravelers] = useState<TravelerLite[]>([])
  const [editor, setEditor] = useState<'new' | Trip | null>(null)
  const [menu, setMenu] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    const ids = trips.map((t) => t.id)
    if (!ids.length) { setTravelers([]); return }
    supabase.from('travelers').select('id,trip_id,nickname').in('trip_id', ids)
      .then(({ data }) => setTravelers((data ?? []) as TravelerLite[]))
  }, [trips])

  const byTrip = useMemo(() => {
    const m = new Map<string, TravelerLite[]>()
    for (const t of travelers) { if (!m.has(t.trip_id)) m.set(t.trip_id, []); m.get(t.trip_id)!.push(t) }
    return m
  }, [travelers])

  function open(t: Trip) { switchTrip(t.id); navigate('/info') }
  async function duplicate(t: Trip) {
    if (!user) return
    setBusyId(t.id)
    await duplicateTrip(t, user.id)
    setBusyId(null)
    await reload()
  }

  const flagOf = (t: Trip) => t.flag || countryFlag(t.country)

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-canvas/95 backdrop-blur flex items-center justify-between px-5 sm:px-8 h-16"
        style={{ borderBottom: '0.5px solid var(--color-line)' }}>
        <TaurusLogo height={30} />
        <div className="relative">
          <button onClick={() => setMenu((v) => !v)} className="btn-icon"><IconDots size={16} /></button>
          {menu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <div className="absolute right-0 mt-1.5 w-52 card p-1 shadow-lg z-40">
                <div className="px-2.5 py-2 text-[11px] text-ink-3 truncate">{user?.email}</div>
                <div style={{ borderTop: '0.5px solid var(--color-line)' }} />
                <button onClick={() => { setMenu(false); signOut() }} className="w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-[13px] text-ink-2 hover:bg-surface-2">
                  <IconLogout size={15} /> ออกจากระบบ
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <main className="max-w-[960px] mx-auto px-5 sm:px-8 py-7">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-[20px] font-medium">ทริปของฉัน</h1>
            <p className="text-[13px] text-ink-3 mt-0.5">{trips.length} ทริป · วางแผนการเดินทางของคุณ</p>
          </div>
          <button onClick={() => setEditor('new')} className="btn-primary h-10 px-4 flex items-center gap-1.5">
            <IconPlus size={16} /> สร้างทริป
          </button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-20"><span className="animate-pulse"><TaurusMark size={36} /></span></div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {trips.map((t) => {
              const isOwner = t.owner_id === user?.id
              const tvs = byTrip.get(t.id) ?? []
              return (
                <div key={t.id} className="card p-4 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => open(t)} className="flex items-start gap-2.5 text-left min-w-0">
                      <span className="text-[26px] leading-none">{flagOf(t)}</span>
                      <div className="min-w-0">
                        <div className="text-[15px] font-medium leading-tight truncate">{t.name}</div>
                        <div className="flex items-center gap-1.5 text-[11px] text-ink-3 mt-1">
                          <IconCalendar size={12} />
                          {formatDateRange(t.start_date, t.end_date) || 'ยังไม่กำหนดวัน'}
                          {t.start_date && t.end_date && <span className="chip !bg-brand-soft !text-brand-dark !py-0.5">{dayCount(t.start_date, t.end_date)} วัน</span>}
                        </div>
                      </div>
                    </button>
                    <PopMenu items={[
                      { label: 'แก้ไข', icon: <IconPencil size={15} />, onClick: () => setEditor(t) },
                      { label: 'ทำสำเนา (Duplicate)', icon: <IconCopy size={15} />, onClick: () => duplicate(t) },
                      ...(isOwner ? [{ label: 'ลบทริป', icon: <IconTrash size={15} />, onClick: async () => { if (confirm('ลบทริปนี้?')) { await deleteTrip(t.id); await reload() } }, danger: true }] : []),
                    ]} />
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <AvatarStack people={tvs.map((tv, i) => ({ name: tv.nickname, color: AV[i % 4] }))} size={22} />
                    <span className="chip !text-[10px]">{isOwner ? <><IconCrown size={11} /> เจ้าของ</> : 'ผู้ร่วมเดินทาง'}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-3.5 pt-3.5" style={{ borderTop: '0.5px solid var(--color-line)' }}>
                    <button onClick={() => open(t)} className="btn-primary h-9 flex-1 flex items-center justify-center gap-1.5 text-[13px]">
                      เปิดทริป <IconArrowRight size={15} />
                    </button>
                    <button onClick={() => downloadItineraryPdf(t)} title="ดาวน์โหลด Itinerary (PDF)"
                      className="btn-icon !size-9"><IconDownload size={16} /></button>
                    <button onClick={() => duplicate(t)} disabled={busyId === t.id} title="ทำสำเนา"
                      className="btn-icon !size-9 disabled:opacity-50"><IconCopy size={16} /></button>
                  </div>
                </div>
              )
            })}

            {/* create card */}
            <button onClick={() => setEditor('new')}
              className="card border-dashed p-4 min-h-[150px] flex flex-col items-center justify-center gap-2 text-ink-3 hover:bg-surface-2/40">
              <div className="size-10 rounded-full bg-brand-soft grid place-items-center text-brand"><IconPlus size={20} /></div>
              <span className="text-[13px] font-medium text-ink-2">สร้างทริปใหม่</span>
            </button>
          </div>
        )}

        <div className="mt-6 text-[11px] text-ink-3 flex items-center gap-1.5">
          <IconUserCircle size={13} /> เข้าระบบด้วย {user?.email}
        </div>
      </main>

      <TripEditor
        open={editor !== null}
        onClose={() => setEditor(null)}
        initial={editor && editor !== 'new' ? editor : null}
        onSave={async (fields) => {
          if (editor === 'new' || !editor) {
            if (!user) return
            const { id } = await createTrip(user.id, fields)
            await reload()
            switchTrip(id)
            navigate('/info')
          } else {
            await updateTrip(editor.id, fields)
            await reload()
          }
        }}
        onDelete={editor && editor !== 'new' && editor.owner_id === user?.id
          ? async () => { await deleteTrip(editor.id); await reload() }
          : undefined}
      />
    </div>
  )
}
