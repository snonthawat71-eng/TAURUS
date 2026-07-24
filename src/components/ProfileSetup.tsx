import { useState } from 'react'
import { IconCamera, IconLoader2, IconCrop, IconTrash, IconCheck, IconLogout } from '@tabler/icons-react'
import { Avatar } from './Avatar'
import { PhotoCropper } from './PhotoCropper'
import { TaurusMark } from './TaurusMark'
import { AVATAR_COLORS } from '@/lib/avatars'
import { uploadPublicImage } from '@/lib/files'
import { useAuth } from '@/contexts/AuthContext'
import { completeOnboarding } from '@/lib/tripMutations'
import { toast } from '@/lib/toast'

/**
 * First-run screen shown ONCE to a brand-new signup (right after they confirm
 * their email), before the app itself. They set a display name / colour / photo,
 * and "เริ่มใช้งาน" flips profiles.onboarded so it never shows again. Existing
 * users are backfilled onboarded=true (supabase/onboarding.sql) and never see it.
 */
export function ProfileSetup({ onDone }: { onDone: () => void }) {
  const { user, signOut } = useAuth()
  const [nickname, setNickname] = useState(user?.email?.split('@')[0] ?? '')
  const [color, setColor] = useState(AVATAR_COLORS.av3.bg)
  const [photo, setPhoto] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const [cropping, setCropping] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)

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

  async function start() {
    if (!user || !nickname.trim()) return
    setBusy(true)
    const res = await completeOnboarding(user.id, {
      nickname: nickname.trim(), avatar_color: color,
      avatar_url: photo, avatar_focus: photo ? focus : null,
    })
    setBusy(false)
    // never silently proceed on a failed write — the identity wouldn't be
    // saved and the gate would still show setup again next time regardless
    if (res.error) { toast.error('บันทึกไม่สำเร็จ — ลองอีกครั้ง: ' + res.error.message); return }
    try { localStorage.setItem(`onboarded:${user.id}`, '1') } catch { /* ignore */ }
    onDone()
  }

  return (
    <div className="min-h-dvh bg-canvas flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <TaurusMark size={40} />
          <h1 className="text-[20px] font-bold mt-3">ยินดีต้อนรับสู่ TAURUS</h1>
          <p className="text-[13px] text-ink-3 mt-1">ตั้งชื่อและรูปโปรไฟล์ก่อนเริ่มใช้งาน</p>
        </div>

        <div className="flex flex-col items-center gap-3 mb-5">
          {cropping && photo ? (
            <div className="w-full">
              <div className="text-[11px] text-ink-3 text-center mb-2">ลากเพื่อจัดตำแหน่ง · เลื่อนแถบเพื่อซูม</div>
              <PhotoCropper url={photo} focus={focus} onChange={setFocus} aspect="1 / 1" round />
              <button onClick={() => setCropping(false)} className="mx-auto mt-2 btn-icon !w-auto px-3 gap-1.5 text-[12px]"><IconCheck size={14} /> เสร็จ</button>
            </div>
          ) : (
            <>
              <label htmlFor="setup-photo-input" className="relative cursor-pointer" title="ใส่รูปโปรไฟล์">
                <Avatar name={nickname || '?'} color={color} photo={photo} photoFocus={focus} size={84} ring={false} />
                <span className="absolute -bottom-0.5 -right-0.5 size-6 rounded-full grid place-items-center text-white"
                  style={{ background: 'var(--color-brand)', border: '2px solid var(--color-surface)' }}>
                  {uploading ? <IconLoader2 size={12} className="animate-spin" /> : <IconCamera size={12} />}
                </span>
              </label>
              <input id="setup-photo-input" type="file" accept="image/*" hidden onChange={onPickPhoto} />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer rounded-full pl-1.5 pr-3 h-9 bg-surface-2 text-[12px] font-medium text-ink-2" title="เลือกสี">
                  <span className="size-7 rounded-full grid place-items-center relative overflow-hidden shrink-0"
                    style={{ background: 'conic-gradient(red, orange, yellow, lime, aqua, blue, magenta, red)' }}>
                    <span className="size-4 rounded-full" style={{ background: color, boxShadow: '0 0 0 2px #fff' }} />
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </span>
                  เลือกสี
                </label>
                {photo && <button onClick={() => setCropping(true)} className="inline-flex items-center gap-1 text-[12px] text-brand-mid h-9 px-2"><IconCrop size={13} /> ครอป</button>}
                {photo && <button onClick={removePhoto} className="inline-flex items-center gap-1 text-[12px] text-[#D85A30] h-9 px-2"><IconTrash size={13} /> ลบรูป</button>}
              </div>
            </>
          )}
        </div>

        <label className="text-[11px] text-ink-3">ชื่อเล่น (ชื่อที่แสดง)</label>
        <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="เช่น Elf" autoFocus
          className="hairline rounded-md text-[14px] h-11 px-3 bg-surface w-full outline-none focus:border-brand mt-1" />

        <button onClick={start} disabled={busy || !nickname.trim()} className="btn-primary w-full h-11 mt-5 disabled:opacity-50">
          {busy ? 'กำลังบันทึก...' : 'เริ่มใช้งาน'}
        </button>
        <button onClick={signOut} className="w-full h-10 flex items-center justify-center gap-1.5 text-[12.5px] text-ink-3 mt-1.5">
          <IconLogout size={14} /> ออกจากระบบ
        </button>
      </div>
    </div>
  )
}
