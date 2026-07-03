import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { resyncSubscription } from '@/lib/push'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<{ error: string | null }>
  signInWithEmail: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

// Offline fallback: supabase-js returns a null session when the stored access
// token is expired and can't be refreshed (no network). The session JSON is
// still in localStorage though — reuse it so the app can open offline and show
// cached data instead of bouncing to the login page. Once back online the
// auto-refresh replaces it with a real session via onAuthStateChange.
function readStoredSession(): Session | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !/^sb-.*-auth-token$/.test(k)) continue
      const raw = JSON.parse(localStorage.getItem(k) ?? 'null')
      const s = raw?.currentSession ?? raw // v1 wrapped, v2 plain
      if (s?.user) return s as Session
    }
  } catch { /* corrupt/blocked storage — treat as signed out */ }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? (!navigator.onLine ? readStoredSession() : null))
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      // offline: a failed token refresh reports null — keep the stored session
      // (after a real sign-out the stored copy is gone, so this stays null)
      setSession(s ?? (!navigator.onLine ? readStoredSession() : null))
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Keep this device's push subscription alive in the DB (heals endpoint rotation
  // that otherwise makes plan reminders silently stop).
  useEffect(() => { if (session?.user) resyncSubscription() }, [session?.user?.id])

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      if (/provider is not enabled|Unsupported provider/i.test(error.message)) {
        return { error: 'ยังไม่ได้เปิด Google login ใน Supabase — ใช้เข้าทางอีเมลไปก่อนได้ หรือเปิด Google provider ในหน้า Supabase' }
      }
      return { error: error.message }
    }
    return { error: null }
  }

  // Passwordless "magic link" sign-in by email
  async function signInWithEmail(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    // Don't leak this session's state into the next account on a shared device.
    // (The offline queue is per-user-tagged and correctly stays for its owner.)
    try { localStorage.removeItem('trip:currentId') } catch { /* ignore */ } // = TripContext STORAGE_KEY
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
