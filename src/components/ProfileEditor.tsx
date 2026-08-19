import { useEffect, useState } from 'react'
import { IconLogout, IconCheck, IconCamera, IconLoader2, IconTrash, IconCrop, IconTargetArrow, IconSun, IconMoon, IconDeviceMobile, IconRefresh } from '@tabler/icons-react'
import { themePref, setThemePref, type ThemePref } from '@/lib/theme'
import { Drawer } from './Drawer'
import { Avatar } from './Avatar'
import { PhotoCropper } from './PhotoCropper'
import { AVATAR_COLORS, toHexColor } from '@/lib/avatars'
import { uploadPublicImage } from '@/lib/files'
import { supabase } from '@/lib/supabase'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { updateProfile, claimTraveler } from '@/lib/tripMutations'
import { checkForUpdateNow } from '@/lib/pwa'
import { toast } from '@/lib/toast'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'
const lbl = 'text-[11px] text-ink-3'
const yearNow = new Date().getFullYear()

/**
 * Profile settings drawer (opened from the /profile page's gear). Edits the
 * identity that syncs everywhere — name, full name, colour, photo/crop — plus
 * this year's travel goal. Saving pushes the identity to every traveler card I've
 * claimed across ALL trips (by user_id), so it changes in every trip at once.
 */
export function ProfileEditor({ open, onClose, scope = 'trip' }: { open: boolean; onClose: () => void; scope?: 'global' | 'trip' }) {
  const { profile, travelers, reload } = useTrip()
  const { user, signOut } = useAuth()
  const [nickname, setNickname] = useState('')
  const [fullName, setFullName] = useState('')
  const [color, setColor] = useState(AVATAR_COLORS.av3.bg) // free-form hex
  const [photo, setPhoto] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const [goal, setGoal] = useState(0)
  const [theme, setTheme] = useState<ThemePref>(themePref())
  const [cropping, setCropping] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!open) return
    setNickname(profile?.nickname ?? '')
    setFullName(profile?.full_name ?? '')
    setColor(toHexColor(profile?.avatar_color))
    setPhoto(profile?.avatar_url ?? null)
    setFocus(profile?.avatar_focus ?? null)
    setGoal(profile?.year_goal?.[String(yearNow)] ?? 0)
    setCropping(false)
  }, [open, profile])

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    const { url } = await uploadPublicImage(file)
    if (url) { setPhoto(url); setFocus(null); setCropping(true) }
    setUploading(false)
  }
  function removePhoto() { setPhoto(null); setFocus(null); setCropping(false) }

  const myTraveler = scope === 'trip' && user ? travelers.find((t) => t.user_id === user.id) : undefined

  // New builds normally install themselves when the app is opened, so the
  // "อัปเดต" bar rarely shows — this is the always-available manual path.
  async function checkUpdate() {
    setChecking(true)
    const r = await checkForUpdateNow()
    if (r === 'updating') toast.success('เจอเวอร์ชันใหม่ — กำลังอัปเดต แล้วจะรีเฟรชให้เอง')
    else if (r === 'offline') toast.error('ตรวจไม่ได้ตอนนี้ — เช็คอินเทอร์เน็ตแล้วลองใหม่')
    else { toast.success('ใช้เวอร์ชันล่าสุดอยู่แล้ว'); setChecking(false) }
  }

  async function save() {
    if (!user) return
    setBusy(true)
    const yg = { ...(profile?.year_goal ?? {}), [String(yearNow)]: Math.max(0, Math.round(goal)) }
    await updateProfile(user.id, {
      nickname, full_name: fullName.trim() || null, avatar_color: color,
      avatar_url: photo, avatar_focus: photo ? focus : null, year_goal: yg,
    })
    // heal a legacy unclaimed current-trip card so it, too, gets synced
    const mine = travelers.find((t) => t.user_id === user.id)
    if (!mine) {
      const savedName = (profile?.nickname ?? '').trim().toLowerCase()
      const byName = savedName ? travelers.find((t) => t.nickname?.trim().toLowerCase() === savedName) : undefined
      if (byName) await claimTraveler(byName.id, user.id)
    }
    // sync my identity to EVERY card I've claimed, across all trips (best-effort)
    await supabase.from('travelers')
      .update({ nickname, full_name: fullName.trim() || null, avatar_color: color, avatar_url: photo, avatar_focus: photo ? focus : null })
      .eq('user_id', user.id)
    setBusy(false)
    await reload()
    onClose()
  }

  return (
    <Drawer open={open} onClose={onClose} title="ตั้งค่าโปรไฟล์">
      <div className="flex flex-col items-center gap-3 mb-5">
        {cropping && photo ? (
          <div className="w-full">
            <div className="text-[11px] text-ink-3 text-center mb-2">ลากเพื่อจัดตำแหน่ง · เลื่อนแถบเพื่อซูม</div>
            <PhotoCropper url={photo} focus={focus} onChange={setFocus} aspect="1 / 1" round />
            <button onClick={() => setCropping(false)} className="mx-auto mt-2 btn-icon !w-auto px-3 gap-1.5 text-[12px]"><IconCheck size={14} /> เสร็จ</button>
          </div>
        ) : (
          <>
            <label htmlFor="profile-photo-input" className="relative cursor-pointer" title="ใส่รูปโปรไฟล์">
              <Avatar name={nickname || '?'} color={color} photo={photo} photoFocus={focus} size={76} ring={false} />
              <span className="absolute -bottom-0.5 -right-0.5 size-6 rounded-full grid place-items-center text-white"
                style={{ background: 'var(--color-brand)', border: '2px solid var(--color-surface)' }}>
                {uploading ? <IconLoader2 size={12} className="animate-spin" /> : <IconCamera size={12} />}
              </span>
            </label>
            <input id="profile-photo-input" type="file" accept="image/*" hidden onChange={onPickPhoto} />
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer rounded-full pl-1.5 pr-3 h-9 bg-surface-2 text-[12px] font-medium text-ink-2" title="เลือกสีจากวงล้อสี">
                <span className="size-7 rounded-full grid place-items-center relative overflow-hidden shrink-0"
                  style={{ background: 'conic-gradient(red, orange, yellow, lime, aqua, blue, magenta, red)' }}>
                  <span className="size-4 rounded-full" style={{ background: color, boxShadow: '0 0 0 2px #fff' }} />
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                </span>
                เลือกสีเอง
              </label>
              {photo && <button onClick={() => setCropping(true)} className="inline-flex items-center gap-1 text-[12px] text-brand-mid h-9 px-2"><IconCrop size={13} /> ครอป</button>}
              {photo && <button onClick={removePhoto} className="inline-flex items-center gap-1 text-[12px] text-[#D85A30] h-9 px-2"><IconTrash size={13} /> ลบรูป</button>}
            </div>
          </>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className={lbl}>ชื่อเล่น (ชื่อที่แสดง)</label>
          <input className={field} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="เช่น Elf" />
        </div>
        <div>
          <label className={lbl}>ชื่อ-นามสกุล</label>
          <input className={field} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="เช่น Nuttaporn Saengthong" />
        </div>
        <p className="text-[11px] text-ink-3 -mt-1">ชื่อ · สี · รูป จะซิงค์ให้ทุกทริปที่เป็นการ์ดของคุณโดยอัตโนมัติ</p>

        {/* yearly travel goal — drives the passport bar on the profile page */}
        <div className="rounded-[10px] p-3" style={{ background: 'var(--color-brand-soft)', border: '0.5px solid var(--color-brand-border)' }}>
          <div className="text-[12px] font-medium flex items-center gap-1.5" style={{ color: 'var(--color-brand-dark)' }}>
            <IconTargetArrow size={14} /> เป้าหมายการเดินทางปี {yearNow + 543}
          </div>
          <div className="text-[11px] text-ink-3 mt-0.5 mb-2">ตั้งว่าปีนี้อยากไปกี่ทริป — แถบพาสปอร์ตจะเติมช่องตามทริปจริง</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setGoal((g) => Math.max(0, g - 1))} className="size-9 rounded-full bg-surface hairline text-[18px] font-medium leading-none">−</button>
            <input type="number" min={0} max={30} value={goal} onChange={(e) => setGoal(Math.max(0, Math.min(30, Number(e.target.value) || 0)))}
              className="hairline rounded-md text-[15px] font-semibold text-center h-10 w-16 bg-surface outline-none focus:border-brand" />
            <button onClick={() => setGoal((g) => Math.min(30, g + 1))} className="size-9 rounded-full bg-surface hairline text-[18px] font-medium leading-none">+</button>
            <span className="text-[12px] text-ink-3">ทริป</span>
          </div>
        </div>

        {/* theme — applies instantly, no save needed */}
        <div>
          <label className={lbl}>ธีมของแอป</label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {([['light', 'สว่าง', IconSun], ['dark', 'มืด', IconMoon], ['system', 'ตามเครื่อง', IconDeviceMobile]] as const).map(([v, label, Icon]) => {
              const on = theme === v
              return (
                <button key={v} onClick={() => { setTheme(v); setThemePref(v) }}
                  className="h-10 rounded-md text-[12px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors"
                  style={on
                    ? { background: 'var(--color-brand-soft)', border: '0.5px solid var(--color-brand-border)', color: 'var(--color-brand-dark)' }
                    : { background: 'var(--color-surface)', border: '0.5px solid var(--color-line)', color: 'var(--color-ink-2)' }}>
                  <Icon size={14} /> {label}
                </button>
              )
            })}
          </div>
        </div>

        {scope === 'trip' && myTraveler && (
          <div className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5" style={{ background: 'var(--color-surface-2)' }}>
            <Avatar name={nickname || myTraveler.nickname || '?'} color={color} photo={photo} photoFocus={focus} size={30} ring={false} />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium flex items-center gap-1"><IconCheck size={13} className="text-brand" /> การ์ดของคุณในทริปนี้</div>
              <div className="text-[11px] text-ink-3 mt-0.5">แก้ที่นี่ การ์ดผู้เดินทางจะอัปเดตตามให้เอง</div>
            </div>
          </div>
        )}

        {/* เวอร์ชันแอป — ปกติอัปเดตให้เองตอนเปิดแอป ปุ่มนี้ไว้บังคับเช็คเอง */}
        <button onClick={checkUpdate} disabled={checking}
          className="w-full flex items-center gap-2.5 rounded-[10px] px-3 h-11 text-left disabled:opacity-60"
          style={{ background: 'var(--color-surface-2)' }}>
          {checking ? <IconLoader2 size={15} className="animate-spin text-ink-3 shrink-0" /> : <IconRefresh size={15} className="text-brand shrink-0" />}
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium">{checking ? 'กำลังตรวจ…' : 'ตรวจหาอัปเดต'}</div>
            <div className="text-[10.5px] text-ink-3">ปกติแอปอัปเดตให้เองตอนเปิด — กดถ้าอยากเช็คเดี๋ยวนี้</div>
          </div>
        </button>

        <div className="text-[11px] text-ink-3">อีเมล: {user?.email}</div>
        <button onClick={save} disabled={busy || !nickname} className="btn-primary w-full h-10 disabled:opacity-50">{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        <button onClick={signOut} className="w-full h-10 flex items-center justify-center gap-1.5 text-[13px] text-[#D85A30]" style={{ borderTop: '0.5px solid var(--color-line)', marginTop: 4, paddingTop: 12 }}>
          <IconLogout size={15} /> ออกจากระบบ
        </button>
      </div>
    </Drawer>
  )
}
