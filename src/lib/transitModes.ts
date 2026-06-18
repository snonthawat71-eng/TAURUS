import {
  IconTrain, IconBus, IconTrolley, IconTrainFilled,
  IconCar, IconCarFilled, IconSailboat, IconPlane, type Icon,
} from '@tabler/icons-react'

/** The ways a leg of a journey can be travelled. Stored on each TransitLeg. */
export type TransitMode = 'metro' | 'bus' | 'tram' | 'hsr' | 'car' | 'taxi' | 'boat' | 'plane'

/** Field labels adapt to the mode (a metro "line/station" reads as a "route/stop"
 *  for a bus, a "pier" for a boat, an "airport" for a plane, …). */
export interface ModeFields {
  line: string
  from: string
  to: string
  linePlaceholder: string
}

export interface TransitModeMeta {
  key: TransitMode
  label: string // Thai label
  short: string // compact label for the grid picker
  icon: Icon
  color: string // default colour for a new leg of this mode
  /** rail-like modes get the metro map picker, station suggestions & quick-fill;
   *  others (incl. tram & high-speed rail) take free-text line/station inputs */
  rail: boolean
  fields: ModeFields
}

export const TRANSIT_MODES: TransitModeMeta[] = [
  { key: 'metro', label: 'รถไฟฟ้า', short: 'รถไฟฟ้า', icon: IconTrain, color: '#0270FB', rail: true,
    fields: { line: 'ชื่อสาย', from: 'สถานีขึ้น', to: 'สถานีลง', linePlaceholder: 'เช่น Line 5 / Airport Express' } },
  { key: 'bus', label: 'รถเมล์', short: 'รถเมล์', icon: IconBus, color: '#135FD6', rail: false,
    fields: { line: 'สายรถเมล์', from: 'ป้ายขึ้น', to: 'ป้ายลง', linePlaceholder: 'เช่น สาย 8 / 511' } },
  { key: 'tram', label: 'รถราง', short: 'รถราง', icon: IconTrolley, color: '#3E86E8', rail: false,
    fields: { line: 'สายรถราง', from: 'สถานีขึ้น', to: 'สถานีลง', linePlaceholder: 'เช่น Tram 2' } },
  { key: 'hsr', label: 'รถไฟความเร็วสูง', short: 'รถไฟด่วน', icon: IconTrainFilled, color: '#0A3D7A', rail: false,
    fields: { line: 'ขบวน/สาย', from: 'สถานีต้นทาง', to: 'สถานีปลายทาง', linePlaceholder: 'เช่น G1234 / Shinkansen' } },
  { key: 'car', label: 'รถยนต์ส่วนตัว', short: 'รถยนต์', icon: IconCar, color: '#1E88A8', rail: false,
    fields: { line: 'เส้นทาง', from: 'ต้นทาง', to: 'ปลายทาง', linePlaceholder: 'เช่น ทางด่วน / เส้นเลียบทะเล' } },
  { key: 'taxi', label: 'แท็กซี่', short: 'แท็กซี่', icon: IconCarFilled, color: '#2AA7BE', rail: false,
    fields: { line: 'บริการ', from: 'จุดรับ', to: 'จุดส่ง', linePlaceholder: 'เช่น Grab / แท็กซี่มิเตอร์' } },
  { key: 'boat', label: 'เรือ', short: 'เรือ', icon: IconSailboat, color: '#167C92', rail: false,
    fields: { line: 'เส้นทางเรือ', from: 'ท่าขึ้น', to: 'ท่าลง', linePlaceholder: 'เช่น Star Ferry' } },
  { key: 'plane', label: 'เครื่องบิน', short: 'เครื่องบิน', icon: IconPlane, color: '#5566D6', rail: false,
    fields: { line: 'เที่ยวบิน/สายการบิน', from: 'สนามบินต้นทาง', to: 'สนามบินปลายทาง', linePlaceholder: 'เช่น TG660' } },
]

const BY_KEY = new Map(TRANSIT_MODES.map((m) => [m.key, m]))

/** Resolve a (possibly missing/legacy) mode to its metadata — defaults to metro. */
export function modeMeta(mode?: string | null): TransitModeMeta {
  return (mode ? BY_KEY.get(mode as TransitMode) : undefined) ?? TRANSIT_MODES[0]
}
