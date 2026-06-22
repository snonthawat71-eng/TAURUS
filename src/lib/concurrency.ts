import { supabase } from './supabase'

export interface GuardedResult {
  error: { message: string } | null
  /** True when the row was changed by someone else since it was loaded. */
  conflict: boolean
}

type Row = Record<string, unknown>
type Strip = (payload: Row, msg: string) => Row | null

// Optimistic-concurrency UPDATE. When `expectedVersion` is given we add
// `.eq('version', expectedVersion)` and count affected rows via `.select('id')`:
// zero rows back (with no error) means a teammate edited the row first.
//
// Graceful degradation: if the `version` column doesn't exist yet (the
// concurrency.sql migration hasn't been run), we drop the version filter and
// report no conflict — so the app keeps working before the migration.
export async function updateWithVersion(
  table: string,
  id: string,
  payload: Row,
  expectedVersion: number | undefined,
  strip?: Strip,
): Promise<GuardedResult> {
  const run = (body: Row, useVersion: boolean) => {
    let q = supabase.from(table).update(body).eq('id', id)
    if (useVersion) q = q.eq('version', expectedVersion as number)
    return q.select('id')
  }

  let useVersion = expectedVersion != null
  let res = await run(payload, useVersion)

  // version column not present yet → retry without the guard
  if (res.error && useVersion && res.error.message.includes('version')) {
    useVersion = false
    res = await run(payload, false)
  }
  // unknown optional column → strip it and retry (keeping the version guard)
  if (res.error && strip) {
    const stripped = strip(payload, res.error.message)
    if (stripped) {
      res = await run(stripped, useVersion)
      if (res.error && useVersion && res.error.message.includes('version')) {
        useVersion = false
        res = await run(stripped, false)
      }
    }
  }

  const conflict = !res.error && useVersion && (res.data?.length ?? 0) === 0
  return { error: res.error, conflict }
}
