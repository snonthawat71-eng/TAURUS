import { useEffect, useState } from 'react'
import { getExploreNotifs } from './exploreMutations'
import { loadNotifState } from './notifRead'
import { supabase, isSupabaseConfigured } from './supabase'

/** true when the user has Explore notifications they haven't opened yet —
 *  drives the red dot on profile entry points. Live-updates via realtime. */
export function useUnreadNotifs(userId?: string | null): boolean {
  const [has, setHas] = useState(false)
  useEffect(() => {
    if (!userId) { setHas(false); return }
    let active = true
    const load = async () => {
      const [l, state] = await Promise.all([getExploreNotifs(userId), loadNotifState(userId)])
      if (active) setHas(l.some((n) => !state.readIds.has(n.id)))
    }
    load()
    if (!isSupabaseConfigured) return () => { active = false }
    let t: ReturnType<typeof setTimeout>
    const bump = () => { clearTimeout(t); t = setTimeout(load, 500) }
    const ch = supabase.channel(`unread-notifs-${userId}`)
    for (const table of ['explore_votes', 'explore_comments', 'explore_suggestions']) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, bump)
    }
    ch.subscribe()
    return () => { active = false; clearTimeout(t); supabase.removeChannel(ch) }
  }, [userId])
  return has
}
