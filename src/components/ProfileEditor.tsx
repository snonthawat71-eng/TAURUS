import { useEffect, useState } from 'react'
import { Drawer } from './Drawer'
import { Avatar } from './Avatar'
import { AVATAR_COLORS, ORDER } from '@/lib/avatars'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { updateProfile } from '@/lib/tripMutations'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'

export function ProfileEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, travelers, reload } = useTrip()
  const { user } = useAuth()
  const [nickname, setNickname] = useState('')
  const [color, setColor] = useState('av3')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setNickname(profile?.nickname ?? '')
    setColor((profile?.avatar_color && profile.avatar_color in AVATAR_COLORS) ? profile.avatar_color : 'av3')
  }, [open, profile])

  async function save() {
    if (!user) return
    setBusy(true)
    await updateProfile(user.id, { nickname, avatar_color: color })
    setBusy(false)
    await reload()
    onClose()
  }

  // suggest matching a traveler name so budget/sharing line up
  const match = travelers.find((t) => t.nickname && t.nickname.toLowerCase() === nickname.trim().toLowerCase())

  return (
    <Drawer open={open} onClose={onClose} title="โปรไฟล์ของฉัน">
      <div className="flex flex-col items-center gap-2 mb-4">
        <Avatar name={nickname || '?'} color={color} size={56} ring={false} />
        <div className="flex gap-2">
          {ORDER.map((c) => (
            <button key={c} onClick={() => setColor(c)} aria-label={c} className="size-7 rounded-full"
              style={{ background: AVATAR_COLORS[c].bg, outline: color === c ? '2px solid var(--color-ink)' : 'none', outlineOffset: 2 }} />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-[11px] text-ink-3">ชื่อที่แสดง</label>
          <input className={field} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="เช่น Elf" />
          <p className="text-[11px] text-ink-3 mt-1">
            {match ? `✓ ตรงกับผู้เดินทาง "${match.nickname}" — งบ/การแชร์จะอ้างอิงเป็นคนเดียวกัน` : 'ตั้งให้ตรงกับชื่อผู้เดินทางของคุณ เพื่อให้งบประมาณอ้างอิงถูกคน'}
          </p>
        </div>
        <div className="text-[11px] text-ink-3">อีเมล: {user?.email}</div>
        <button onClick={save} disabled={busy || !nickname} className="btn-primary w-full h-10 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
      </div>
    </Drawer>
  )
}
