import { useState } from 'react'
import { TaurusMark } from './TaurusMark'

// Horizontal wordmark logo for entry/main pages. Uses /taurus-03.png if present,
// otherwise falls back to the icon mark + "TAURUS" text.
export function TaurusLogo({ height = 30 }: { height?: number }) {
  const [err, setErr] = useState(false)

  if (!err) {
    // light + dark (white-text) variants — CSS shows the one matching the theme
    return (
      <>
        <img
          src="/taurus-04.svg"
          alt="TAURUS"
          style={{ height }}
          className="w-auto object-contain theme-light-only"
          onError={() => setErr(true)}
        />
        <img
          src="/taurus-04-white.svg"
          alt="TAURUS"
          style={{ height }}
          className="w-auto object-contain theme-dark-only"
          onError={() => setErr(true)}
        />
      </>
    )
  }

  return (
    <span className="inline-flex items-center gap-2.5">
      <TaurusMark size={height} />
      <span className="font-medium tracking-[0.08em]" style={{ fontSize: height * 0.55 }}>TAURUS</span>
    </span>
  )
}
