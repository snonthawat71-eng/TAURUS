import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconAlertTriangle } from '@tabler/icons-react'
import { supabase } from '@/lib/supabase'
import { useTrip } from '@/contexts/TripContext'
import { TaurusMark } from '@/components/TaurusMark'

const PENDING_KEY = 'taurus:pendingInvite'

/** Accept a copy-link invite (/join/:token): join the trip, then open it. */
export default function JoinTrip() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { switchTrip } = useTrip()
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return // guard against React StrictMode double-run
    ran.current = true
    ;(async () => {
      if (!token) { setError('ลิงก์เชิญไม่ถูกต้อง'); return }
      const { data, error } = await supabase.rpc('accept_invite_token', { p_token: token })
      localStorage.removeItem(PENDING_KEY)
      if (error || !data) { setError('ลิงก์เชิญใช้ไม่ได้หรือหมดอายุแล้ว'); return }
      switchTrip(data as string) // triggers TripContext to load the joined trip
      navigate('/places', { replace: true })
    })()
  }, [token, navigate, switchTrip])

  return (
    <div className="min-h-dvh grid place-items-center bg-canvas px-6">
      {error ? (
        <div className="card p-6 text-center max-w-[340px]">
          <IconAlertTriangle size={28} className="mx-auto text-[#D85A30]" />
          <p className="text-[14px] font-medium mt-2">เข้าร่วมทริปไม่สำเร็จ</p>
          <p className="text-[12px] text-ink-3 mt-1">{error}</p>
          <button onClick={() => navigate('/', { replace: true })} className="btn-primary h-10 px-4 mt-4">ไปหน้าทริปของฉัน</button>
        </div>
      ) : (
        <div className="text-center">
          <span className="animate-pulse"><TaurusMark size={40} /></span>
          <p className="text-[13px] text-ink-3 mt-3">กำลังเข้าร่วมทริป…</p>
        </div>
      )}
    </div>
  )
}
