import { useState } from 'react'
import { IconBrandGoogle, IconMail, IconCheck, IconArrowLeft } from '@tabler/icons-react'
import { useAuth } from '@/contexts/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'
import { TaurusLogo } from '@/components/TaurusLogo'

export default function Login() {
  const { signInWithGoogle, signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [mode, setMode] = useState<'main' | 'email'>('main')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogle() {
    const { error } = await signInWithGoogle()
    if (error) setError(error)
  }

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
    <div className="min-h-dvh flex flex-col px-6 pb-10 pt-[19vh] text-white relative overflow-hidden" style={{ background: 'var(--color-brand)' }}>
      {/* Faint oversized brand mark watermark — large, bleeds off the top edge */}
      <svg
        aria-hidden="true"
        viewBox="290 290 460 520"
        fill="#ffffff"
        className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 w-[165%] max-w-none opacity-[0.05] pointer-events-none"
      >
        <path d="M636.36,313.44c-70.41-56.85-172.35-53.81-238.94,6.28-66.49,60-86.1,157.85-35.58,234.45l34,51.55,213.79-143.79c12.77-8.59,19.38-19.43,12.41-34.29-4.63-9.87-21.13-17.2-33.07-9.33l-42.16,27.8-80.44-28.62c-15.26-5.43-30.38-.18-34.29,14.24-3.52,12.98,2.86,25.17,16.95,30.59l45.83,17.62-87.33,57.34c-43.71-64.99-27.31-140.93,26.35-185.84,53.21-44.54,133.67-39.39,182.71,8.88,49.8,49.01,54.29,122.28,13.81,181.73l-110.11,161.73-57.57-85.6-39.8,26.72,75.98,113.2c6.16,9.19,17.37,14.62,26.17,12.3,8.52-2.25,15.64-8.81,21.27-17.31l135.42-204.39c47.2-80.37,23.24-179.84-45.4-235.25Z" />
      </svg>

      {/* Logo — large, sitting in the upper third */}
      <div className="relative z-10 flex justify-center">
        <div style={{ filter: 'brightness(0) invert(1)' }}>
          <TaurusLogo height={72} />
        </div>
      </div>

      <div className="flex-1" />

      {/* Bottom actions */}
      <div className="relative z-10 w-full max-w-[420px] mx-auto">
        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-2xl bg-white/15 p-3 text-[12px] leading-relaxed">
            ⚙️ Supabase is not configured — set{' '}
            <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in{' '}
            <code>.env.local</code>, then restart.
          </div>
        )}

        {sent ? (
          <div className="rounded-2xl bg-white/15 p-5 text-center">
            <div className="mx-auto mb-2 size-9 rounded-full bg-white grid place-items-center text-brand">
              <IconCheck size={18} />
            </div>
            <p className="text-[14px] font-medium">Link sent!</p>
            <p className="text-[12px] text-white/80 mt-1">
              Check <span className="font-medium">{email}</span> and tap the link to sign in.
            </p>
            <button onClick={() => { setSent(false); setMode('main') }} className="text-[12px] text-white/90 underline mt-3">
              Back
            </button>
          </div>
        ) : mode === 'email' ? (
          <form onSubmit={handleEmail} className="space-y-3">
            <button type="button" onClick={() => { setMode('main'); setError(null) }} className="flex items-center gap-1 text-[13px] text-white/90">
              <IconArrowLeft size={15} /> Back
            </button>
            <div className="flex items-center gap-2 rounded-full bg-white px-5 h-14">
              <IconMail size={18} className="text-ink-3" />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="flex-1 bg-transparent outline-none text-[15px] text-ink placeholder:text-ink-3"
              />
            </div>
            {error && <p className="text-[12px] text-white font-medium">{error}</p>}
            <button
              type="submit"
              disabled={busy || !isSupabaseConfigured}
              className="w-full h-14 rounded-full bg-white text-ink font-medium text-[15px] disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Continue with email'}
            </button>
          </form>
        ) : (
          <>
            <button
              onClick={handleGoogle}
              disabled={!isSupabaseConfigured}
              className="w-full h-14 rounded-full bg-white text-ink font-medium text-[15px] flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              <IconBrandGoogle size={19} stroke={2.4} />
              Sign in with Google
            </button>
            {error && <p className="text-[12px] text-white font-medium text-center mt-3">{error}</p>}
            <p className="text-center text-[13px] text-white/90 mt-5">
              Don't have an account?{' '}
              <button onClick={() => { setMode('email'); setError(null) }} className="font-semibold underline">
                Sign up
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
