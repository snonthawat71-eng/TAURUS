import { useEffect, useState } from 'react'
import { IconWifiOff } from '@tabler/icons-react'

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  if (!offline) return null
  return (
    <div className="flex items-center justify-center gap-1.5 h-8 text-[12px] font-medium" style={{ background: '#FDF1DF', color: '#9A6212' }}>
      <IconWifiOff size={14} /> ออฟไลน์ — กำลังแสดงข้อมูลที่บันทึกไว้
    </div>
  )
}
