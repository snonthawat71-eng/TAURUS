import { IconCalendarEvent } from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { Placeholder } from './Placeholder'

export default function Itinerary() {
  const { days, stops } = useTrip()
  return (
    <Placeholder
      icon={<IconCalendarEvent size={22} />}
      title={`Itinerary — ${days.length} วัน, ${stops.length} จุด`}
      detail="หน้าไฮไลต์! ขั้นถัดไปจะทำการ์ดรายวัน ลากจัดเรียงจุดแวะได้ และเส้นทางรถไฟฟ้าแบบ AMap (ข้อมูลตัวอย่างพร้อมแล้ว)"
    />
  )
}
