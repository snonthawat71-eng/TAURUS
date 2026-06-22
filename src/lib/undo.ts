import { supabase } from './supabase'
import { toast } from './toast'

// Lightweight undo for deletes. The caller deletes a row, then offers an Undo
// toast that re-inserts the exact row(s) it captured (with their original ids,
// so references like split_user_ids / day_id stay valid). Best-effort: if the
// re-insert fails (e.g. RLS), we surface an error toast.

/** Show an "undo" toast that restores the given table rows on tap, then runs
 *  `after` (typically reload()). `rows` must be the raw table rows that were
 *  just deleted. Multiple tables can be restored (e.g. a day + its stops). */
export function offerUndo(
  message: string,
  rows: { table: string; rows: object[] }[],
  after: () => void | Promise<void>,
) {
  const toRestore = rows.filter((r) => r.rows.length)
  if (!toRestore.length) return
  toast.action(message, {
    label: 'เลิกทำ',
    run: async () => {
      for (const { table, rows: rs } of toRestore) {
        const { error } = await supabase.from(table).insert(rs as Record<string, unknown>[])
        if (error) { toast.error(`กู้คืนไม่สำเร็จ: ${error.message}`); return }
      }
      await after()
    },
  })
}
