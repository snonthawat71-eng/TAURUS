import { IconLayoutList } from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { Placeholder } from './Placeholder'

export default function AllPlans() {
  const { places } = useTrip()
  const n = places.filter((p) => p.in_plan).length
  return (
    <Placeholder
      icon={<IconLayoutList size={22} />}
      title={`All plans — ติ๊กแล้ว ${n} รายการ`}
      detail="รวมสถานที่/ร้านที่ติ๊กเพิ่มในแพลนแล้ว แยกตามหมวด — ทำในขั้นถัดไป"
    />
  )
}
