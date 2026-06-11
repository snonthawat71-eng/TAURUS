import { useSearchParams } from 'react-router-dom'
import { PlaceGrid } from '@/components/PlaceGrid'
import { PLACE_TABS } from '@/lib/placeMeta'

export default function Places() {
  const [params] = useSearchParams()
  return (
    <PlaceGrid
      group="place"
      tabs={PLACE_TABS}
      title="สถานที่ท่องเที่ยว"
      addLabel="เพิ่มสถานที่"
      focusId={params.get('focus')}
    />
  )
}
