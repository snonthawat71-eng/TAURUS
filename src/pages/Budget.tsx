import { IconReceipt } from '@tabler/icons-react'
import { useTrip } from '@/contexts/TripContext'
import { Placeholder } from './Placeholder'
import { baht } from '@/lib/format'

export default function Budget() {
  const { expenses } = useTrip()
  const total = expenses.reduce((s, e) => s + (e.total ?? 0), 0)
  return (
    <Placeholder
      icon={<IconReceipt size={22} />}
      title={`Budget — รวม ${baht(total)}`}
      detail="ขั้นถัดไปจะทำการ์ดค่าใช้จ่าย (ใครจ่าย/หารกี่คน/ต่อหัว/แนบสลิป) และสรุปว่าใครต้องคืนเงินใคร"
    />
  )
}
