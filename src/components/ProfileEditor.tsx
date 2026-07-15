import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconLogout, IconCheck, IconCamera, IconLoader2, IconTrash, IconCrop,
  IconWorld, IconPlaneTilt, IconMapPin, IconChevronRight, IconEye, IconHeart, IconThumbUp, IconMessageCircle,
} from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { Avatar } from './Avatar'
import { PhotoCropper } from './PhotoCropper'
import { AVATAR_COLORS, toHexColor } from '@/lib/avatars'
import { uploadPublicImage } from '@/lib/files'
import { countryFlag } from '@/lib/countries'
import { tripFlag } from '@/lib/segments'
import { listMyExplore, allPopularity } from '@/lib/exploreMutations'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { updateProfile, updateTraveler, claimTraveler } from '@/lib/tripMutations'

const field = 'hairline rounded-md text-[13px] h-10 px-3 bg-surface w-full outline-none focus:border-brand'
const todayISO = () => new Date().toISOString().slice(0, 10)

interface ExploreStats { shared: number; views: number; saves: number; likes: number; comments: number }

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
  const { profile, travelers, trips, reload } = useTrip()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [color, setColor] = useState(AVATAR_COLORS.av3.bg) // free-form hex
  const [photo, setPhoto] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const [cropping, setCropping] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [stats, setStats] = useState<ExploreStats | null>(null)

  useEffect(() => {
    if (!open) return
    setNickname(profile?.nickname ?? '')
    setColor(toHexColor(profile?.avatar_color))
    setPhoto(profile?.avatar_url ?? null)
    setFocus(profile?.avatar_focus ?? null)
    setCropping(false)
  }, [open, profile])

  // my Explore contribution stats — shared count + total engagement received
  useEffect(() => {
    if (!open || !user) { setStats(null); return }
    let active = true
    ;(async () => {
      const [{ data: mine }, pop] = await Promise.all([listMyExplore(user.id), allPopularity()])
      if (!active) return
      const items = (mine ?? []) as { id: string }[]
      let views = 0, saves = 0, likes = 0, comments = 0
      for (const it of items) {
        const p = pop.get(it.id)
        if (p) { views += p.views; saves += p.saves; likes += p.likes; comments += p.comments }
      }
      setStats({ shared: items.length, views, saves, likes, comments })
    })()
    return () => { active = false }
  }, [open, user?.id])

  // travel stats from every trip I can see: countries visited (unique) + next trip
  const travel = useMemo(() => {
    const flags = new Map<string, string>()
    for (const t of trips) {
      const key = (t.country ?? '').trim().toLowerCase()
      if (key) flags.set(key, tripFlag(t) || countryFlag(t.country) || '🌍')
    }
    const today = todayISO()
    const upcoming = trips
      .filter((t) => t.start_date && t.start_date >= today)
      .sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1))[0] ?? null
    const daysTo = upcoming?.start_date
      ? Math.round((new Date(upcoming.start_date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000)
      : null
    return { trips: trips.length, flags: [...flags.values()], countries: flags.size, upcoming, daysTo }
  }, [trips])

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    const { url } = await uploadPublicImage(file)
    if (url) { setPhoto(url); setFocus(null); setCropping(true) } // new image → crop it right away
    setUploading(false)
  }
  function removePhoto() { setPhoto(null); setFocus(null); setCropping(false) }
  function goManage() { onClose(); navigate('/explore/mine') }

  // my traveler card in THIS trip — the one claimed by my user_id (authoritative)
  const myTraveler = scope === 'trip' && user ? travelers.find((t) => t.user_id === user.id) : undefined

  async function save() {
    if (!user) return
    setBusy(true)
    await updateProfile(user.id, { nickname, avatar_color: color, avatar_url: photo, avatar_focus: photo ? focus : null })
    // In a trip, also update the card that represents me. Prefer the claimed
    // card; if none (legacy trip), claim the one matching my saved name first.
    if (scope === 'trip') {
      let me = travelers.find((t) => t.user_id === user.id)
      if (!me) {
        const savedName = (profile?.nickname ?? '').trim().toLowerCase()
        const byName = savedName ? travelers.find((t) => t.nickname?.trim().toLowerCase() === savedName) : undefined
        if (byName) { await claimTraveler(byName.id, user.id); me = byName }
      }
      if (me) await updateTraveler(me.id, { nickname, avatar_color: color, avatar_url: photo, avatar_focus: photo ? focus : null })
    }
    setBusy(false)
    await reload()
    onClose()
  }

  const stat = (label: string, value: number | string) => (
    <div className="flex-1 text-center">
      <div className="text-[18px] font-semibold leading-none tabular-nums">{value}</div>
      <div className="text-[10px] mt-1 text-white/80">{label}</div>
    </div>
  )

  return (
    <Drawer open={open} onClose={onClose} title="โปรไฟล์ของฉัน">
      {cropping && photo ? (
        <div className="mb-4">
          <div className="text-[11px] text-ink-3 text-center mb-2">ลากเพื่อจัดตำแหน่ง · เลื่อนแถบเพื่อซูม</div>
          <PhotoCropper url={photo} focus={focus} onChange={setFocus} aspect="1 / 1" round />
          <button onClick={() => setCropping(false)}
            className="mx-auto mt-2 btn-icon !w-auto px-3 gap-1.5 text-[12px]"><IconCheck size={14} /> เสร็จ</button>
        </div>
      ) : (
        /* ── passport header — avatar + name + travel stats + country stamps ── */
        <div className="rounded-[16px] p-4 mb-3 text-white overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-mid) 100%)' }}>
          <div className="flex flex-col items-center gap-2">
            <label htmlFor="profile-photo-input" className="relative cursor-pointer" title="ใส่รูปโปรไฟล์">
              <span className="block rounded-full" style={{ boxShadow: '0 0 0 3px rgba(255,255,255,.35)' }}>
                <Avatar name={nickname || '?'} color={color} photo={photo} photoFocus={focus} size={76} ring={false} />
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 size-6 rounded-full grid place-items-center text-brand bg-white shadow">
                {uploading ? <IconLoader2 size={12} className="animate-spin" /> : <IconCamera size={12} />}
              </span>
            </label>
            <div className="text-[17px] font-semibold leading-tight mt-0.5">{nickname || 'นักเดินทาง'}</div>
            {travel.upcoming && (
              <div className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium bg-white/15">
                <IconPlaneTilt size={12} />
                {travel.daysTo === 0 ? 'ออกเดินทางวันนี้!' : `อีก ${travel.daysTo} วันไป ${travel.upcoming.name ?? 'ทริปถัดไป'}`}
              </div>
            )}
          </div>
          <div className="flex items-stretch mt-4 rounded-[12px] bg-white/12 py-2.5">
            {stat('ทริป', travel.trips)}
            <span className="w-px bg-white/25 my-1" />
            {stat('ประเทศ', travel.countries)}
            <span className="w-px bg-white/25 my-1" />
            {stat('แชร์ไว้', stats ? stats.shared : '—')}
          </div>
          {travel.flags.length > 0 && (
            <div className="flex items-center gap-1 mt-3">
              <IconWorld size={13} className="text-white/70 shrink-0" />
              <div className="flex gap-1 overflow-hidden">
                {travel.flags.slice(0, 10).map((f, i) => (
                  <span key={i} className="text-[16px] leading-none" style={{ transform: `rotate(${(i % 2 ? 1 : -1) * 4}deg)` }}>{f}</span>
                ))}
                {travel.flags.length > 10 && <span className="text-[11px] text-white/80 self-center">+{travel.flags.length - 10}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {!cropping && (
        <>
          {/* photo controls */}
          <input id="profile-photo-input" type="file" accept="image/*" hidden onChange={onPickPhoto} />
          <div className="flex items-center gap-2 justify-center mb-3">
            <label className="flex items-center gap-2 cursor-pointer rounded-full pl-1.5 pr-3 h-9 bg-surface-2 text-[12px] font-medium text-ink-2" title="เลือกสีจากวงล้อสี">
              <span className="size-7 rounded-full grid place-items-center relative overflow-hidden shrink-0"
                style={{ background: 'conic-gradient(red, orange, yellow, lime, aqua, blue, magenta, red)' }}>
                <span className="size-4 rounded-full" style={{ background: color, boxShadow: '0 0 0 2px #fff' }} />
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
              </span>
              เลือกสีเอง
            </label>
            {photo && (
              <button onClick={() => setCropping(true)} className="inline-flex items-center gap-1 text-[12px] text-brand-mid h-9 px-2">
                <IconCrop size={13} /> ครอป
              </button>
            )}
            {photo && (
              <button onClick={removePhoto} className="inline-flex items-center gap-1 text-[12px] text-[#D85A30] h-9 px-2">
                <IconTrash size={13} /> ลบรูป
              </button>
            )}
          </div>

          {/* my Explore contributions + quick link to manage them */}
          <button onClick={goManage} className="w-full card p-3 text-left hover:bg-surface-2/40 mb-3">
            <div className="flex items-center gap-2">
              <IconMapPin size={15} className="text-brand shrink-0" />
              <span className="text-[13px] font-medium flex-1">สถานที่ที่ฉันแชร์{stats && stats.shared > 0 ? ` · ${stats.shared}` : ''}</span>
              <IconChevronRight size={16} className="text-ink-3" />
            </div>
            <div className="flex items-center gap-3.5 text-[11px] text-ink-3 mt-2 pl-0.5">
              <span className="inline-flex items-center gap-1" title="ยอดคลิก"><IconEye size={13} /> {stats?.views ?? 0}</span>
              <span className="inline-flex items-center gap-1" title="ยอดเซฟ"><IconHeart size={13} /> {stats?.saves ?? 0}</span>
              <span className="inline-flex items-center gap-1" title="ยอดไลก์"><IconThumbUp size={13} /> {stats?.likes ?? 0}</span>
              <span className="inline-flex items-center gap-1" title="ยอดคอมเมนต์"><IconMessageCircle size={13} /> {stats?.comments ?? 0}</span>
            </div>
          </button>

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
                <Avatar name={nickname || myTraveler.nickname || '?'} color={color} photo={photo} photoFocus={focus} size={30} ring={false} />
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
        </>
      )}
    </Drawer>
  )
}
