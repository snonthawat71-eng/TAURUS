import type { ReactNode } from 'react'

export function Placeholder({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="card p-8 text-center">
      <div className="mx-auto size-11 rounded-[12px] bg-brand-soft grid place-items-center text-brand-dark mb-3">
        {icon}
      </div>
      <h2 className="text-[15px] font-medium">{title}</h2>
      <p className="text-[12px] text-ink-2 mt-1.5 leading-relaxed max-w-[320px] mx-auto">{detail}</p>
      <span className="inline-block mt-4 chip !bg-surface-2">กำลังจะทำในขั้นถัดไป</span>
    </div>
  )
}
