// "ดึงรูปจากลิงก์" — ask the server for the preview images a page publishes
// about itself (og:image and friends), so a place can take its photo from the
// link already pasted into the editor instead of a file from the phone.
//
// Always resolves: a link that publishes no preview image, or a page that
// answers our server with a consent wall (Google does this to datacenter IPs
// often enough to matter), simply yields an empty list and the caller tells
// the user to pick a photo from their device.

const cache = new Map<string, string[]>()

export async function photosFromLink(url: string): Promise<string[]> {
  const u = url.trim()
  if (!/^https?:\/\//i.test(u)) return []
  const hit = cache.get(u)
  if (hit) return hit
  try {
    const res = await fetch(`/api/link-photos?url=${encodeURIComponent(u)}`)
    if (!res.ok) return []
    const data = await res.json() as { photos?: unknown }
    const photos = Array.isArray(data.photos)
      ? data.photos.filter((p): p is string => typeof p === 'string' && /^https?:\/\//i.test(p))
      : []
    cache.set(u, photos)
    return photos
  } catch {
    return []
  }
}
