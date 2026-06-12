import { useState } from 'react'
import { TaurusMark } from './TaurusMark'

// Horizontal wordmark logo for entry/main pages. Uses /taurus-03.png if present,
// otherwise falls back to the icon mark + "TAURUS" text.
export function TaurusLogo({ height = 30 }: { height?: number }) {
  const [err, setErr] = useState(false)

  if (!err) {
    return (
      <img
        src="/taurus-03.png"
        alt="TAURUS"
        style={{ height }}
        className="w-auto object-contain"
        onError={() => setErr(true)}
      />
    )
  }

  return (
    <span className="inline-flex items-center gap-2.5">
      <TaurusMark size={height} />
      <span className="font-medium tracking-[0.08em]" style={{ fontSize: height * 0.55 }}>TAURUS</span>
    </span>
  )
}
