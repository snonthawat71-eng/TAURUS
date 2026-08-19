// Tests for the receipt text parser (run: node scripts/test-receipt.mjs)
// OCR itself is exercised on-device; this locks the PARSING — which line wins
// as the total, and the name guess — against realistic receipt shapes.
import { execSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let pass = 0, fail = 0
const ok = (cond, name) => { if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}`) } }

const dir = mkdtempSync(join(tmpdir(), 'receipttest-'))
execSync(`npx esbuild src/lib/receiptScan.ts --bundle --format=esm --external:tesseract.js --outfile=${join(dir, 'scan.mjs')}`, { stdio: 'pipe' })
const { parseReceiptText } = await import(join(dir, 'scan.mjs'))

// 1. Thai receipt: รวมทั้งสิ้น beats the subtotal above it
{
  const r = parseReceiptText(`ร้านอาหารบ้านสวน
โต๊ะ 12
ข้าวผัดปู 120.00
ต้มยำกุ้ง 250.00
รวม 370.00
ภาษี 7% 25.90
รวมทั้งสิ้น 395.90`)
  ok(r.total === 395.9, `Thai grand total wins over subtotal (got ${r.total})`)
  ok(r.name === 'ร้านอาหารบ้านสวน', `name = first real line (got "${r.name}")`)
}

// 2. English receipt with thousands separator
{
  const r = parseReceiptText(`ICHIRAN Hong Kong
Ramen x2 218.00
Beer 68.00
Service 10% 28.60
TOTAL 1,314.60
VISA **** 1234`)
  ok(r.total === 1314.6, `comma-separated TOTAL parsed (got ${r.total})`)
  ok(r.name === 'ICHIRAN Hong Kong', `merchant name guessed (got "${r.name}")`)
}

// 3. amount on the line AFTER the keyword
{
  const r = parseReceiptText(`SEVEN ELEVEN
TOTAL
189.00
CASH 200.00`)
  ok(r.total === 189, `amount on the next line is found (got ${r.total})`)
}

// 4. no keyword at all → largest decimal amount
{
  const r = parseReceiptText(`ตลาดนัด
กระเป๋า 350.00
ของฝาก 120.00`)
  ok(r.total === 350, `no keyword → largest amount (got ${r.total})`)
}

// 5. phone numbers / long digit runs never mistaken for the total
{
  const r = parseReceiptText(`ร้านค้า โทร 0812345678
สินค้า 45.00
รวม 45.00`)
  ok(r.total === 45, `phone number ignored (got ${r.total})`)
}

// 6. garbage → null total, no crash
{
  const r = parseReceiptText(`~~~###\n???`)
  ok(r.total === null, 'unreadable text → null total (form left as-is)')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
