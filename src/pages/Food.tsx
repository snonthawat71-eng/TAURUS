import { useSearchParams } from 'react-router-dom'
import { PlaceGrid } from '@/components/PlaceGrid'
import { FOOD_TABS } from '@/lib/placeMeta'

export default function Food() {
  const [params] = useSearchParams()
  return (
    <PlaceGrid
      group="food"
      tabs={FOOD_TABS}
      title="Food & café • อาหารการกิน"
      addLabel="เพิ่มร้าน"
      focusId={params.get('focus')}
    />
  )
}
