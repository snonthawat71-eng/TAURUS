// Read-state for Explore notifications, per user, kept on-device. A tapped
// (opened) notification is marked read and disappears from the feeds on the
// next load. IDs are the stable ExploreNotif ids ("c:<id>", "v:<...>", "s:<id>").
const key = (uid: string) => `explore:notifsRead:${uid}`
const MAX = 500 // plenty of history without letting the list grow forever

export function readNotifIds(uid: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key(uid)) ?? '[]') as string[]) } catch { return new Set() }
}

export function markNotifRead(uid: string, id: string) {
  const ids = [...readNotifIds(uid)].filter((x) => x !== id)
  ids.push(id) // newest last
  try { localStorage.setItem(key(uid), JSON.stringify(ids.slice(-MAX))) } catch { /* best-effort */ }
}
