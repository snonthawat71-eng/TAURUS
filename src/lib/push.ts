import { supabase } from './supabase'

// Web Push subscription management (client side). The actual reminders are sent
// by the `send-due-reminders` Supabase Edge Function on a schedule — see
// supabase/PUSH_SETUP.md. This module only registers/stores the device's push
// subscription + the user's preferred lead time.

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export const pushSupported =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export interface PushState {
  supported: boolean
  configured: boolean // VAPID public key present
  permission: NotificationPermission
  subscribed: boolean
  leadMinutes: number
}

export async function getPushState(): Promise<PushState> {
  const base: PushState = {
    supported: pushSupported,
    configured: !!VAPID_PUBLIC,
    permission: pushSupported ? Notification.permission : 'denied',
    subscribed: false,
    leadMinutes: 30,
  }
  if (!pushSupported) return base
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return base
    const { data } = await supabase.from('push_subscriptions').select('lead_minutes').eq('endpoint', sub.endpoint).maybeSingle()
    return { ...base, subscribed: true, leadMinutes: data?.lead_minutes ?? 30 }
  } catch { return base }
}

export async function enablePush(leadMinutes: number): Promise<{ error: string | null }> {
  if (!pushSupported) return { error: 'อุปกรณ์/เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน (iOS ต้องเพิ่มลงหน้าโฮมก่อน)' }
  if (!VAPID_PUBLIC) return { error: 'ยังไม่ได้ตั้งค่า VAPID key บนเซิร์ฟเวอร์' }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { error: 'ไม่ได้อนุญาตการแจ้งเตือน' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'ยังไม่ได้เข้าสู่ระบบ' }
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) })
  }
  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
    lead_minutes: leadMinutes,
    enabled: true,
  }, { onConflict: 'endpoint' })
  return { error: error?.message ?? null }
}

export async function setLead(leadMinutes: number): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').update({ lead_minutes: leadMinutes }).eq('endpoint', sub.endpoint)
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
