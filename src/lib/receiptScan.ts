// Scan a receipt photo and pull out the fields the expense form needs — fully
// client-side via tesseract.js (lazy-loaded chunk; language data streams from
// its CDN on first use), so it's free, key-less, and nothing leaves the device.
// Best-effort: reads the TOTAL (and a name guess); the user always reviews.

export interface ReceiptScan {
  total: number | null
  name: string | null
}

// "grand total"-grade keywords (strong) vs any total-ish line (weak). Totals
// live near the bottom, so lines are scanned bottom-up.
const STRONG = /(grand\s*total|amount\s*due|net\s*total|รวมทั้งสิ้น|ยอดสุทธิ|รวมสุทธิ|ยอดรวมสุทธิ|總計|总计|合計|實收|实收)/i
const WEAK = /(total|amount|ยอดรวม|รวมเงิน|รวม|小計|应付|應付)/i

function amountsIn(line: string): number[] {
  const out: number[] = []
  // 1,234.50 / 1234.50 / 1234 — strip currency symbols first
  const cleaned = line.replace(/[฿$¥₩€£]|HK\$|NT\$|S\$/g, ' ')
  for (const m of cleaned.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{1,2}|\d{2,7}/g)) {
    const n = Number(m[0].replace(/,/g, ''))
    // plausibility: not a phone number / date / card digits
    if (Number.isFinite(n) && n > 0 && n <= 2_000_000 && !/\d{8,}/.test(m[0].replace(/[,.]/g, ''))) out.push(n)
  }
  return out
}

/** Parse OCR text → { total, name }. Exported for tests. */
export function parseReceiptText(text: string): ReceiptScan {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  let total: number | null = null
  // pass 1: strong keywords, bottom-up; pass 2: weak keywords, bottom-up
  for (const re of [STRONG, WEAK]) {
    if (total != null) break
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!re.test(lines[i])) continue
      // the amount usually sits on the same line; occasionally on the next
      const nums = [...amountsIn(lines[i]), ...amountsIn(lines[i + 1] ?? '')]
      if (nums.length) { total = Math.max(...nums); break }
    }
  }
  // pass 3: no keyword hit — take the largest decimal-looking amount anywhere
  if (total == null) {
    const all = lines.flatMap((l) => amountsIn(l).filter((n) => !Number.isInteger(n) || n >= 10))
    if (all.length) total = Math.max(...all)
  }

  // name guess: the first line with real letters that isn't a keyword/number row
  let name: string | null = null
  for (const l of lines.slice(0, 6)) {
    const letters = (l.match(/[\p{L}]/gu) ?? []).length
    if (letters >= 3 && l.length <= 48 && !STRONG.test(l) && !WEAK.test(l) && !/^\d/.test(l)) { name = l; break }
  }

  return { total, name }
}

/** OCR an image file (eng+tha) and parse it. Throws on OCR failure. */
export async function scanReceipt(file: File): Promise<ReceiptScan> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker(['eng', 'tha'])
  try {
    const { data } = await worker.recognize(file)
    return parseReceiptText(data.text ?? '')
  } finally {
    await worker.terminate()
  }
}
