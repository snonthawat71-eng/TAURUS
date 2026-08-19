import { optimizeImageUrl } from './cloudinary'

/** A shared place, drawn as a picture.
 *
 *  Link previews are out of reach here: the app is a static SPA, so whatever
 *  a messaging app scrapes off the url is the same for every place. Drawing
 *  the card ourselves and attaching it to the share sheet gets the photo, the
 *  name and the brand into the message regardless — and it survives being
 *  forwarded, unlike a preview. */
export interface ShareCardInput {
  name: string | null | undefined
  city?: string | null
  country?: string | null
  photoUrl?: string | null
  /** average stars, only drawn when at least one person has rated */
  rating?: number | null
  ratedCount?: number | null
  /** category label + colours, used for the no-photo card */
  category?: { label: string; bg: string; fg: string } | null
}

const W = 1080
const H = 1350
const PAD = 76
const FONT = "'Inter','Noto Sans Thai',ui-sans-serif,system-ui,sans-serif"

/** Load an image we're allowed to read back out of the canvas. Resolves null on
 *  a CORS refusal rather than throwing — the card just falls back to colour. */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** Break `text` into at most `maxLines` lines that fit `maxW`, ellipsing the
 *  last one. Measures with the font already set on the context. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (ctx.measureText(next).width <= maxW || !cur) { cur = next; continue }
    lines.push(cur)
    cur = w
    if (lines.length === maxLines) break
  }
  if (lines.length < maxLines && cur) lines.push(cur)

  // a single word longer than the line (Thai runs on without spaces) — cut it
  if (lines.length === 1 && ctx.measureText(lines[0]).width > maxW) {
    const only = lines[0]
    lines.length = 0
    let buf = ''
    for (const ch of only) {
      if (ctx.measureText(buf + ch).width > maxW) {
        lines.push(buf)
        buf = ch
        if (lines.length === maxLines) break
      } else buf += ch
    }
    if (lines.length < maxLines && buf) lines.push(buf)
  }

  const last = lines.length - 1
  if (last >= 0) {
    const used = lines.join(' ').length
    if (used < text.length) {
      let s = lines[last]
      while (s && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1)
      lines[last] = `${s}…`
    }
  }
  return lines
}

/** Make sure the weights we're about to draw with are actually downloaded —
 *  canvas silently falls back to a system font otherwise. */
async function ensureFonts() {
  if (!document.fonts) return
  try {
    await Promise.all([
      document.fonts.load(`700 78px ${FONT}`),
      document.fonts.load(`500 32px ${FONT}`),
    ])
    await document.fonts.ready
  } catch { /* the card is still drawable without this */ }
}

/**
 * Draw the share card. Returns a PNG File ready for `navigator.share`, or null
 * when the browser can't give us one.
 */
export async function buildShareCard(p: ShareCardInput): Promise<File | null> {
  const name = (p.name ?? '').trim()
  if (!name) return null

  await ensureFonts()
  const img = p.photoUrl ? await loadImage(optimizeImageUrl(p.photoUrl, W) ?? p.photoUrl) : null

  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  if (!ctx) return null

  // ── backdrop ──────────────────────────────────────────────────────────────
  if (img && img.naturalWidth && img.naturalHeight) {
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight)
    const dw = img.naturalWidth * s
    const dh = img.naturalHeight * s
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, p.category?.bg ?? '#EAF1FB')
    g.addColorStop(1, '#0270fb')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  // the text has to stay readable over any photo: a long, eased wash rather
  // than a hard band, plus a light one at the top for the wordmark
  const scrim = ctx.createLinearGradient(0, H * 0.34, 0, H)
  scrim.addColorStop(0, 'rgba(4,16,34,0)')
  scrim.addColorStop(0.45, 'rgba(4,16,34,.55)')
  scrim.addColorStop(0.75, 'rgba(4,16,34,.85)')
  scrim.addColorStop(1, 'rgba(4,16,34,.95)')
  ctx.fillStyle = scrim
  ctx.fillRect(0, H * 0.34, W, H * 0.66)

  const top = ctx.createLinearGradient(0, 0, 0, 260)
  top.addColorStop(0, 'rgba(4,16,34,.5)')
  top.addColorStop(1, 'rgba(4,16,34,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, W, 260)

  // ── wordmark ──────────────────────────────────────────────────────────────
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(255,255,255,.92)'
  ctx.font = `700 34px ${FONT}`
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '10px'
  ctx.fillText('TAURUS', PAD, PAD)
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px'

  // ── the block at the bottom, laid out upwards from the baseline ───────────
  const maxW = W - PAD * 2
  ctx.textBaseline = 'alphabetic'

  const where = [p.city, p.country].map((s) => (s ?? '').trim()).filter(Boolean).join(', ')
  const rated = (p.ratedCount ?? 0) > 0 && (p.rating ?? 0) > 0

  ctx.font = `700 78px ${FONT}`
  const lines = wrap(ctx, name, maxW, 3)

  let y = H - PAD
  if (rated) {
    // one star, not a rounded row of them — "4.6" drawn beside five filled
    // stars reads as five
    ctx.font = `700 38px ${FONT}`
    ctx.fillStyle = '#FFC93C'
    ctx.fillText('★', PAD, y)
    const sw = ctx.measureText('★').width
    ctx.fillStyle = 'rgba(255,255,255,.9)'
    ctx.font = `500 34px ${FONT}`
    ctx.fillText(`${p.rating!.toFixed(1)} · ${p.ratedCount} รีวิว`, PAD + sw + 18, y)
    y -= 62
  }

  if (p.category?.label) {
    ctx.font = `600 30px ${FONT}`
    const label = p.category.label
    const tw = ctx.measureText(label).width
    const h = 54
    const pillY = y - h
    ctx.fillStyle = 'rgba(255,255,255,.95)'
    ctx.beginPath()
    // roundRect is missing on Safari before 16.4 — a square pill beats none
    if (ctx.roundRect) ctx.roundRect(PAD, pillY, tw + 44, h, h / 2)
    else ctx.rect(PAD, pillY, tw + 44, h)
    ctx.fill()
    ctx.fillStyle = p.category.fg
    ctx.textBaseline = 'middle'
    ctx.fillText(label, PAD + 22, pillY + h / 2 + 1)
    ctx.textBaseline = 'alphabetic'
    y = pillY - 34
  }

  ctx.font = `700 78px ${FONT}`
  ctx.fillStyle = '#fff'
  for (let i = lines.length - 1; i >= 0; i--) {
    ctx.fillText(lines[i], PAD, y)
    y -= 92
  }

  if (where) {
    y -= 4
    ctx.font = `500 34px ${FONT}`
    ctx.fillStyle = 'rgba(255,255,255,.8)'
    ctx.fillText(where, PAD, y)
  }

  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png', 0.92))
  if (!blob) return null
  return new File([blob], 'taurus-place.png', { type: 'image/png' })
}
