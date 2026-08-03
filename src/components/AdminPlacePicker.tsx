import { useEffect, useMemo, useState } from 'react'
import { IconSearch, IconX, IconCheck, IconMapPin } from '@tabler/icons-react'
import { Drawer } from './Drawer'
import { SignedImage } from './SignedImage'
import { catMeta } from '@/lib/placeMeta'
import { canonicalCountry } from '@/lib/countries'
import type { ExplorePlace } from '@/lib/database.types'

/**
 * Pick places out of the Explore pool for a curated block.
 *
 * Multi-select on purpose: filling a banner is a batch job, and opening a
 * picker ten times to add ten places is the thing that makes a CMS hated. What
 * is already in the block stays ticked and labelled, so the same place can't be
 * added twice.
 */
export function AdminPlacePicker({ open, title, pool, country, chosen, onClose, onDone }: {
  open: boolean
  /** the block being filled, for the header */
  title: string
  /** the whole Explore pool — filtered to `country` here */
  pool: ExplorePlace[]
  country: string
  /** ids already in the block */
  chosen: string[]
  onClose: () => void
  /** the full new list of ids, in order: the ones already there, then the adds */
  onDone: (ids: string[]) => void
}) {
  const [q, setQ] = useState('')
  const [city, setCity] = useState<string | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())

  useEffect(() => { if (open) { setQ(''); setCity(null); setSel(new Set(chosen)) } }, [open, chosen.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const mine = useMemo(
    () => pool.filter((p) => canonicalCountry(p.country) === country),
    [pool, country],
  )
  const cities = useMemo(
    () => [...new Set(mine.map((p) => (p.city ?? '').trim()).filter(Boolean))].sort(),
    [mine],
  )
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return mine
      .filter((p) => !city || (p.city ?? '').trim() === city)
      .filter((p) => !needle || [p.name, p.city, p.note].some((v) => (v ?? '').toLowerCase().includes(needle)))
  }, [mine, city, q])

  const already = new Set(chosen)
  const added = [...sel].filter((id) => !already.has(id)).length
  const removed = chosen.filter((id) => !sel.has(id)).length

  function toggle(id: string) {
    setSel((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** keep the admin's existing order, then append the new picks in list order */
  function done() {
    const kept = chosen.filter((id) => sel.has(id))
    const fresh = shown.map((p) => p.id).filter((id) => sel.has(id) && !already.has(id))
    // anything ticked but filtered out of view still counts
    const rest = [...sel].filter((id) => !kept.includes(id) && !fresh.includes(id))
    onDone([...kept, ...fresh, ...rest])
  }

  return (
    <Drawer open={open} onClose={onClose} title={`เพิ่มสถานที่ — ${title || 'ไม่มีชื่อ'}`}>
      <div className="flex items-center gap-2 rounded-md hairline px-3 h-10 bg-surface mb-3">
        <IconSearch size={16} className="text-ink-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อสถานที่…"
          className="flex-1 bg-transparent text-[13px] outline-none" />
        {q && <button onClick={() => setQ('')} aria-label="ล้าง" className="text-ink-3"><IconX size={15} /></button>}
      </div>

      {cities.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-3">
          <button onClick={() => setCity(null)}
            className={['h-7 px-3 rounded-full text-[11.5px] font-semibold whitespace-nowrap shrink-0 border',
              !city ? 'bg-brand text-white border-brand' : 'bg-surface text-ink-2 border-line-2'].join(' ')}>
            ทุกเมือง
          </button>
          {cities.map((c) => (
            <button key={c} onClick={() => setCity(c === city ? null : c)}
              className={['h-7 px-3 rounded-full text-[11.5px] font-semibold whitespace-nowrap shrink-0 border',
                city === c ? 'bg-brand text-white border-brand' : 'bg-surface text-ink-2 border-line-2'].join(' ')}>
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1">
        {shown.length === 0 ? (
          <div className="card p-6 text-center text-[12px] text-ink-3">ไม่พบสถานที่ที่ตรงกับที่ค้นหา</div>
        ) : shown.map((p) => {
          const on = sel.has(p.id)
          const meta = catMeta(p.category)
          const Icon = meta.icon
          return (
            <button key={p.id} onClick={() => toggle(p.id)}
              className={['w-full flex items-center gap-2.5 p-2 rounded-[10px] text-left border',
                on ? 'bg-brand-soft border-brand/40' : 'border-transparent hover:bg-surface-2/50'].join(' ')}>
              <span className={['size-[19px] rounded-[5px] grid place-items-center shrink-0 border',
                on ? 'bg-brand border-brand text-white' : 'border-line-2'].join(' ')}>
                {on && <IconCheck size={13} />}
              </span>
              <span className="size-11 rounded-[8px] overflow-hidden shrink-0 bg-surface-2 grid place-items-center">
                <SignedImage url={p.photo_url} alt="" className="w-full h-full object-cover" width={120}
                  fallback={<Icon size={18} style={{ color: meta.fg }} />} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold truncate">{p.name}</span>
                <span className="block text-[11px] text-ink-3 truncate">
                  <IconMapPin size={10} className="inline -mt-0.5" /> {p.city || '—'} · {meta.label}
                </span>
              </span>
              {already.has(p.id) && (
                <span className="chip !text-[10px] !py-0.5 shrink-0">อยู่ในลิสต์</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="sticky bottom-0 -mx-1 mt-3 pt-3 pb-1 bg-surface flex items-center gap-2"
        style={{ borderTop: '0.5px solid var(--color-line)' }}>
        <span className="text-[11.5px] text-ink-3">
          เลือกไว้ {sel.size} ที่{added ? ` · เพิ่ม ${added}` : ''}{removed ? ` · เอาออก ${removed}` : ''}
        </span>
        <button onClick={onClose} className="ml-auto h-9 px-4 rounded-md text-[13px] font-medium bg-surface-2 text-ink-2">
          ยกเลิก
        </button>
        <button onClick={done} className="btn-primary h-9 px-4 text-[13px]">บันทึก</button>
      </div>
    </Drawer>
  )
}
