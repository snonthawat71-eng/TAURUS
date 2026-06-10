import { useState } from 'react'
import { IconPlane, IconBrandGoogle, IconMail, IconCheck } from '@tabler/icons-react'
import { useAuth } from '@/contexts/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'

export default function Login() {
  const { signInWithGoogle, signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setBusy(true)
    setError(null)
    const { error } = await signInWithEmail(email)
    setBusy(false)
    if (error) setError(error)
    else setSent(true)
  }

  return (
    <div className="min-h-dvh grid place-items-center px-5 bg-canvas">
      <div className="w-full max-w-[360px]">
        {/* Brand */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="size-9 rounded-[10px] bg-brand grid place-items-center text-white">
            <IconPlane size={20} stroke={1.75} />
          </div>
          <span className="text-[18px] font-medium tracking-tight">TRIP</span>
        </div>

        <div className="card p-6">
          <h1 className="text-[16px] font-medium text-ink">เข้าสู่ระบบ</h1>
          <p className="text-[12px] text-ink-3 mt-1 mb-5">
            วางแผนทริปกับเพื่อน — เฉพาะคนที่ถูกเชิญเท่านั้น
          </p>

          {!isSupabaseConfigured && (
            <div className="mb-4 rounded-md bg-surface-2 p-3 text-[12px] text-ink-2 leading-relaxed">
              ⚙️ ยังไม่ได้ตั้งค่า Supabase — ใส่ค่า{' '}
              <code className="text-booking">VITE_SUPABASE_URL</code> และ{' '}
              <code className="text-booking">VITE_SUPABASE_ANON_KEY</code> ใน{' '}
              <code className="text-booking">.env.local</code> ก่อน แล้วรันใหม่
            </div>
          )}

          {sent ? (
            <div className="rounded-md bg-brand-soft p-4 text-center">
              <div className="mx-auto mb-2 size-9 rounded-full bg-brand grid place-items-center text-white">
                <IconCheck size={18} />
              </div>
              <p className="text-[13px] text-brand-dark font-medium">ส่งลิงก์ไปแล้ว!</p>
              <p className="text-[12px] text-brand-dark/80 mt-1">
                เช็กอีเมล <span className="font-medium">{email}</span> แล้วกดลิงก์เพื่อเข้าใช้งาน
              </p>
            </div>
          ) : (
            <>
              <button
                onClick={signInWithGoogle}
                disabled={!isSupabaseConfigured}
                className="btn-icon w-full !h-10 gap-2 !justify-center font-medium text-[13px] text-ink disabled:opacity-50"
              >
                <IconBrandGoogle size={17} stroke={2} />
                เข้าสู่ระบบด้วย Google
              </button>

              <div className="flex items-center gap-3 my-4">
                <div className="h-px flex-1 bg-line" />
                <span className="text-[11px] text-ink-3">หรือ</span>
                <div className="h-px flex-1 bg-line" />
              </div>

              <form onSubmit={handleEmail} className="space-y-2.5">
                <div className="flex items-center gap-2 rounded-md hairline px-3 h-10 bg-surface">
                  <IconMail size={16} className="text-ink-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="อีเมลของคุณ"
                    className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-ink-3"
                  />
                </div>
                {error && <p className="text-[12px] text-[#D85A30]">{error}</p>}
                <button
                  type="submit"
                  disabled={busy || !isSupabaseConfigured}
                  className="btn-primary w-full h-10 disabled:opacity-50"
                >
                  {busy ? 'กำลังส่ง...' : 'ส่งลิงก์เข้าทางอีเมล'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-ink-3 mt-5">
          การเข้าใช้งานถือว่ายอมรับว่าทริปนี้เป็นแบบส่วนตัว
        </p>
      </div>
    </div>
  )
}
