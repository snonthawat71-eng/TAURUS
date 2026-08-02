import { mapLinkFor, mapSearchLink } from './maps'
import { toast } from './toast'

/** Everything a shared place carries. Only `name` is required — the rest is
 *  dropped from the message when missing. */
export interface SharePlaceInput {
  name: string | null | undefined
  city?: string | null
  country?: string | null
  /** the place's stored map link, if it has one */
  mapUrl?: string | null
  /** a page in this app that shows the place (Explore items have one) */
  appUrl?: string | null
}

/** The message we hand to whatever the user shares into. Plain text on purpose:
 *  it has to survive LINE, Messages and a paste into a note equally well. */
export function sharePlaceText(p: SharePlaceInput): string {
  const where = [p.city, p.country].map((s) => (s ?? '').trim()).filter(Boolean).join(', ')
  const map = mapLinkFor(p.mapUrl) ?? mapSearchLink(p.name, p.city)
  return [
    (p.name ?? '').trim(),
    where && `📍 ${where}`,
    map,
    p.appUrl,
  ].filter(Boolean).join('\n')
}

/**
 * Share a place outside the app: the OS share sheet where there is one (every
 * phone), the clipboard everywhere else (most desktop browsers).
 *
 * The map link goes in the text rather than as the shared `url` so the person
 * receiving it can open the pin without having an account here — the app link
 * rides along for the people who do.
 */
export async function sharePlace(p: SharePlaceInput): Promise<void> {
  const text = sharePlaceText(p)
  const title = (p.name ?? '').trim() || 'สถานที่'

  if (navigator.share) {
    try {
      // `url` is what iOS shows as the rich preview; without one it shares the
      // text alone, which is what we want for a place that has no page here.
      await navigator.share(p.appUrl ? { title, text, url: p.appUrl } : { title, text })
      return
    } catch (err) {
      // the user backing out of the sheet is not a failure
      if ((err as Error)?.name === 'AbortError') return
      // anything else (permission, unsupported payload) → fall through to copy
    }
  }

  try {
    await navigator.clipboard.writeText(text)
    toast.success('คัดลอกแล้ว — วางส่งต่อได้เลย')
  } catch {
    toast.error('แชร์ไม่สำเร็จ')
  }
}
