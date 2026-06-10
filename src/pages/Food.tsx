import { IconToolsKitchen2 } from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { Placeholder } from './Placeholder'

export default function Food() {
  const { places } = useTrip()
  const n = places.filter((p) => p.group_type === 'food').length
  return (
    <Placeholder
      icon={<IconToolsKitchen2 size={22} />}
      title={`Food & café — ${n} ร้าน`}
      detail="เหมือนหน้า Places แต่หมวด ร้านอาหาร / คาเฟ่ / ขนม — ทำพร้อมกันในขั้นถัดไป"
    />
  )
}
