import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { IconCheck, IconLock, IconUsers, IconPlaneTilt, IconBrandGoogle, IconMail, IconCamera, IconLoader2 } from '@tabler/icons-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { TaurusMark } from '@/components/TaurusMark'
import { Avatar } from '@/components/Avatar'
import { PhotoCropper } from '@/components/PhotoCropper'
import { uploadPublicImage } from '@/lib/files'
import { updateProfile } from '@/lib/tripMutations'
import { toast } from '@/lib/toast'
import { promptDialog } from '@/lib/confirm'

export const PENDING_INVITE_KEY = 'taurus:pendingInvite'

interface InviteInfo {
  trip_id: string
  trip_name: string | null
  flag: string | null
  start_date: string | null
  end_date: string | null
  traveler_id: string
  nickname: string | null
  claimed: boolean
  owner_name: string | null
  traveler_count: number
}

const thDate = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

/** Personal invite landing (/join/<token>) — works logged-out too: it stores
 *  the token, walks the user through login, then finishes the join in one tap. */
export default function JoinTrip() {
  const { token } = useParams()
  const { session, signInWithGoogle, signInWithEmail } = useAuth()
  const [info, setInfo] = useState<InviteInfo | null | 'bad'>(null)
  const [privacy, setPrivacy] = useState<'private' | 'trip'>('private')
  const [busy, setBusy] = useState(false)
  const [notMe, setNotMe] = useState(false)
  // optional profile photo to set on first join (like the other editors)
  const [photo, setPhoto] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const [cropping, setCropping] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    const { url } = await uploadPublicImage(file)
    if (url) { setPhoto(url); setFocus(null); setCropping(true) }
    setUploading(false)
  }

  useEffect(() => {
    if (!token || !isSupabaseConfigured) { setInfo('bad'); return }
    // remember the token across the login redirect
    try { localStorage.setItem(PENDING_INVITE_KEY, token) } catch { /* ignore */ }
    supabase.rpc('get_invite', { tok: token }).then(({ data, error }) => {
      setInfo(!error && data ? (data as InviteInfo) : 'bad')
    })
  }, [token])

  async function confirmJoin() {
    if (!token || busy) return
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('accept_invite', { tok: token, privacy_choice: privacy })
      if (error) { toast.error(error.message || 'เข้าร่วมไม่สำเร็จ'); return }
      // save the chosen profile photo onto my (now-claimed) card + account
      if (photo && session?.user?.id && info !== 'bad' && info) {
        await supabase.from('travelers').update({ avatar_url: photo, avatar_focus: focus }).eq('id', info.traveler_id)
        await updateProfile(session.user.id, { avatar_url: photo, avatar_focus: focus })
      }
      try {
        localStorage.removeItem(PENDING_INVITE_KEY)
        localStorage.setItem('trip:currentId', String(data)) // = TripContext STORAGE_KEY
      } catch { /* ignore */ }
      // full reload boots TripProvider cleanly on the new membership
      window.location.href = '/info'
    } finally { setBusy(false) }
  }

  async function loginEmail() {
    const email = await promptDialog({ title: 'เข้าสู่ระบบด้วยอีเมล', message: 'ใส่อีเมลของคุณ — ระบบจะส่งลิงก์เข้าสู่ระบบไปให้', input: { placeholder: 'you@email.com' }, confirmLabel: 'ส่งลิงก์' })
    if (!email?.trim()) return
    const { error } = await signInWithEmail(email.trim())
    if (error) toast.error(error)
    else toast.success('ส่งลิงก์แล้ว — เปิดอีเมลแล้วกดลิงก์ จากนั้นกลับมาหน้านี้')
  }

  const shell = (children: ReactNode) => (
    <div className="min-h-dvh bg-canvas flex flex-col max-w-[520px] mx-auto">
      <div className="flex items-center justify-center gap-2 pt-6">
        <TaurusMark size={26} />
        <span className="text-[14px] font-semibold tracking-[4px] text-ink">TAURUS</span>
      </div>
      {children}
    </div>
  )

  if (info === null) return shell(<div className="flex-1 grid place-items-center text-[13px] text-ink-3">กำลังเปิดคำเชิญ…</div>)
  if (info === 'bad') return shell(
    <div className="flex-1 grid place-items-center px-6 text-center">
      <div>
        <div className="text-[16px] font-medium">ลิงก์ไม่ถูกต้อง</div>
        <p className="text-[12.5px] text-ink-3 mt-2 leading-relaxed">ลิงก์เชิญนี้ใช้ไม่ได้หรือถูกยกเลิกแล้ว<br />ลองขอลิงก์ใหม่จากเจ้าของทริป</p>
      </div>
    </div>,
  )

  if (notMe) return shell(
    <div className="flex-1 grid place-items-center px-6 text-center">
      <div>
        <div className="text-[16px] font-medium">ลิงก์นี้เป็นของ “{info.nickname}”</div>
        <p className="text-[12.5px] text-ink-3 mt-2 leading-relaxed">แจ้ง{info.owner_name ? ` ${info.owner_name}` : 'เจ้าของทริป'}ว่าส่งลิงก์ผิดคน<br />แล้วขอลิงก์ของคุณเองได้เลย</p>
        <button onClick={() => setNotMe(false)} className="btn-link text-[13px] mt-4">← กลับ</button>
      </div>
    </div>,
  )

  return shell(
    <>
      <div className="flex-1 px-4 pt-4 overflow-y-auto">
        <h1 className="text-[19px] font-medium text-center mt-2">ยินดีต้อนรับ 🎉</h1>
        <p className="text-[12.5px] text-ink-3 text-center mt-1">{info.owner_name ?? 'เพื่อนของคุณ'} ชวนคุณร่วมทริป</p>

        {/* trip card — layered strip, same language as the rest of the app */}
        <div className="relative flex flex-col mt-4">
          <div className="relative -mb-3 pt-1 pb-4 px-3.5 rounded-t-[14px] flex items-center gap-1.5 text-white" style={{ background: 'var(--color-brand)' }}>
            <IconPlaneTilt size={14} className="text-white/90" />
            <span className="text-[13px] font-medium truncate">{info.flag ? `${info.flag} ` : ''}{info.trip_name ?? 'ทริป'}</span>
            <span className="text-[11px] text-white/80 ml-auto shrink-0 inline-flex items-center gap-1">
              <IconUsers size={11} /> {info.traveler_count} คน
            </span>
          </div>
          <div className="card relative p-3">
            <div className="text-[11.5px] text-ink-3 text-center">{thDate(info.start_date)} – {thDate(info.end_date)}</div>
            <div className="mt-2.5 rounded-[12px] p-3 flex items-center gap-3" style={{ background: 'var(--color-brand-soft)', border: '0.5px solid var(--color-brand-border)' }}>
              {session ? (
                <label htmlFor="join-photo-input" className="relative cursor-pointer shrink-0" title="ใส่รูปโปรไฟล์">
                  <Avatar name={info.nickname} color="av2" photo={photo} photoFocus={focus} size={44} ring={false} />
                  <span className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full grid place-items-center text-white"
                    style={{ background: 'var(--color-brand)', border: '2px solid var(--color-brand-soft)' }}>
                    {uploading ? <IconLoader2 size={11} className="animate-spin" /> : <IconCamera size={11} />}
                  </span>
                </label>
              ) : (
                <Avatar name={info.nickname} color="av2" size={38} ring={false} />
              )}
              <input id="join-photo-input" type="file" accept="image/*" hidden onChange={onPickPhoto} />
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px]" style={{ color: 'var(--color-brand-dark)' }}>การ์ดของคุณในทริปนี้</div>
                <div className="text-[15px] font-medium truncate">{info.nickname}</div>
                {session && (
                  <div className="text-[10.5px] text-ink-3 mt-0.5">
                    {photo
                      ? <>แตะรูปเพื่อเปลี่ยน · <button onClick={() => setCropping(true)} className="text-brand-mid font-medium">ครอป</button></>
                      : 'แตะรูปเพื่อเพิ่มรูปโปรไฟล์'}
                  </div>
                )}
              </div>
            </div>
            {cropping && photo && session && (
              <div className="mt-2 rounded-[12px] p-3" style={{ border: '0.5px solid var(--color-line)', background: 'var(--color-surface)' }}>
                <div className="text-[11px] text-ink-3 text-center mb-2">ลากเพื่อจัดตำแหน่ง · เลื่อนแถบเพื่อซูม</div>
                <PhotoCropper url={photo} focus={focus} onChange={setFocus} aspect="1 / 1" round />
                <button onClick={() => setCropping(false)} className="mx-auto mt-2 btn-icon !w-auto px-3 gap-1.5 text-[12px]"><IconCheck size={14} /> เสร็จ</button>
              </div>
            )}
          </div>
        </div>

        {/* privacy choice */}
        <div className="mt-5">
          <div className="text-[12px] font-medium text-ink-2 flex items-center gap-1.5 mb-2">
            <IconLock size={14} /> เอกสารสำคัญของคุณ
          </div>
          {([['private', 'ส่วนตัว', 'เห็นได้เฉพาะคุณกับเจ้าของทริป (แนะนำ)'], ['trip', 'ทุกคนในทริปเห็นได้', 'สมาชิกทุกคนเปิดเอกสาร/QR ของคุณได้']] as const).map(([v, t, d]) => (
            <button key={v} onClick={() => setPrivacy(v)} className="w-full flex gap-2.5 rounded-[12px] p-3 mb-2 text-left"
              style={privacy === v
                ? { background: 'var(--color-brand-soft)', border: '0.5px solid var(--color-brand)' }
                : { background: 'var(--color-surface)', border: '0.5px solid var(--color-line)' }}>
              <span className="mt-0.5 size-4 rounded-full shrink-0"
                style={privacy === v ? { border: '5px solid var(--color-brand)', background: '#fff' } : { border: '1.5px solid var(--color-line-2)', background: 'var(--color-surface)' }} />
              <span>
                <span className="block text-[13px] font-medium">{t}</span>
                <span className="block text-[11px] text-ink-3 mt-0.5">{d}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-6 pt-2 space-y-2">
        {info.claimed && (
          <div className="text-[11.5px] text-center rounded-md p-2" style={{ background: 'rgba(217,119,6,.08)', color: '#B45309' }}>
            การ์ดนี้ถูกยืนยันไปแล้ว — ถ้าเป็นบัญชีคุณเอง กดยืนยันซ้ำได้ปกติ
          </div>
        )}
        {session ? (
          <button onClick={confirmJoin} disabled={busy} className="btn-primary w-full h-10 disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
            <IconCheck size={15} /> {busy ? 'กำลังเข้าร่วม…' : 'ยืนยันร่วมเดินทาง'}
          </button>
        ) : (
          <>
            <div className="text-[11.5px] text-ink-3 text-center">เข้าสู่ระบบก่อน แล้วระบบจะพากลับมายืนยันต่อให้เอง</div>
            <button onClick={() => signInWithGoogle()} className="btn-primary w-full h-10 inline-flex items-center justify-center gap-1.5">
              <IconBrandGoogle size={15} /> เข้าสู่ระบบด้วย Google
            </button>
            <button onClick={loginEmail} className="w-full h-10 rounded-md text-[13px] font-medium inline-flex items-center justify-center gap-1.5"
              style={{ border: '0.5px solid var(--color-line)', color: 'var(--color-ink-2)', background: 'var(--color-surface)' }}>
              <IconMail size={15} /> เข้าด้วยอีเมล (magic link)
            </button>
          </>
        )}
        <button onClick={() => setNotMe(true)} className="w-full h-8 text-[12px] text-ink-3">ฉันไม่ใช่ “{info.nickname}”</button>
      </div>
    </>,
  )
}
