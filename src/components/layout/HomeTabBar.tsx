import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Icon } from '@tabler/icons-react'

export interface HomeTab {
  key: string
  label: string
  icon: Icon
  onSelect: () => void
  /** small red dot on the icon (unread) */
  badge?: boolean
}

/** how far the crest rises above the bar, and how wide the wave is */
const H = 96
const BAR_TOP = 32
const DIP = 22
const HALF = 52
const PUCK = 44
const MS = 380

/** the bar's outline with a wave rising under `cx` */
function barPath(w: number, cx: number) {
  const top = BAR_TOP
  const peak = BAR_TOP - DIP
  const l = Math.max(0, cx - HALF)
  const r = Math.min(w, cx + HALF)
  return `M0,${top} H${l} C${l + 19},${top} ${cx - 33},${peak} ${cx},${peak}`
    + ` C${cx + 33},${peak} ${r - 19},${top} ${r},${top} H${w} V${H} H0 Z`
}

/** overshoot a touch, then settle — the wave reads as one liquid movement */
const easeBack = (t: number) => {
  const c = 1.35
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}

/**
 * Home / Explore / Profile bar. The white bar curves up under whichever tab you
 * are on, and the wave — with the brand circle riding it — glides across when
 * you tap another one. The circle keeps the icon and its label, the way the
 * Explore button always had.
 */
export function HomeTabBar({ tabs, active }: { tabs: HomeTab[]; active: string }) {
  const wrapRef = useRef<HTMLElement>(null)
  const fillRef = useRef<SVGPathElement>(null)
  const puckRef = useRef<HTMLSpanElement>(null)
  const raf = useRef<number | null>(null)
  const cur = useRef(0)
  const [w, setW] = useState(0)

  const idx = Math.max(0, tabs.findIndex((t) => t.key === active))
  const centre = (i: number) => (w / tabs.length) * i + w / tabs.length / 2

  // the bar is full-bleed, so its width is whatever the screen is
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setW(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!w) return
    const to = centre(idx)
    const from = cur.current || to
    const paint = (cx: number) => {
      cur.current = cx
      fillRef.current?.setAttribute('d', barPath(w, cx))
      if (puckRef.current) puckRef.current.style.transform = `translateX(${cx - PUCK / 2}px)`
    }
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (still || from === to) { paint(to); return }
    const t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / MS)
      paint(from + (to - from) * easeBack(k))
      if (k < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [idx, w, tabs.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const ActiveIcon = tabs[idx]?.icon

  return (
    <nav ref={wrapRef} className="tabbar" aria-label="เมนูหลัก">
      <svg className="tabbar-bar" width={w} height={H} viewBox={`0 0 ${w} ${H}`} aria-hidden="true">
        <path ref={fillRef} d={w ? barPath(w, centre(idx)) : ''} fill="var(--color-surface)" />
      </svg>

      <span ref={puckRef} className="tabbar-puck" aria-hidden="true">
        {ActiveIcon && <ActiveIcon size={24} stroke={1.9} />}
      </span>

      <div className="tabbar-row" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map((t) => {
          const on = t.key === active
          return (
            <button key={t.key} type="button" onClick={t.onSelect}
              className={['tabbar-tab', on ? 'is-active' : ''].join(' ')}
              aria-current={on ? 'page' : undefined} aria-label={t.label}>
              <span className="tabbar-ico">
                <t.icon size={25} stroke={1.9} />
                {t.badge && <span className="tabbar-dot" />}
              </span>
              <span className="tabbar-lb">{t.label}</span>
            </button>
          )
        })}
      </div>
      <div className="tabbar-safe" aria-hidden="true" />
    </nav>
  )
}
