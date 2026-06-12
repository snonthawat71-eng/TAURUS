import { Outlet } from 'react-router-dom'
import { IconPlane, IconAlertTriangle } from '@tabler/icons-react'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { TopBar } from './TopBar'
import { OfflineBanner } from '@/components/OfflineBanner'
import { NoTrip } from '@/components/NoTrip'
import { useTrip } from '@/contexts/TripContext'

export function AppShell() {
  const { loading, error, trips } = useTrip()

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-canvas">
        <div className="size-9 rounded-[10px] bg-brand grid place-items-center text-white animate-pulse">
          <IconPlane size={20} stroke={1.75} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-dvh grid place-items-center bg-canvas px-5">
        <div className="card p-6 max-w-[380px] text-center">
          <IconAlertTriangle size={26} className="mx-auto text-[#D85A30]" />
          <p className="text-[14px] font-medium mt-3">โหลดข้อมูลไม่สำเร็จ</p>
          <p className="text-[12px] text-ink-2 mt-1 leading-relaxed">{error}</p>
        </div>
      </div>
    )
  }

  if (trips.length === 0) return <NoTrip />

  return (
    <div className="flex min-h-dvh bg-canvas">
      <div className="max-md:hidden">
        <Sidebar />
      </div>
      <main className="flex-1 min-w-0 flex flex-col pb-14 md:pb-0">
        <OfflineBanner />
        <TopBar />
        <div className="flex-1 px-5 md:px-6 py-5 max-w-[860px] w-full mx-auto">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
