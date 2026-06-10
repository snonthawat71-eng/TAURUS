import { useAuth } from '@/contexts/AuthContext'
import Login from '@/pages/Login'
import { IconPlane, IconLogout } from '@tabler/icons-react'

export default function App() {
  const { loading, session, user, signOut } = useAuth()

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-canvas">
        <div className="size-9 rounded-[10px] bg-brand grid place-items-center text-white animate-pulse">
          <IconPlane size={20} stroke={1.75} />
        </div>
      </div>
    )
  }

  if (!session) return <Login />

  // Step 1 placeholder — confirms auth works. The 6-page app shell comes next.
  return (
    <div className="min-h-dvh grid place-items-center bg-canvas px-5">
      <div className="card p-6 max-w-[360px] w-full text-center">
        <div className="mx-auto mb-4 size-10 rounded-[10px] bg-brand grid place-items-center text-white">
          <IconPlane size={22} stroke={1.75} />
        </div>
        <h1 className="text-[16px] font-medium">เข้าสู่ระบบสำเร็จ ✅</h1>
        <p className="text-[12px] text-ink-3 mt-1">{user?.email}</p>
        <p className="text-[12px] text-ink-2 mt-4 leading-relaxed">
          ระบบ login ใช้งานได้แล้ว — ขั้นต่อไปเราจะสร้างหน้าตาแอป
          (sidebar + 6 หน้า) และดึงข้อมูลทริปจาก Supabase มาแสดง
        </p>
        <button
          onClick={signOut}
          className="btn-icon w-full !h-10 gap-2 !justify-center mt-5 text-[13px]"
        >
          <IconLogout size={16} />
          ออกจากระบบ
        </button>
      </div>
    </div>
  )
}
