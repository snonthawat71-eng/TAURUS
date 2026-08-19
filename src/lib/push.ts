import { supabase } from './supabase'

// Web Push subscription management (client side). The actual reminders are
// sent by /api/send-reminders (a Vercel serverless function deployed with the
// app), triggered every 5 min by Supabase pg_cron. This module only
// registers/stores the device's push subscription + preferred lead time.

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

/** true when the browser subscription was created with the CURRENT VAPID key.
 *  A subscription bound to an old/rotated key can never receive our pushes —
 *  it must be dropped and recreated. */
function matchesCurrentKey(sub: PushSubscription): boolean {
  if (!VAPID_PUBLIC) return false
  const cur = sub.options?.applicationServerKey
  if (!cur) return false
  const a = new Uint8Array(cur)
  const b = urlBase64ToUint8Array(VAPID_PUBLIC)
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/** Get the device's subscription for the current key — silently replacing one
 *  made with an old key (permission already granted, so no prompt). */
async function freshSubscription(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  let sub = await reg.pushManager.getSubscription()
  if (sub && !matchesCurrentKey(sub)) {
    const oldEndpoint = sub.endpoint
    try { await sub.unsubscribe() } catch { /* replaced below anyway */ }
    // remove the dead row so the server stops pushing at a key-mismatched endpoint
    supabase.from('push_subscriptions').delete().eq('endpoint', oldEndpoint).then(() => { /* fire-and-forget */ })
    sub = null
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC!) })
  }
  return sub
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
  const sub = await freshSubscription(reg)
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

// Self-heal: browsers (esp. iOS PWAs after a service-worker update) rotate the
// push endpoint, leaving the DB row pointing at a dead endpoint so reminders
// silently stop. On load, re-upsert the *current* browser subscription so the DB
// always has a live, enabled row. Never re-subscribes when none exists (that
// would resurrect a subscription the user intentionally turned off).
export async function resyncSubscription(): Promise<void> {
  if (!pushSupported || !VAPID_PUBLIC || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) return
    // keep the old lead preference across a key-rotation resubscribe
    const { data } = await supabase.from('push_subscriptions').select('lead_minutes').eq('endpoint', sub.endpoint).maybeSingle()
    sub = await freshSubscription(reg) // replaces an old-key subscription in place
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const json = sub.toJSON()
    await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
      lead_minutes: data?.lead_minutes ?? 30,
      enabled: true,
    }, { onConflict: 'endpoint' })
  } catch { /* best-effort */ }
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
