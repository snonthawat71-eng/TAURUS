import { supabase } from './supabase'
import { toast } from './toast'

// Offline write queue. When an insert/delete is attempted with no connection we
// persist a serializable description in IndexedDB and replay it (FIFO) on
// reconnect. Inserts use client-generated UUIDs so replay is deterministic and
// needs no id remapping. Updates are intentionally NOT queued (they interact
// with the optimistic-lock version guard) — they stay online-only for now.
//
// Limitation: a queued insert isn't visible until reconnect + reload (reads come
// from the network / PWA cache), so we tell the user it was "saved offline".

const DB_NAME = 'taurus-offline'
const STORE = 'ops'

export interface QueuedOp {
  kind: 'insert' | 'delete'
  table: string
  payload?: Record<string, unknown> // insert
  id?: string                       // delete
  /** auth user the op belongs to — ops only replay under the SAME account
   *  (the IndexedDB store is device-wide, not per-login) */
  uid?: string
}
type StoredOp = QueuedOp & { seq: number }

async function currentUid(): Promise<string | undefined> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user?.id
  } catch { return undefined }
}

/** ops the signed-in user may replay: their own + legacy untagged ones */
const opBelongsToUser = (op: QueuedOp, uid: string | undefined) => op.uid == null || op.uid === uid

let dbp: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'seq', autoIncrement: true })
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbp
}

const listeners = new Set<(n: number) => void>()
export function subscribePending(l: (n: number) => void) {
  listeners.add(l)
  pendingCount().then(l)
  return () => { listeners.delete(l) }
}
async function notify() { const n = await pendingCount(); for (const l of listeners) l(n) }

export async function pendingCount(): Promise<number> {
  try {
    const d = await db()
    const uid = await currentUid()
    const ops = await new Promise<StoredOp[]>((res, rej) => {
      const req = d.transaction(STORE, 'readonly').objectStore(STORE).getAll()
      req.onsuccess = () => res(req.result as StoredOp[])
      req.onerror = () => rej(req.error)
    })
    return ops.filter((op) => opBelongsToUser(op, uid)).length
  } catch { return 0 }
}

async function enqueue(op: QueuedOp) {
  const d = await db()
  const uid = await currentUid()
  await new Promise<void>((res, rej) => {
    const req = d.transaction(STORE, 'readwrite').objectStore(STORE).add({ ...op, uid })
    req.onsuccess = () => res()
    req.onerror = () => rej(req.error)
  })
  await notify()
}

function looksOffline(err: unknown): boolean {
  if (!navigator.onLine) return true
  const msg = typeof err === 'string' ? err : ((err as { message?: string })?.message ?? '')
  return /failed to fetch|networkerror|network error|fetch/i.test(msg)
}

const SAVED = 'บันทึกออฟไลน์ไว้แล้ว จะซิงค์เมื่อกลับมาออนไลน์'

/** Run an online write; if it fails because we're offline, queue `op` instead
 *  and return a synthetic success so the UI can proceed. */
export async function runOrQueue<T extends { error: unknown }>(
  online: () => PromiseLike<T>,
  op: QueuedOp,
): Promise<T | { error: null }> {
  const queue = async () => {
    try { await enqueue(op); toast.info(SAVED) }
    catch { toast.error('บันทึกออฟไลน์ไม่สำเร็จ'); }
    return { error: null }
  }
  if (!navigator.onLine) return queue()
  try {
    const res = await online()
    if (res.error && looksOffline(res.error)) return queue()
    return res
  } catch (e) {
    if (looksOffline(e)) return queue()
    throw e
  }
}

function unknownColumn(msg: string): string | null {
  const m = msg.match(/'([^']+)' column/) || msg.match(/column "([^"]+)"/) || msg.match(/Could not find the '([^']+)'/)
  return m ? m[1] : null
}

async function execOp(op: StoredOp): Promise<{ error: { message: string } | null }> {
  if (op.kind === 'delete') return supabase.from(op.table).delete().eq('id', op.id!)
  // insert, stripping any column the server reports as unknown (graceful
  // degradation, same idea as the mutation helpers)
  const body = { ...(op.payload ?? {}) }
  for (let i = 0; i < 8; i++) {
    const res = await supabase.from(op.table).insert(body)
    if (!res.error) return res
    const col = unknownColumn(res.error.message)
    if (col && col in body) { delete body[col]; continue }
    return res
  }
  return { error: { message: 'strip loop exhausted' } }
}

let draining = false
export async function drainQueue(onChanged?: () => void): Promise<void> {
  if (draining || !navigator.onLine) return
  draining = true
  try {
    const d = await db()
    const uid = await currentUid()
    const all: StoredOp[] = await new Promise((res, rej) => {
      const req = d.transaction(STORE, 'readonly').objectStore(STORE).getAll()
      req.onsuccess = () => res(req.result as StoredOp[])
      req.onerror = () => rej(req.error)
    })
    // replay ONLY the signed-in user's ops — anything queued under another
    // account stays put until that account signs back in on this device
    const ops = all.filter((op) => opBelongsToUser(op, uid))
    if (!ops.length) return
    let ok = 0, fail = 0
    for (const op of ops) {
      const res = await execOp(op)
      if (res.error && looksOffline(res.error)) break // went offline again — keep the rest
      // drop the op whether it succeeded or failed permanently (avoid an
      // infinite retry loop on a poison entry)
      await new Promise<void>((r, j) => {
        const req = d.transaction(STORE, 'readwrite').objectStore(STORE).delete(op.seq)
        req.onsuccess = () => r()
        req.onerror = () => j(req.error)
      })
      if (res.error) fail++; else ok++
    }
    await notify()
    if (ok) toast.success(`ซิงค์ข้อมูลออฟไลน์แล้ว ${ok} รายการ`)
    if (fail) toast.error(`ซิงค์ไม่สำเร็จ ${fail} รายการ`)
    if ((ok || fail) && onChanged) onChanged()
  } finally { draining = false }
}

/** Drain now and whenever we come back online. Returns a disposer. */
export function initOfflineSync(onChanged: () => void) {
  const handler = () => { drainQueue(onChanged) }
  window.addEventListener('online', handler)
  drainQueue(onChanged)
  return () => window.removeEventListener('online', handler)
}
