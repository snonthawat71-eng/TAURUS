import { useEffect, useState } from 'react'
import { IconLogout } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { Avatar } from './Avatar'
import { AVATAR_COLORS, travelerColor, toHexColor } from '@/lib/avatars'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { updateProfile, updateTraveler } from '@/lib/tripMutations'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'

export function ProfileEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
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

  function pickTraveler(name: string, c: string) { setNickname(name); setColor(toHexColor(c)) }

  async function save() {
    if (!user) return
    setBusy(true)
    await updateProfile(user.id, { nickname, avatar_color: color })
    // keep the traveler that represents me in sync (match by old or new name)
    const oldName = profile?.nickname?.trim().toLowerCase()
    const newName = nickname.trim().toLowerCase()
    const me = travelers.find((t) => t.nickname?.trim().toLowerCase() === oldName)
      ?? travelers.find((t) => t.nickname?.trim().toLowerCase() === newName)
    if (me) await updateTraveler(me.id, { nickname, avatar_color: color })
    setBusy(false)
    await reload()
    onClose()
  }

  const match = travelers.find((t) => t.nickname && t.nickname.toLowerCase() === nickname.trim().toLowerCase())

  return (
    <Drawer open={open} onClose={onClose} title="โปรไฟล์ของฉัน">
      <div className="flex flex-col items-center gap-3 mb-4">
        <Avatar name={nickname || '?'} color={color} size={64} ring={false} />
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

      {travelers.length > 0 && (
        <div className="mb-4">
          <div className="text-[11px] text-ink-3 mb-1.5">คุณคือผู้เดินทางคนไหน</div>
          <div className="flex flex-wrap gap-1.5">
            {travelers.map((t, i) => {
              const c = travelerColor(t, i)
              const on = match?.id === t.id
              return (
                <button key={t.id} onClick={() => pickTraveler(t.nickname ?? '', c)}
                  className={['chip', on ? '!bg-brand-soft !text-brand-dark' : ''].join(' ')}
                  style={on ? { border: '0.5px solid var(--color-brand-border)' } : undefined}>
                  <Avatar name={t.nickname} color={c} size={16} ring={false} /> {t.nickname}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-[11px] text-ink-3">ชื่อที่แสดง</label>
          <input className={field} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="เช่น Elf" />
          <p className="text-[11px] text-ink-3 mt-1">
            {match ? `✓ เชื่อมกับผู้เดินทาง "${match.nickname}" — แก้ชื่อ/สีที่นี่ ผู้เดินทางจะอัปเดตตาม` : 'เลือกหรือพิมพ์ให้ตรงกับผู้เดินทางของคุณ เพื่อให้งบ/การแชร์อ้างอิงถูกคน'}
          </p>
        </div>
        <div className="text-[11px] text-ink-3">อีเมล: {user?.email}</div>
        <button onClick={save} disabled={busy || !nickname} className="btn-primary w-full h-10 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        <button onClick={signOut} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] text-[#D85A30]" style={{ borderTop: '0.5px solid var(--color-line)', marginTop: 4, paddingTop: 12 }}>
          <IconLogout size={15} /> ออกจากระบบ
        </button>
      </div>
    </Drawer>
  )
}
