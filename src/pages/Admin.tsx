import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  IconArrowLeft, IconChevronRight, IconPlus, IconTrash, IconPhoto, IconLoader2,
  IconChevronUp, IconChevronDown, IconEye, IconWorld, IconLayoutList, IconExternalLink,
} from '@tabler/icons-react'
import { SignedImage } from '@/components/SignedImage'
import { AdminPlacePicker } from '@/components/AdminPlacePicker'
import { TaurusLogo } from '@/components/TaurusLogo'
import { useTrip } from '@/contexts/TripContext'
import { useIsAdmin } from '@/lib/useIsAdmin'
import { listExplore } from '@/lib/exploreMutations'
import {
  loadCuratedPage, listCuratedPages, upsertCountryPage, addBlock, updateBlock,
  deleteBlock, reorderBlocks, setBlockPlaces, type BlockWithPlaces,
} from '@/lib/countryPages'
import { canonicalCountry, countryFlag } from '@/lib/countries'
import { slugForCountry, countryForSlug } from '@/lib/exploreTop'
import { uploadPublicImage } from '@/lib/files'
import { catMeta, PLACE_TABS, FOOD_GROUPS } from '@/lib/placeMeta'
import { confirmDialog } from '@/lib/confirm'
import { toast } from '@/lib/toast'
import type { CountryPage, ExplorePlace } from '@/lib/database.types'

/**
 * The owner's dashboard for the curated country pages.
 *
 * Kept apart from the app proper: it has its own shell, its own route, and it
 * never appears in any nav. Non-admins are bounced — and even if one forced the
 * route, every write here is refused by row-level security.
 *
 * The editing model is deliberately blog-like: a cover, then a stack of banner
 * blocks you add, name, illustrate, fill and reorder. Nothing here is ranked or
 * computed; a country nobody has touched keeps the automatic page.
 */
export default function Admin() {
  const { key } = useParams()
  const navigate = useNavigate()
  const { loading, profile } = useTrip()
  const isAdmin = useIsAdmin()

  const [pool, setPool] = useState<ExplorePlace[] | null>(null)
  const [pages, setPages] = useState<CountryPage[]>([])

  useEffect(() => {
    if (!isAdmin) return
    void (async () => {
      const [res, ps] = await Promise.all([listExplore(), listCuratedPages()])
      setPool((res.data ?? []) as ExplorePlace[])
      setPages(ps)
    })()
  }, [isAdmin])

  // every country the pool knows about, plus any page already created
  const countries = useMemo(() => {
    const set = new Set<string>()
    for (const p of pool ?? []) {
      const c = canonicalCountry(p.country)
      if (c) set.add(c)
    }
    for (const p of pages) set.add(p.country)
    return [...set].sort()
  }, [pool, pages])

  // the profile has to have loaded before we can know — bouncing on a null
  // profile would throw the admin out of their own dashboard on every refresh
  if (loading || (!profile && !isAdmin)) {
    return <div className="min-h-dvh grid place-items-center bg-canvas text-[13px] text-ink-3">กำลังโหลด…</div>
  }
  if (!isAdmin) return <Navigate to="/" replace />

  // resolve against the countries we actually have, so one the app doesn't
  // know by name still opens
  const selected = key ? countryForSlug(key, countries) : null

  return (
    <div className="min-h-dvh bg-canvas md:flex">
      {/* country rail — a full page on mobile, a sidebar on desktop */}
      <aside className={['md:w-[236px] md:shrink-0 md:h-dvh md:sticky md:top-0 bg-surface',
        selected ? 'max-md:hidden' : ''].join(' ')}
        style={{ borderRight: '0.5px solid var(--color-line)' }}>
        <div className="flex items-center gap-2 h-14 px-4">
          <TaurusLogo height={30} />
          <span className="text-[9px] font-extrabold tracking-widest bg-ink text-white rounded px-1.5 py-1">ADMIN</span>
          <button onClick={() => navigate('/')} className="ml-auto text-[12px] text-ink-3">ออก</button>
        </div>
        <nav className="px-2.5 pb-6">
          <div className="px-2 pt-3 pb-1.5 text-[10px] font-semibold tracking-wider text-ink-3">หน้าประเทศ</div>
          {countries.length === 0 && (
            <div className="px-2 py-3 text-[12px] text-ink-3">
              {pool ? 'ยังไม่มีสถานที่ในคลัง' : 'กำลังโหลด…'}
            </div>
          )}
          {countries.map((c) => {
            const page = pages.find((p) => p.country === c)
            return (
              <button key={c} onClick={() => navigate(`/admin/${slugForCountry(c)}`)}
                className={['w-full flex items-center gap-2.5 h-10 px-2.5 rounded-md text-[13px] mb-0.5',
                  selected === c ? 'bg-brand-soft text-brand-dark font-semibold' : 'text-ink-2 hover:bg-surface-2/60'].join(' ')}>
                <span className="text-[15px]">{countryFlag(c)}</span>
                <span className="flex-1 text-left truncate">{c}</span>
                <span className="size-[7px] rounded-full shrink-0"
                  style={{ background: page?.published ? '#22c55e' : page ? '#f59e0b' : 'var(--color-line-2)' }} />
              </button>
            )
          })}
        </nav>
      </aside>

      <main className={['flex-1 min-w-0', selected ? '' : 'max-md:hidden'].join(' ')}>
        {selected
          ? <CountryEditor key={selected} country={selected} pool={pool ?? []}
              onPageSaved={(p) => setPages((xs) => [...xs.filter((x) => x.country !== p.country), p])} />
          : <div className="hidden md:grid place-items-center h-dvh text-[13px] text-ink-3">
              เลือกประเทศทางซ้ายเพื่อเริ่มจัดหน้า
            </div>}
      </main>
    </div>
  )
}

/** The page builder for one country. */
function CountryEditor({ country, pool, onPageSaved }: {
  country: string
  pool: ExplorePlace[]
  onPageSaved: (p: CountryPage) => void
}) {
  const navigate = useNavigate()
  const [page, setPage] = useState<CountryPage | null>(null)
  const [blocks, setBlocks] = useState<BlockWithPlaces[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState<BlockWithPlaces | null>(null)

  const byId = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool])

  async function refresh() {
    setLoading(true)
    const res = await loadCuratedPage(country)
    setPage(res?.page ?? null)
    setBlocks(res?.blocks ?? [])
    setLoading(false)
  }
  useEffect(() => { void refresh() }, [country]) // eslint-disable-line react-hooks/exhaustive-deps

  async function savePage(fields: Partial<CountryPage>) {
    const next = { country, ...page, ...fields } as CountryPage
    setPage(next)
    setBusy(true)
    const { error } = await upsertCountryPage({ ...fields, country })
    setBusy(false)
    if (error) { toast.error(`บันทึกไม่สำเร็จ: ${error.message}`); void refresh(); return }
    onPageSaved(next)
  }

  async function createPage() {
    setBusy(true)
    const { error } = await upsertCountryPage({ country, published: false, show_recent: true, show_cities: true })
    setBusy(false)
    if (error) { toast.error(`สร้างหน้าไม่สำเร็จ: ${error.message}`); return }
    await refresh()
    toast.success('สร้างหน้าแล้ว — ยังเป็นร่าง ผู้ใช้ยังไม่เห็น')
  }

  async function onAddBlock() {
    setBusy(true)
    const { data, error } = await addBlock(country, blocks.length)
    setBusy(false)
    if (error || !data) { toast.error(`เพิ่มการ์ดไม่สำเร็จ: ${error?.message ?? ''}`); return }
    setBlocks((xs) => [...xs, { ...data, placeIds: [] }])
  }

  async function patchBlock(id: string, fields: Partial<BlockWithPlaces>) {
    setBlocks((xs) => xs.map((b) => (b.id === id ? { ...b, ...fields } : b)))
    const { placeIds, ...rest } = fields as Partial<BlockWithPlaces> & { placeIds?: string[] }
    if (Object.keys(rest).length) {
      const { error } = await updateBlock(id, rest)
      if (error) { toast.error(`บันทึกไม่สำเร็จ: ${error.message}`); void refresh(); return }
    }
    if (placeIds) {
      const { error } = await setBlockPlaces(id, placeIds)
      if (error) { toast.error(`บันทึกรายการไม่สำเร็จ: ${error.message}`); void refresh() }
    }
  }

  async function removeBlock(b: BlockWithPlaces) {
    if (!(await confirmDialog({
      message: `ลบการ์ด "${b.title || 'ไม่มีชื่อ'}" ? สถานที่ในคลังไม่ถูกลบ`,
      danger: true, confirmLabel: 'ลบการ์ด',
    }))) return
    setBlocks((xs) => xs.filter((x) => x.id !== b.id))
    const { error } = await deleteBlock(b.id)
    if (error) { toast.error(`ลบไม่สำเร็จ: ${error.message}`); void refresh() }
  }

  async function move(i: number, d: number) {
    const j = i + d
    if (j < 0 || j >= blocks.length) return
    const next = [...blocks]
    ;[next[i], next[j]] = [next[j], next[i]]
    setBlocks(next.map((b, n) => ({ ...b, position: n })))
    await reorderBlocks(next.map((b) => b.id))
  }

  async function savePlaces(block: BlockWithPlaces, ids: string[]) {
    setBlocks((xs) => xs.map((b) => (b.id === block.id ? { ...b, placeIds: ids } : b)))
    setPicking(null)
    const { error } = await setBlockPlaces(block.id, ids)
    if (error) { toast.error(`บันทึกรายการไม่สำเร็จ: ${error.message}`); void refresh() }
  }

  if (loading) return <div className="grid place-items-center h-dvh text-[13px] text-ink-3">กำลังโหลด…</div>

  return (
    <>
      <header className="sticky top-0 z-20 h-14 flex items-center gap-2.5 px-4 bg-surface"
        style={{ borderBottom: '0.5px solid var(--color-line)' }}>
        <button onClick={() => navigate('/admin')} aria-label="กลับ" className="btn-icon !size-8 md:hidden">
          <IconArrowLeft size={17} />
        </button>
        <span className="text-[15px] font-extrabold truncate">{countryFlag(country)} {country}</span>
        {page && (
          <span className="chip !text-[10.5px] shrink-0"
            style={page.published
              ? { background: '#ECFDF3', color: '#15803D' }
              : { background: '#FFF7ED', color: '#B45309' }}>
            {page.published ? 'เผยแพร่แล้ว' : 'ร่าง'}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {busy && <IconLoader2 size={15} className="animate-spin text-ink-3" />}
          {page && (
            <>
              <button onClick={() => navigate(`/explore/top/${slugForCountry(country)}`)}
                className="btn-icon !w-auto px-3 gap-1.5 !h-9 text-[12px]"><IconEye size={15} /> ดูหน้าจริง</button>
              <button onClick={() => void savePage({ published: !page.published })}
                className={page.published ? 'btn-icon !w-auto px-3 !h-9 text-[12px]' : 'btn-primary h-9 px-4 text-[12.5px]'}>
                {page.published ? 'ยกเลิกเผยแพร่' : 'เผยแพร่'}
              </button>
            </>
          )}
        </span>
      </header>

      <div className="p-4 sm:p-5 max-w-[860px] mx-auto pb-16">
        {!page ? (
          <div className="card p-8 text-center">
            <IconWorld size={26} className="mx-auto text-ink-3" />
            <p className="text-[14px] font-semibold mt-3">ยังไม่ได้จัดหน้าของ {country}</p>
            <p className="text-[12px] text-ink-2 mt-1.5 leading-relaxed">
              ตอนนี้ผู้ใช้เห็นหน้าที่ระบบจัดอันดับให้อัตโนมัติ<br />สร้างหน้าแล้วค่อยๆ ใส่การ์ดได้ ระหว่างนั้นยังเป็นร่าง ผู้ใช้ยังไม่เห็น
            </p>
            <button onClick={() => void createPage()} className="btn-primary h-10 px-5 mt-4 text-[13px]">
              สร้างหน้าของ {country}
            </button>
          </div>
        ) : (
          <>
            {/* ── cover ── */}
            <Section title="ปกประเทศ" hint="รูปใหญ่บนสุดของหน้า">
              <ImageField url={page.cover_url} ratio="16 / 6"
                onChange={(url) => void savePage({ cover_url: url })} />
              <div className="grid sm:grid-cols-2 gap-2.5 mt-3">
                <Field label="หัวข้อ" value={page.title ?? ''} placeholder={`สถานที่ยอดฮิต ${country}`}
                  onSave={(v) => void savePage({ title: v || null })} />
                <Field label="บรรทัดเล็ก" value={page.eyebrow ?? ''} placeholder={`${countryFlag(country)} ${country}`}
                  onSave={(v) => void savePage({ eyebrow: v || null })} />
              </div>
            </Section>

            {/* ── blocks ── */}
            <Section title="การ์ดหมวด" hint="แต่ละใบคือแบนเนอร์ 1 อัน">
              {blocks.length === 0 && (
                <p className="text-[12px] text-ink-3 mb-3">
                  ยังไม่มีการ์ด — ระหว่างนี้หน้าประเทศจะโชว์การ์ดที่ระบบจัดอันดับให้เองไปก่อน
                </p>
              )}
              <div className="space-y-2.5">
                {blocks.map((b, i) => (
                  <BlockCard key={b.id} block={b} index={i} total={blocks.length} byId={byId}
                    onPatch={(f) => void patchBlock(b.id, f)}
                    onMove={(d) => void move(i, d)}
                    onRemove={() => void removeBlock(b)}
                    onPick={() => setPicking(b)} />
                ))}
              </div>
              <button onClick={() => void onAddBlock()}
                className="w-full h-11 mt-2.5 rounded-[11px] text-[13px] font-semibold text-brand inline-flex items-center justify-center gap-1.5"
                style={{ border: '1px dashed var(--color-line-2)' }}>
                <IconPlus size={16} /> เพิ่มการ์ดหมวด
              </button>
            </Section>

            {/* ── automatic rails ── */}
            <Section title="แถวอัตโนมัติ" hint="ระบบเติมให้เอง ไม่ต้องจัดการ">
              <Toggle label="เพิ่งเพิ่มล่าสุด" sub="ดึงจากที่ผู้ใช้เพิ่มเข้าคลัง 10 อันล่าสุด"
                on={page.show_recent} onChange={(v) => void savePage({ show_recent: v })} />
              <div className="h-2" />
              <Toggle label="แยกตามเมือง" sub="เมืองละ 1 แถว · ซ่อนเองถ้าประเทศนี้มีเมืองเดียว"
                on={page.show_cities} onChange={(v) => void savePage({ show_cities: v })} />
            </Section>
          </>
        )}
      </div>

      <AdminPlacePicker open={!!picking} title={picking?.title ?? ''} pool={pool} country={country}
        chosen={picking?.placeIds ?? []}
        onClose={() => setPicking(null)}
        onDone={(ids) => picking && void savePlaces(picking, ids)} />
    </>
  )
}

// ── small pieces ────────────────────────────────────────────────────────────

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card mb-3.5 overflow-hidden">
      <div className="flex items-baseline gap-2.5 px-4 py-3" style={{ borderBottom: '0.5px solid var(--color-line)' }}>
        <h2 className="text-[13.5px] font-extrabold">{title}</h2>
        {hint && <span className="text-[11.5px] text-ink-3">{hint}</span>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

/** A text input that writes on blur — no save button, no lost keystrokes. */
function Field({ label, value, placeholder, onSave }: {
  label: string
  value: string
  placeholder?: string
  onSave: (v: string) => void
}) {
  const [v, setV] = useState(value)
  useEffect(() => { setV(value) }, [value])
  return (
    <label className="block">
      <span className="block text-[11px] text-ink-3 mb-1">{label}</span>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder}
        onBlur={() => { if (v !== value) onSave(v.trim()) }}
        className="w-full h-9 rounded-md px-2.5 text-[13px] bg-surface hairline outline-none focus:border-brand" />
    </label>
  )
}

/** Upload / replace / clear one image. */
function ImageField({ url, ratio, onChange }: {
  url: string | null
  ratio: string
  onChange: (url: string | null) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    const { url: up } = await uploadPublicImage(file, 'banner')
    setBusy(false)
    if (up) onChange(up)
  }

  return (
    <div className="relative rounded-[11px] overflow-hidden bg-surface-2" style={{ aspectRatio: ratio }}>
      {url
        ? <SignedImage url={url} alt="" className="w-full h-full object-cover" width={900} />
        : <span className="w-full h-full grid place-items-center text-ink-3">
            <IconPhoto size={26} />
          </span>}
      <input ref={input} type="file" accept="image/*" className="hidden"
        onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
      <div className="absolute top-2 right-2 flex gap-1.5">
        {url && (
          <button onClick={() => onChange(null)}
            className="h-7 px-2.5 rounded-full text-[11px] font-bold bg-white/[.92] text-[#D85A30]">ลบรูป</button>
        )}
        <button onClick={() => input.current?.click()} disabled={busy}
          className="h-7 px-3 rounded-full text-[11px] font-bold bg-white/[.92] text-ink-2 inline-flex items-center gap-1">
          {busy ? <IconLoader2 size={12} className="animate-spin" /> : null}
          {url ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
        </button>
      </div>
    </div>
  )
}

function Toggle({ label, sub, on, onChange }: {
  label: string; sub?: string; on: boolean; onChange: (v: boolean) => void
}) {
  return (
    <button onClick={() => onChange(!on)}
      className="w-full flex items-center gap-3 p-3 rounded-[11px] text-left bg-surface-2/60"
      style={{ border: '1px dashed var(--color-line-2)' }}>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">{label}</span>
        {sub && <span className="block text-[11px] text-ink-3 mt-0.5">{sub}</span>}
      </span>
      <span className="w-[34px] h-5 rounded-full relative shrink-0 transition-colors"
        style={{ background: on ? 'var(--color-brand)' : 'var(--color-line-2)' }}>
        <span className="absolute top-[2px] size-4 rounded-full bg-white transition-all"
          style={on ? { right: 2 } : { left: 2 }} />
      </span>
    </button>
  )
}

/** Category options for a block that jumps to Explore. */
const FILTER_OPTS: { key: string; label: string; group: string | null; cat: string | null }[] = [
  { key: 'all', label: 'ทุกหมวด', group: null, cat: null },
  { key: 'place', label: 'สถานที่ทั้งหมด', group: 'place', cat: null },
  ...PLACE_TABS.filter((t) => t.key !== 'all').map((t) => ({ key: `place:${t.key}`, label: t.label, group: 'place', cat: t.key })),
  { key: 'food', label: 'ร้านอาหาร/คาเฟ่ทั้งหมด', group: 'food', cat: null },
  ...FOOD_GROUPS.flatMap((g) => g.cats).map((c) => ({ key: `food:${c}`, label: catMeta(c).label, group: 'food', cat: c })),
]

function BlockCard({ block: b, index, total, byId, onPatch, onMove, onRemove, onPick }: {
  block: BlockWithPlaces
  index: number
  total: number
  byId: Map<string, ExplorePlace>
  onPatch: (f: Partial<BlockWithPlaces>) => void
  onMove: (d: number) => void
  onRemove: () => void
  onPick: () => void
}) {
  const [open, setOpen] = useState(false)
  const filterKey = b.action === 'explore'
    ? (b.filter_group ? (b.filter_cat ? `${b.filter_group}:${b.filter_cat}` : b.filter_group) : 'all')
    : 'all'

  return (
    <div className="rounded-[12px] overflow-hidden" style={{ border: '0.5px solid var(--color-line)' }}>
      <div className="flex items-center gap-2.5 p-2.5 bg-surface">
        <div className="flex flex-col">
          <button onClick={() => onMove(-1)} disabled={index === 0} aria-label="เลื่อนขึ้น"
            className="text-ink-3 disabled:opacity-25"><IconChevronUp size={15} /></button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} aria-label="เลื่อนลง"
            className="text-ink-3 disabled:opacity-25"><IconChevronDown size={15} /></button>
        </div>
        <span className="w-[74px] h-[38px] rounded-[7px] overflow-hidden shrink-0 bg-surface-2 grid place-items-center">
          <SignedImage url={b.image_url} alt="" className="w-full h-full object-cover" width={200}
            fallback={<IconPhoto size={15} className="text-ink-3" />} />
        </span>
        <button onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left">
          <span className="block text-[13.5px] font-bold truncate">{b.title || 'การ์ดใหม่'}</span>
          <span className="block text-[11px] text-ink-3 truncate mt-0.5">
            {b.action === 'list' ? `แสดงลิสต์ในหน้านี้ · ${b.placeIds.length} สถานที่` : 'ไปหน้า Explore พร้อมกรอง'}
          </span>
        </button>
        <button onClick={() => onPatch({ published: !b.published })} aria-label="เปิด/ปิดการ์ด"
          className="w-[34px] h-5 rounded-full relative shrink-0 transition-colors"
          style={{ background: b.published ? 'var(--color-brand)' : 'var(--color-line-2)' }}>
          <span className="absolute top-[2px] size-4 rounded-full bg-white transition-all"
            style={b.published ? { right: 2 } : { left: 2 }} />
        </button>
        <button onClick={() => setOpen((o) => !o)} aria-label="แก้ไข" className="text-ink-3 shrink-0">
          <IconChevronRight size={16} className={open ? 'rotate-90 transition-transform' : 'transition-transform'} />
        </button>
      </div>

      {open && (
        <div className="p-3 space-y-3" style={{ borderTop: '0.5px solid var(--color-line)', background: 'var(--color-surface-2)' }}>
          <ImageField url={b.image_url} ratio="358 / 168" onChange={(url) => onPatch({ image_url: url })} />
          <Field label="ชื่อบนการ์ด (เว้นว่างถ้ารูปมีตัวหนังสืออยู่แล้ว)" value={b.title}
            placeholder="เช่น landmark เด็ดฮ่องกง" onSave={(v) => onPatch({ title: v })} />

          <div>
            <span className="block text-[11px] text-ink-3 mb-1.5">กดการ์ดแล้ว</span>
            <div className="flex gap-1.5">
              <button onClick={() => onPatch({ action: 'list' })}
                className={['flex-1 h-9 rounded-md text-[12.5px] font-semibold inline-flex items-center justify-center gap-1.5 border',
                  b.action === 'list' ? 'bg-brand text-white border-brand' : 'bg-surface text-ink-2 border-line-2'].join(' ')}>
                <IconLayoutList size={14} /> แสดงลิสต์ในหน้านี้
              </button>
              <button onClick={() => onPatch({ action: 'explore' })}
                className={['flex-1 h-9 rounded-md text-[12.5px] font-semibold inline-flex items-center justify-center gap-1.5 border',
                  b.action === 'explore' ? 'bg-brand text-white border-brand' : 'bg-surface text-ink-2 border-line-2'].join(' ')}>
                <IconExternalLink size={14} /> ไปหน้า Explore
              </button>
            </div>
          </div>

          {b.action === 'explore' ? (
            <label className="block">
              <span className="block text-[11px] text-ink-3 mb-1">กรองด้วยหมวด</span>
              <select value={filterKey}
                onChange={(e) => {
                  const o = FILTER_OPTS.find((x) => x.key === e.target.value)
                  onPatch({ filter_group: o?.group ?? null, filter_cat: o?.cat ?? null })
                }}
                className="w-full h-9 rounded-md px-2 text-[13px] bg-surface hairline outline-none">
                {FILTER_OPTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </label>
          ) : (
            <div>
              <div className="flex items-center mb-1.5">
                <span className="text-[11px] text-ink-3">สถานที่ในการ์ด ({b.placeIds.length})</span>
                <button onClick={onRemove} className="ml-auto text-[11.5px] font-semibold text-[#D85A30] inline-flex items-center gap-1">
                  <IconTrash size={13} /> ลบการ์ดนี้
                </button>
              </div>
              <div className="space-y-1.5">
                {b.placeIds.map((id, n) => {
                  const p = byId.get(id)
                  return (
                    <div key={id} className="flex items-center gap-2.5 p-2 rounded-[9px] bg-surface hairline">
                      <span className="w-4 text-center text-[11px] font-bold text-ink-3 shrink-0">{n + 1}</span>
                      <span className="size-[34px] rounded-[6px] overflow-hidden shrink-0 bg-surface-2 grid place-items-center">
                        <SignedImage url={p?.photo_url} alt="" className="w-full h-full object-cover" width={100}
                          fallback={<IconPhoto size={13} className="text-ink-3" />} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-semibold truncate">{p?.name ?? 'สถานที่ถูกลบไปแล้ว'}</span>
                        <span className="block text-[10.5px] text-ink-3 truncate">{p ? `${p.city || '—'} · ${catMeta(p.category).label}` : '—'}</span>
                      </span>
                      <button onClick={() => onPatch({ placeIds: b.placeIds.filter((x) => x !== id) })}
                        className="text-[11.5px] font-semibold text-[#D85A30] shrink-0">เอาออก</button>
                    </div>
                  )
                })}
              </div>
              <button onClick={onPick}
                className="w-full h-9 mt-2 rounded-[9px] text-[12.5px] font-semibold text-brand"
                style={{ border: '1px dashed var(--color-line-2)' }}>
                ＋ เพิ่มสถานที่จากคลัง
              </button>
            </div>
          )}

          {b.action === 'explore' && (
            <button onClick={onRemove} className="text-[11.5px] font-semibold text-[#D85A30] inline-flex items-center gap-1">
              <IconTrash size={13} /> ลบการ์ดนี้
            </button>
          )}
        </div>
      )}
    </div>
  )
}
