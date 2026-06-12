// TAURUS brand mark — a location pin containing a plane, white on the brand blue.
// (SVG recreation of the brand logo; swap for the official PNG by dropping
//  /public/taurus-icon.png and using <img src="/taurus-icon.png"> if preferred.)
export function TaurusMark({ size = 28, radius }: { size?: number; radius?: number }) {
  const r = radius ?? Math.round(size * 0.28)
  return (
    <span
      className="inline-grid place-items-center shrink-0"
      style={{ width: size, height: size, borderRadius: r, background: 'var(--color-brand)' }}
    >
      <svg width={size * 0.66} height={size * 0.66} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        {/* pin outline */}
        <path
          d="M32 7 C19.85 7 10 16.4 10 28 C10 41.5 26.5 55.5 31 58.6 C31.6 59 32.4 59 33 58.6 C37.5 55.5 54 41.5 54 28 C54 16.4 44.15 7 32 7 Z"
          stroke="#fff" strokeWidth="5" strokeLinejoin="round"
        />
        {/* plane */}
        <path d="M19 31 L46 22.5 L34.5 33 L31.5 30.5 L28.5 35.5 L26 32.5 Z" fill="#fff" />
        {/* check tail */}
        <path d="M28.5 41 L33 46 L41 33.5" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
