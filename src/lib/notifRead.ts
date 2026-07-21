// Read-state for Explore notifications. Kept BOTH on the server (notif_state
// table) and in a local cache, and merged on load — so a notification the user
// opened stays opened after re-login or on another device (localStorage alone
// resurfaced them). IDs are the stable ExploreNotif ids ("c:<id>", "v:<...>").
import { supabase } from './supabase'

const readKey = (uid: string) => `explore:notifsRead:${uid}`
const seenKey = (uid: string) => `explore:notifsSeen:${uid}`
const MAX = 500 // plenty of history without letting the list grow forever

export interface NotifState { seenAt: string; readIds: Set<string> }

function localState(uid: string): NotifState {
  let readIds = new Set<string>()
  try { readIds = new Set(JSON.parse(localStorage.getItem(readKey(uid)) ?? '[]') as string[]) } catch { /* corrupt */ }
  let seenAt = ''
  try { seenAt = localStorage.getItem(seenKey(uid)) ?? '' } catch { /* unavailable */ }
  return { seenAt, readIds }
}
function saveLocal(uid: string, s: NotifState) {
  try { localStorage.setItem(readKey(uid), JSON.stringify([...s.readIds].slice(-MAX))) } catch { /* best-effort */ }
  try { if (s.seenAt) localStorage.setItem(seenKey(uid), s.seenAt) } catch { /* best-effort */ }
}
async function upsert(uid: string, s: NotifState) {
  try {
    await supabase.from('notif_state').upsert(
      { user_id: uid, seen_at: s.seenAt || null, read_ids: [...s.readIds].slice(-MAX), updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  } catch { /* table not migrated yet / offline — the local cache still holds it */ }
}

/** Load read-state, MERGING server + on-device (union of read ids, latest seen).
 *  A fresh device/login pulls the server set so opened notifications never come
 *  back; anything read offline is pushed up. Falls back to local on any error
 *  (e.g. notif_state.sql not run yet) so behaviour degrades to the old per-device
 *  one rather than breaking. */
export async function loadNotifState(uid: string): Promise<NotifState> {
  const local = localState(uid)
  try {
    const { data, error } = await supabase.from('notif_state').select('seen_at, read_ids').eq('user_id', uid).maybeSingle()
    if (error) throw error
    const srvRead: string[] = data?.read_ids ?? []
    const srvSeen: string = data?.seen_at ?? ''
    const merged: NotifState = {
      seenAt: srvSeen > local.seenAt ? srvSeen : local.seenAt,
      readIds: new Set<string>([...srvRead, ...local.readIds]),
    }
    saveLocal(uid, merged)
    // keep both sides in sync when the union grew or seen advanced
    if (!data || merged.readIds.size !== srvRead.length || merged.seenAt !== srvSeen) void upsert(uid, merged)
    return merged
  } catch {
    return local
  }
}

/** Mark one notification opened (server + local). Assumes loadNotifState has run
 *  for this user this session, so the local cache already holds the merged union
 *  — the upsert therefore never shrinks the server set. */
export function markNotifRead(uid: string, id: string) {
  const s = localState(uid)
  s.readIds.add(id)
  saveLocal(uid, s)
  void upsert(uid, s)
}

/** Mark the bell "seen" up to `at` (clears the unread badge), server + local. */
export function markSeen(uid: string, at: string) {
  const s = localState(uid)
  if (at > s.seenAt) s.seenAt = at
  saveLocal(uid, s)
  void upsert(uid, s)
}
