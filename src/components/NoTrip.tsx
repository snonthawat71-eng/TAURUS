import { IconPlus, IconLogout } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { TaurusMark } from './TaurusMark'
import { useAuth } from '@/contexts/AuthContext'

export function NoTrip() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-dvh grid place-items-center bg-canvas px-5">
      <div className="w-full max-w-[360px] text-center">
        <div className="mx-auto mb-4 w-fit"><TaurusMark size={52} /></div>
        <h1 className="text-[18px] font-medium">เริ่มทริปแรกของคุณ</h1>
        <p className="text-[13px] text-ink-2 mt-1.5 leading-relaxed">
          ยังไม่มีทริป — สร้างทริปใหม่เพื่อวางแผนการเดินทาง เพิ่มผู้ร่วมทาง ไฟล์ต ที่พัก และงบประมาณ
        </p>
        <button onClick={() => navigate('/create')} className="btn-primary w-full h-11 mt-5 flex items-center justify-center gap-1.5">
          <IconPlus size={17} /> สร้างทริป
        </button>
        <button onClick={signOut} className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-ink-3">
          <IconLogout size={14} /> ออกจากระบบ ({user?.email})
        </button>
      </div>
    </div>
  )
}
