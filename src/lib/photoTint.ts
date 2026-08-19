import { optimizeImageUrl } from './cloudinary'

/** Colour of the strip a full-bleed photo actually shows at its top edge — used
 *  to paint the status-bar zone so the image looks like it runs to the very top
 *  of the screen instead of starting under a band of another colour.
 *
 *  `boxAspect` is the width/height of the box the photo fills. It matters: the
 *  photo is drawn with `object-fit: cover`, so it is centre-cropped, and the
 *  image's own top row is usually NOT what appears at the top of the box.
 *  Sampling the raw top edge is what made the painted colour sit noticeably
 *  off from the photo. Resolves null when the image can't be read (CORS).
 */
export function sampleTopColor(url: string, boxAspect = 390 / 340): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const iw = img.naturalWidth
        const ih = img.naturalHeight
        if (!iw || !ih) return resolve(null)
        // the part of the source the box actually shows, centre-cropped
        const sw = Math.min(iw, ih * boxAspect)
        const sh = Math.min(ih, iw / boxAspect)
        const sx = (iw - sw) / 2
        const sy = (ih - sh) / 2
        // just the top sliver of that — the pixels touching the status bar
        const band = Math.max(1, sh * 0.045)

        const c = document.createElement('canvas'); c.width = 12; c.height = 3
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, sx, sy, sw, band, 0, 0, 12, 3)
        const d = ctx.getImageData(0, 0, 12, 3).data
        let r = 0, g = 0, b = 0, n = 0
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++ }
        resolve(`rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`)
      } catch { resolve(null) }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** Paint the status-bar zone (and pull-down overscroll) the colour of a photo's
 *  top edge. Call from an effect; the returned function cancels a late sample.
 *  Restoring the normal colour is the route's job — see ProfileChrome. */
export function tintChromeFromPhoto(cover: string | null | undefined, boxAspect?: number): () => void {
  if (!cover) return () => {}
  let active = true
  // a 256px copy: small enough not to cost a real download, wide enough that
  // the centre crop still lands on the right pixels
  sampleTopColor(optimizeImageUrl(cover, 256) ?? cover, boxAspect).then((col) => {
    if (!active || !col) return
    document.documentElement.style.backgroundColor = col
    document.body.style.backgroundColor = col
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', col)
  })
  return () => { active = false }
}
