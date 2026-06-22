import { useEffect, useState } from 'react'
import { IconMail, IconTrash, IconCrown, IconLoader2, IconClock } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { Avatar } from './Avatar'
import { supabase } from '@/lib/supabase'
import { confirmDialog } from '@/lib/confirm'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { addInvite, revokeAccess, updateMemberPermission, type SharePermission } from '@/lib/tripMutations'
import { toastResult } from '@/lib/toast'

interface Invite { id: string; email: string; status: string; permission?: string | null }
interface Member { user_id: string; permission?: string | null }

export const PERMS: { key: SharePermission; label: string; desc: string }[] = [
  { key: 'edit', label: 'แชร์และแก้ไข', desc: 'แก้ไขได้ทุกอย่างในทริป' },
  { key: 'places', label: 'เฉพาะ Places & Food', desc: 'ดูได้เฉพาะ Places/Food + พินไปเซฟทริปตัวเอง' },
  { key: 'view', label: 'ดูอย่างเดียว', desc: 'ดูได้ทุกหน้า แก้ไขไม่ได้' },
]
const permLabel = (p?: string | null) => PERMS.find((x) => x.key === p)?.label ?? 'แชร์และแก้ไข'

export function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { trip, memberProfiles, reload } = useTrip()
  const { user } = useAuth()
  const isOwner = !!trip && !!user && trip.owner_id === user.id

  const [email, setEmail] = useState('')
  const [perm, setPerm] = useState<SharePermission>('edit')
  const [invites, setInvites] = useState<Invite[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function loadData() {
    if (!trip || !isOwner) return
    const [inv, mem] = await Promise.all([
      supabase.from('trip_invites').select('id,email,status,permission').eq('trip_id', trip.id).order('created_at'),
      supabase.from('trip_members').select('user_id,permission').eq('trip_id', trip.id),
    ])
    setInvites((inv.data ?? []) as Invite[])
    setMembers((mem.data ?? []) as Member[])
  }
  useEffect(() => { if (open) { setMsg(null); setEmail(''); setPerm('edit'); loadData() } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const permOf = (id: string) => members.find((m) => m.user_id === id)?.permission ?? 'edit'

  async function invite() {
    if (!trip || !user || !email.trim()) return
    setBusy(true); setMsg(null)
    const { error } = await addInvite(trip.id, email, user.id, perm)
    setBusy(false)
    if (error) setMsg(error.message)
    else { setEmail(''); setMsg('ส่งคำเชิญแล้ว — เพื่อนจะเข้าทริปได้เมื่อ login ด้วยอีเมลนี้'); loadData() }
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
                {trip?.owner_id === m.id ? (
                  <span className="chip !bg-brand-soft !text-brand-dark"><IconCrown size={12} /> เจ้าของ</span>
                ) : isOwner ? (
                  <>
                    <select value={permOf(m.id)} onChange={async (e) => { await updateMemberPermission(trip!.id, m.id, e.target.value as SharePermission); loadData(); reload() }}
                      className="hairline rounded-md text-[11px] h-7 px-1.5 bg-surface">
                      {PERMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                    </select>
                    <button onClick={async () => { if (await confirmDialog({ message: `นำ "${m.nickname ?? 'สมาชิกคนนี้'}" ออกจากทริป?`, danger: true, confirmLabel: 'นำออก' })) { const res = await revokeAccess(trip!.id, { user_id: m.id }); toastResult(res, { success: 'นำสมาชิกออกแล้ว', fail: 'นำสมาชิกออกไม่สำเร็จ' }); await reload(); loadData() } }}
                      className="text-ink-3 hover:text-[#D85A30] shrink-0" aria-label="ลบสมาชิก"><IconTrash size={15} /></button>
                  </>
                ) : (
                  <span className="chip">{permLabel(permOf(m.id))}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {isOwner ? (
          <>
            <div>
              <div className="text-[12px] font-medium text-ink-2 mb-2">เชิญด้วยอีเมล</div>
              {/* permission picker */}
              <div className="space-y-1.5 mb-2.5">
                {PERMS.map((p) => (
                  <button key={p.key} onClick={() => setPerm(p.key)}
                    className="w-full flex items-start gap-2.5 rounded-md p-2.5 text-left"
                    style={{ border: `0.5px solid ${perm === p.key ? 'var(--color-brand-border)' : 'var(--color-line)'}`, background: perm === p.key ? 'var(--color-brand-soft)' : 'var(--color-surface)' }}>
                    <span className="mt-0.5 size-4 rounded-full grid place-items-center shrink-0"
                      style={{ border: `1.5px solid ${perm === p.key ? 'var(--color-brand)' : 'var(--color-line-2)'}` }}>
                      {perm === p.key && <span className="size-2 rounded-full bg-brand" />}
                    </span>
                    <span className="min-w-0">
                      <span className="text-[13px] font-medium block">{p.label}</span>
                      <span className="text-[11px] text-ink-3">{p.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
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
            </div>

            {invites.length > 0 && (
              <div>
                <div className="text-[12px] font-medium text-ink-2 mb-2">คำเชิญ</div>
                <div className="space-y-1.5">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-2 card p-2.5">
                      <IconClock size={15} className="text-ink-3 shrink-0" />
                      <span className="text-[13px] flex-1 truncate">{inv.email}</span>
                      <span className="chip !text-[10px]">{permLabel(inv.permission)}</span>
                      <span className="chip">{inv.status === 'accepted' ? 'เข้าร่วมแล้ว' : 'รอตอบรับ'}</span>
                      <button onClick={async () => { const res = await revokeAccess(trip!.id, { email: inv.email }); toastResult(res, { success: 'ถอนสิทธิ์แล้ว', fail: 'ถอนสิทธิ์ไม่สำเร็จ' }); await reload(); loadData() }} className="text-ink-3 hover:text-[#D85A30]"><IconTrash size={15} /></button>
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
