import { mapLinkFor, mapSearchLink } from './maps'
import { buildShareCard, type ShareCardInput } from './shareCard'
import { toast } from './toast'

/** Everything a shared place carries. Only `name` is required — the rest is
 *  dropped from the message when missing. */
export interface SharePlaceInput extends ShareCardInput {
  /** the place's stored map link — the fallback link for a place with no page
   *  of its own here */
  mapUrl?: string | null
  /** a page in this app that shows the place (Explore items have one) */
  appUrl?: string | null
  /** a card drawn ahead of the tap. Safari drops the share gesture across an
   *  await, so pages that can prepare one should — building it inside the
   *  handler works, but can lose the sheet on a slow photo. */
  card?: File | null
}

/** The one link that travels with a shared place: ours when the place has a
 *  page here, the map pin only when it doesn't. Two links in one message read
 *  as spam, and the maps url is the long ugly one. */
export function shareLink(p: SharePlaceInput): string | null {
  return p.appUrl ?? mapLinkFor(p.mapUrl) ?? mapSearchLink(p.name, p.city)
}

/** The words next to the card. Kept to a line or two — the picture says the
 *  rest, and the link sits under it. */
export function sharePlaceText(p: SharePlaceInput): string {
  const where = [p.city, p.country].map((s) => (s ?? '').trim()).filter(Boolean).join(', ')
  return [(p.name ?? '').trim(), where && `📍 ${where}`].filter(Boolean).join('\n')
}

/**
 * Share a place outside the app: the OS share sheet where there is one (every
 * phone), the clipboard everywhere else.
 *
 * A picture of the place goes with it — drawn here, because a static SPA can't
 * give a messaging app anything to preview. When the browser won't take files
 * the message still goes, just without the card.
 */
export async function sharePlace(p: SharePlaceInput): Promise<void> {
  const text = sharePlaceText(p)
  const url = shareLink(p) ?? undefined
  const title = (p.name ?? '').trim() || 'สถานที่'

  if (navigator.share) {
    let file: File | null = p.card ?? null
    if (!file) {
      try { file = await buildShareCard(p) } catch { /* card is a bonus, not the point */ }
    }

    // Two attempts: with the card, then without. A browser can advertise
    // `share` and still reject a payload carrying files.
    for (const payload of [
      file && navigator.canShare?.({ files: [file] }) ? { title, text, url, files: [file] } : null,
      { title, text, url },
    ]) {
      if (!payload) continue
      try {
        await navigator.share(payload)
        return
      } catch (err) {
        // the user backing out of the sheet is not a failure
        if ((err as Error)?.name === 'AbortError') return
      }
    }
  }

  try {
    await navigator.clipboard.writeText([text, url].filter(Boolean).join('\n'))
    toast.success('คัดลอกแล้ว — วางส่งต่อได้เลย')
  } catch {
    toast.error('แชร์ไม่สำเร็จ')
  }
}
