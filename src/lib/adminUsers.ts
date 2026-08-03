// Granting and revoking admin from inside the app.
//
// Both calls go through SECURITY DEFINER functions that check `is_admin()`
// server-side (supabase/admin_pages.sql): emails live in auth.users, which the
// client can't read, and copying them into `profiles` would expose everyone's
// address to every signed-in user.
import { supabase } from './supabase'

export interface AdminUser {
  id: string
  email: string | null
  nickname: string | null
  is_admin: boolean
}

/** Everyone with a profile — admins first. Empty for non-admins, and for a
 *  database that hasn't had the migration run yet. */
export async function listAdminUsers(): Promise<{ rows: AdminUser[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_list_users')
  if (error) {
    const missing = /does not exist|schema cache/i.test(error.message)
    return { rows: [], error: missing ? 'ยังไม่ได้รัน SQL ของระบบผู้ดูแล' : error.message }
  }
  return { rows: (data ?? []) as AdminUser[], error: null }
}

export async function setAdmin(target: string, value: boolean): Promise<string | null> {
  const { error } = await supabase.rpc('admin_set_admin', { target, value })
  return error?.message ?? null
}
