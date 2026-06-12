import { useState } from 'react'
import { IconPlane, IconPlus, IconLogout } from '@tabler/icons-react'
import { TripEditor } from './TripEditor'
import { useTrip } from '@/contexts/TripContext'
import { useAuth } from '@/contexts/AuthContext'
import { createTrip } from '@/lib/tripMutations'

export function NoTrip() {
  const { switchTrip } = useTrip()
  const { user, signOut } = useAuth()
  const [editor, setEditor] = useState(false)

  return (
    <div className="min-h-dvh grid place-items-center bg-canvas px-5">
      <div className="w-full max-w-[360px] text-center">
        <div className="mx-auto mb-4 size-12 rounded-[12px] bg-brand grid place-items-center text-white">
          <IconPlane size={24} stroke={1.75} />
        </div>
        <h1 className="text-[18px] font-medium">เริ่มทริปแรกของคุณ</h1>
        <p className="text-[13px] text-ink-2 mt-1.5 leading-relaxed">
          ยังไม่มีทริป — สร้างทริปใหม่เพื่อวางแผนการเดินทาง เพิ่มผู้ร่วมทาง ไฟล์ต ที่พัก และงบประมาณ
        </p>
        <button onClick={() => setEditor(true)} className="btn-primary w-full h-11 mt-5 flex items-center justify-center gap-1.5">
          <IconPlus size={17} /> สร้างทริป
        </button>
        <button onClick={signOut} className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-ink-3">
          <IconLogout size={14} /> ออกจากระบบ ({user?.email})
        </button>
      </div>

      <TripEditor
        open={editor}
        onClose={() => setEditor(false)}
        initial={null}
        onSave={async (fields) => {
          if (!user) return
          const { id } = await createTrip(user.id, fields)
          switchTrip(id)
        }}
      />
    </div>
  )
}
