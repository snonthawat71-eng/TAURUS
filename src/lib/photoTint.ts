import { optimizeImageUrl } from './cloudinary'

/** Average colour of an image's top strip (× the hero's own darkening) — used
 *  to paint the status-bar zone so a full-bleed photo looks like it runs to the
 *  very top of the screen instead of starting under a white band.
 *  Resolves null when the image can't be read (CORS / load error). */
export function sampleTopColor(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = 8; c.height = 3
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0, img.naturalWidth, Math.max(1, img.naturalHeight * 0.06), 0, 0, 8, 3)
        const d = ctx.getImageData(0, 0, 8, 3).data
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
export function tintChromeFromPhoto(cover: string | null | undefined): () => void {
  if (!cover) return () => {}
  let active = true
  // sample from a tiny optimised copy so it doesn't re-download the full image
  sampleTopColor(optimizeImageUrl(cover, 64) ?? cover).then((col) => {
    if (!active || !col) return
    document.documentElement.style.backgroundColor = col
    document.body.style.backgroundColor = col
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', col)
  })
  return () => { active = false }
}
