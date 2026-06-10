import { IconMapPin } from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { Placeholder } from './Placeholder'

export default function Places() {
  const { places } = useTrip()
  const n = places.filter((p) => p.group_type === 'place').length
  return (
    <Placeholder
      icon={<IconMapPin size={22} />}
      title={`Places — ${n} แห่ง`}
      detail="ขั้นถัดไปจะทำการ์ดสถานที่ (รูป, สถานี+สีสาย, โน้ต, ติ๊กเพิ่มในแพลน, อวตารคนอยากไป) พร้อมแท็บกรองหมวด"
    />
  )
}
