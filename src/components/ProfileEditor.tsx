import { useEffect, useState } from 'react'
import { IconLogout, IconCheck } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { Avatar } from './Avatar'
import { AVATAR_COLORS, toHexColor } from '@/lib/avatars'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { updateProfile, updateTraveler, claimTraveler } from '@/lib/tripMutations'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'

/**
 * `scope` decides what this profile drawer does:
 * - 'global' (trips dashboard): edits only my default identity (name + colour).
 * - 'trip'   (inside a trip): also syncs the traveler card that represents me.
 *
 * Who I am in a trip is NOT asked here — it's already decided when I create the
 * trip (my first card is claimed) or accept an invite (the card for that token).
 * We resolve it from `traveler.user_id === me` and, for older trips that predate
 * claiming, heal it by linking the card whose name matches my profile.
 */
export function ProfileEditor({ open, onClose, scope = 'trip' }: { open: boolean; onClose: () => void; scope?: 'global' | 'trip' }) {
  const { profile, travelers, reload } = useTrip()
  const { user, signOut } = useAuth()
  const [nickname, setNickname] = useState('')
  const [color, setColor] = useState(AVATAR_COLORS.av3.bg) // free-form hex
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setNickname(profile?.nickname ?? '')
    setColor(toHexColor(profile?.avatar_color))
  }, [open, profile])

  // my traveler card in THIS trip — the one claimed by my user_id (authoritative)
  const myTraveler = scope === 'trip' && user ? travelers.find((t) => t.user_id === user.id) : undefined

  async function save() {
    if (!user) return
    setBusy(true)
    await updateProfile(user.id, { nickname, avatar_color: color })
    // In a trip, also update the card that represents me. Prefer the claimed
    // card; if none (legacy trip), claim the one matching my saved name first.
    if (scope === 'trip') {
      let me = travelers.find((t) => t.user_id === user.id)
      if (!me) {
        const savedName = (profile?.nickname ?? '').trim().toLowerCase()
        const byName = savedName ? travelers.find((t) => t.nickname?.trim().toLowerCase() === savedName) : undefined
        if (byName) { await claimTraveler(byName.id, user.id); me = byName }
      }
      if (me) await updateTraveler(me.id, { nickname, avatar_color: color })
    }
    setBusy(false)
    await reload()
    onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title="โปรไฟล์ของฉัน">
      <div className="flex flex-col items-center gap-3 mb-5">
        <Avatar name={nickname || '?'} color={color} size={72} ring={false} />
        {/* single colour wheel — pick any colour */}
        <label className="flex items-center gap-2 cursor-pointer rounded-full pl-1.5 pr-3 h-9 bg-surface-2 text-[12px] font-medium text-ink-2"
          title="เลือกสีจากวงล้อสี">
          <span className="size-7 rounded-full grid place-items-center relative overflow-hidden shrink-0"
            style={{ background: 'conic-gradient(red, orange, yellow, lime, aqua, blue, magenta, red)' }}>
            <span className="size-4 rounded-full" style={{ background: color, boxShadow: '0 0 0 2px #fff' }} />
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
          </span>
          เลือกสีเอง
        </label>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[11px] text-ink-3">ชื่อที่แสดง</label>
          <input className={field} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="เช่น Elf" />
          {scope === 'global' && (
            <p className="text-[11px] text-ink-3 mt-1">ชื่อและสีเริ่มต้นของคุณ — ใช้เป็นค่าเริ่มต้นในทุกทริป</p>
          )}
        </div>

        {/* who I am in this trip — auto-detected, shown for reassurance (not a picker) */}
        {scope === 'trip' && myTraveler && (
          <div className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5"
            style={{ background: 'var(--color-brand-soft)', border: '0.5px solid var(--color-brand-border)' }}>
            <Avatar name={nickname || myTraveler.nickname || '?'} color={color} size={30} ring={false} />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium flex items-center gap-1" style={{ color: 'var(--color-brand-dark)' }}>
                <IconCheck size={13} /> การ์ดของคุณในทริปนี้
              </div>
              <div className="text-[11px] text-ink-3 mt-0.5">แก้ชื่อ/สีที่นี่ การ์ดผู้เดินทางจะอัปเดตตามให้เอง</div>
            </div>
          </div>
        )}

        <div className="text-[11px] text-ink-3">อีเมล: {user?.email}</div>
        <button onClick={save} disabled={busy || !nickname} className="btn-primary w-full h-10 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        <button onClick={signOut} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] text-[#D85A30]" style={{ borderTop: '0.5px solid var(--color-line)', marginTop: 4, paddingTop: 12 }}>
          <IconLogout size={15} /> ออกจากระบบ
        </button>
      </div>
    </Drawer>
  )
}
