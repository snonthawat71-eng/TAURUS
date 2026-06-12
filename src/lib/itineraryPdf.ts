import { supabase } from './supabase'
import { formatLongDate, formatDateRange } from './format'
import type { ItineraryDay, ItineraryStop, Transit, Trip } from './database.types'

function esc(s: string | null | undefined) {
  return (s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}

function transitHtml(t: Transit | null): string {
  if (!t?.legs?.length) return ''
  const legs = t.legs.map((l) => {
    const meta = [l.direction, l.stops != null ? `${l.stops} สถานี` : '', l.minutes != null ? `${l.minutes} นาที` : ''].filter(Boolean).join(' · ')
    return `<div class="leg"><span class="line" style="background:${l.color}">${esc(l.line)}</span> ${esc(l.from)} → ${esc(l.to)} <span class="muted">${esc(meta)}</span></div>`
  }).join('')
  const exit = t.exit ? `<div class="leg exit">ออก ${esc(t.exit.label)}${t.exit.note ? ` · ${esc(t.exit.note)}` : ''}</div>` : ''
  return `<div class="transit">${legs}${exit}</div>`
}

/** Build a printable itinerary and open the browser print dialog (Save as PDF). */
export async function downloadItineraryPdf(trip: Trip) {
  const [daysRes, stopsRes] = await Promise.all([
    supabase.from('itinerary_days').select('*').eq('trip_id', trip.id).order('position'),
    supabase.from('itinerary_stops').select('*').eq('trip_id', trip.id).order('position'),
  ])
  const days = (daysRes.data ?? []) as ItineraryDay[]
  const stops = (stopsRes.data ?? []) as ItineraryStop[]

  const body = days.map((d, i) => {
    const list = stops.filter((s) => s.day_id === d.id).sort((a, b) => a.position - b.position)
    const rows = list.map((s) => `
      <div class="stop">
        <div class="time">${esc(s.time)}</div>
        <div class="body">
          <div class="place">${esc(s.place_name)}</div>
          ${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}
          ${transitHtml(s.transit)}
        </div>
      </div>`).join('')
    return `<section class="day">
      <div class="dayhead"><span class="badge">Day ${i + 1}</span> <span>${esc(formatLongDate(d.day_date))}</span>${d.label ? ` <span class="muted">· ${esc(d.label)}</span>` : ''}</div>
      ${rows || '<div class="muted empty">ไม่มีจุดแวะ</div>'}
    </section>`
  }).join('')

  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8">
  <title>${esc(trip.name)} — Itinerary</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Noto+Sans+Thai:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Inter','Noto Sans Thai',sans-serif; color:#0c1b2a; margin:0; padding:32px; font-size:13px; }
    .brand { display:flex; align-items:center; gap:8px; color:#0270fb; font-weight:500; letter-spacing:.08em; }
    h1 { font-size:20px; font-weight:500; margin:10px 0 2px; }
    .sub { color:#8893a4; font-size:12px; margin-bottom:20px; }
    .day { margin-bottom:22px; break-inside:avoid; }
    .dayhead { font-weight:500; padding-bottom:8px; border-bottom:1px solid #e4e8ef; margin-bottom:10px; }
    .badge { background:#e7f0ff; color:#022249; border-radius:20px; padding:2px 9px; font-size:11px; }
    .stop { display:flex; gap:12px; padding:7px 0; break-inside:avoid; }
    .time { width:48px; font-weight:500; color:#0c1b2a; }
    .place { font-weight:500; }
    .note { color:#4a566a; font-size:12px; margin-top:2px; }
    .muted { color:#8893a4; }
    .transit { margin-top:6px; padding:8px 10px; background:#f6f8fb; border:1px solid #e4e8ef; border-radius:8px; }
    .leg { font-size:12px; padding:2px 0; }
    .leg .line { color:#fff; border-radius:5px; padding:1px 6px; font-size:11px; }
    .leg.exit { color:#0270fb; }
    .empty { padding:6px 0; }
    @media print { body { padding:0; } }
  </style></head><body>
    <div class="brand">✈ TAURUS</div>
    <h1>${esc(trip.name)}</h1>
    <div class="sub">${esc(formatDateRange(trip.start_date, trip.end_date))}</div>
    ${body || '<div class="muted">ยังไม่มีแผนการเดินทาง</div>'}
  </body></html>`

  const w = window.open('', '_blank')
  if (!w) { alert('เบราว์เซอร์บล็อกหน้าต่างใหม่ — อนุญาต pop-up แล้วลองใหม่'); return }
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 500)
}
