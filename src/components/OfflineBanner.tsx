import { useEffect, useState } from 'react'
import { IconWifiOff, IconCloudUpload } from '@tabler/icons-react'
import { subscribePending } from '@/lib/offlineQueue'

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  const [pending, setPending] = useState(0)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  useEffect(() => subscribePending(setPending), [])

  if (offline) {
    return (
      <div className="flex items-center justify-center gap-1.5 h-8 text-[12px] font-medium" style={{ background: '#FDF1DF', color: '#9A6212' }}>
        <IconWifiOff size={14} /> ออฟไลน์ — กำลังแสดงข้อมูลที่บันทึกไว้
        {pending > 0 && <span>· ค้างซิงค์ {pending} รายการ</span>}
      </div>
    )
  }
  // back online but still flushing the queue
  if (pending > 0) {
    return (
      <div className="flex items-center justify-center gap-1.5 h-8 text-[12px] font-medium" style={{ background: '#E6F1FB', color: '#185FA5' }}>
        <IconCloudUpload size={14} /> กำลังซิงค์ข้อมูลออฟไลน์ {pending} รายการ…
      </div>
    )
  }
  return null
}
