import { useEffect, useState } from 'react'
import { IconMail, IconTrash, IconCrown, IconLoader2, IconClock } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { Avatar } from './Avatar'
import { supabase } from '@/lib/supabase'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { addInvite, deleteInvite } from '@/lib/tripMutations'

interface Invite { id: string; email: string; status: string }

export function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { trip, memberProfiles } = useTrip()
  const { user } = useAuth()
  const isOwner = !!trip && !!user && trip.owner_id === user.id

  const [email, setEmail] = useState('')
  const [invites, setInvites] = useState<Invite[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function loadInvites() {
    if (!trip || !isOwner) return
    const { data } = await supabase.from('trip_invites').select('id,email,status').eq('trip_id', trip.id).order('created_at')
    setInvites((data ?? []) as Invite[])
  }

  useEffect(() => { if (open) { setMsg(null); setEmail(''); loadInvites() } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function invite() {
    if (!trip || !user || !email.trim()) return
    setBusy(true); setMsg(null)
    const { error } = await addInvite(trip.id, email, user.id)
    setBusy(false)
    if (error) setMsg(error.message)
    else { setEmail(''); setMsg('ส่งคำเชิญแล้ว — เพื่อนจะเข้าทริปได้เมื่อ login ด้วยอีเมลนี้'); loadInvites() }
  }

  return (
    <Drawer open={open} onClose={onClose} title="แชร์ทริป">
      <div className="space-y-4">
        <div>
          <div className="text-[12px] font-medium text-ink-2 mb-2">สมาชิกในทริป</div>
          <div className="space-y-1.5">
            {memberProfiles.map((m) => (
              <div key={m.id} className="flex items-center gap-2.5 card p-2.5">
                <Avatar name={m.nickname} color={m.avatar_color} size={28} ring={false} />
                <span className="text-[13px] flex-1 truncate">{m.nickname ?? 'ผู้ใช้'}</span>
                {trip?.owner_id === m.id && <span className="chip !bg-brand-soft !text-brand-dark"><IconCrown size={12} /> เจ้าของ</span>}
              </div>
            ))}
          </div>
        </div>

        {isOwner ? (
          <>
            <div>
              <div className="text-[12px] font-medium text-ink-2 mb-2">เชิญด้วยอีเมล</div>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 rounded-md hairline px-3 h-10 bg-surface flex-1">
                  <IconMail size={15} className="text-ink-3" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@email.com"
                    className="flex-1 bg-transparent outline-none text-[13px]" />
                </div>
                <button onClick={invite} disabled={busy || !email.trim()} className="btn-primary px-4 h-10 disabled:opacity-50">
                  {busy ? <IconLoader2 size={15} className="animate-spin" /> : 'เชิญ'}
                </button>
              </div>
              {msg && <p className="text-[11px] text-ink-3 mt-1.5">{msg}</p>}
              <p className="text-[11px] text-ink-3 mt-1.5">เฉพาะคนที่คุณเชิญเท่านั้นที่เข้าทริปนี้ได้ (เจ้าของเป็นคนอนุมัติ)</p>
            </div>

            {invites.length > 0 && (
              <div>
                <div className="text-[12px] font-medium text-ink-2 mb-2">คำเชิญ</div>
                <div className="space-y-1.5">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-2 card p-2.5">
                      <IconClock size={15} className="text-ink-3 shrink-0" />
                      <span className="text-[13px] flex-1 truncate">{inv.email}</span>
                      <span className="chip">{inv.status === 'accepted' ? 'เข้าร่วมแล้ว' : 'รอตอบรับ'}</span>
                      <button onClick={async () => { await deleteInvite(inv.id); loadInvites() }} className="text-ink-3 hover:text-[#D85A30]"><IconTrash size={15} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-[12px] text-ink-3">เฉพาะเจ้าของทริปเท่านั้นที่เชิญสมาชิกใหม่ได้</p>
        )}
      </div>
    </Drawer>
  )
}
