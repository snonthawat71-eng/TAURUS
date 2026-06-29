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
    <div className="min-h-dvh flex flex-col px-6 py-10 text-white relative overflow-hidden" style={{ background: 'var(--color-brand)' }}>
      {/* Faint oversized brand mark watermark */}
      <img
        src="/taurus-02.svg"
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] max-w-none opacity-[0.08] pointer-events-none"
        style={{ filter: 'brightness(0) invert(1)' }}
      />

      {/* Logo — centered in the available space */}
      <div className="flex-1 grid place-items-center relative z-10">
        <div style={{ filter: 'brightness(0) invert(1)' }}>
          <TaurusLogo height={54} />
        </div>
      </div>

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
