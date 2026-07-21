# ระบบพิกัดแผนที่ (Map Coordinate Resolution)

เอกสารนี้อธิบายว่า TAURUS หาพิกัด (lat/lng) ของสถานที่มาปักบนแผนที่ `/map` (`src/pages/TripMap.tsx`) ได้อย่างไร ตั้งแต่ลิงก์ที่ user กรอก จนถึงหมุดที่ถูกตำแหน่งจริงตาม Google/AMap

> เป้าหมาย: หมุดตรงตำแหน่งจริง แม้ user จะกรอกแค่ **ลิงก์แผนที่** (Google / AMap / ลิงก์ย่อ) โดยไม่ต้องพิมพ์พิกัดเอง

---

## 1. ปัญหาที่แก้

ลิงก์ที่แชร์จาก **iPhone** มักลงท้ายด้วย `?g_st=ic` — ลิงก์แบบนี้ **ไม่มีพิกัดฝังอยู่ในตัว URL** มีแต่ที่อยู่ (canonical address) เท่านั้น เวลา resolve จะได้แค่ที่อยู่ ไม่ได้พิกัด ระบบจึงต้องเอา "ที่อยู่" ไปค้นพิกัดต่อ ซึ่งเป็นที่มาของความคลาดเคลื่อนทั้งหมด

อาการที่เคยเจอและต้นตอ:

| อาการ | ต้นตอ | วิธีแก้ |
|---|---|---|
| หมุดหลุดไปคนละทวีป (~39.02, -77.84) | เชื่อพิกัดที่ scrape จาก body ของหน้า (เป็น geo-IP default ของ data-center) | เลิก scrape พิกัดจาก body — เชื่อเฉพาะพิกัดใน URL |
| ถูกเมืองแต่ผิดตึก | `?g_st=ic` ไม่ให้พิกัด ต้องค้นจากที่อยู่ | ดึง canonical address จาก `?q=` มา geocode |
| ที่อยู่ HK ค้นไม่แม่นด้วย OSM | OSM (Nominatim) ครอบคลุมแต่ไม่ระดับตึก | เพิ่มฐานข้อมูลทางการ HK (ALS) |
| ร้านเชนยังผิด (เช่น ICHIRAN) | ที่อยู่ Google ปนชื่อร้าน + อักษรจีน + คำไทย → parser งง | `cleanAddress()` ตัด CJK/ไทย + `alsQuery()` เหลือแค่ "เลขที่ ถนน" |
| ร้านไม่มีเลขที่บ้าน (เช่น Lau Haa) | มีแต่ชื่อตึก + ถนน → ปักกลางถนน | `alsQuery()` ดึงชื่อตึกมาช่วย |
| หมุดไม่ยอมขยับ | กฎกันชน 250 ม. บล็อกไม่ให้พิกัดใหม่ทับของเดิม | ผลจากฐานข้อมูลทางการ (`precise`) → บังคับย้ายได้ |
| แลนด์มาร์กไกลสถานี (Tian Tan Buddha) เด้งกลับสถานี | wrong-branch guard มองว่า "ไกลสถานี = สาขาผิด" | ถ้าพิกัดมาจากที่อยู่เฉพาะ (addrBased) → ข้ามกฎสถานี |
| พิกัดที่ตั้งเองโดนเขียนทับ | manual pin เก็บแค่ lat/lng, audit re-geocode ทับ | ปักเอง → เขียน `map_url` เป็นพิกัด → กลายเป็น URL-exact ล็อกถาวร |

---

## 2. ลำดับการหาพิกัด (Resolution pipeline)

อยู่ใน `src/lib/geo.ts` (`geocodeSmart`) และตัว healer/audit ใน `TripMap.tsx` — เรียงจาก **เชื่อถือได้มากสุด → น้อยสุด**:

1. **พิกัดใน URL (URL-exact)** — `latLngFromUrlExact()`
   อ่านพิกัดตรงจากลิงก์: Google `!3d..!4d..`, param `ll/q/daddr/...`, AMap (แปลง GCJ-02→WGS84 ด้วย `gcj02ToWgs84`)
   → **แม่นสุด ทุกประเทศ** ลิงก์ปกติ (ที่ไม่ใช่ `?g_st=ic`) มักเข้าเคสนี้

2. **Resolve ลิงก์ย่อ server-side** — `resolveMapUrl()` → `/api/resolve-map`
   ตามลิงก์ `maps.app.goo.gl` / `surl.amap.com` แล้วดึงพิกัด/ที่อยู่จาก URL ปลายทาง

3. **ค้นจากที่อยู่ (address geocoding)** — เรียงตามนี้:
   - **ฐานข้อมูลทางการของประเทศ** (ดูข้อ 3) — แม่นระดับตึก, ฟรี
   - **OSM**: Nominatim → Photon (ทั่วโลก, ระดับย่าน/ถนน)
   - Mapbox (ถ้ามี `VITE_MAPBOX_TOKEN` — ไม่บังคับ)

4. **ค้นจากชื่อสถานที่** (proximity-biased ไปที่ศูนย์กลางทริป) + **wrong-branch guard**
   ถ้าชื่อร้านเชนไปเจอสาขาที่ห่างจากสถานีที่ระบุ >2 กม. = สาขาผิด → ค้นใหม่ใกล้สถานี
   *ยกเว้น* พิกัดที่มาจากที่อยู่เฉพาะ (`addrBased`) → ข้ามกฎนี้ (กันแลนด์มาร์กไกลสถานีโดนเด้ง)

5. **ปักที่สถานีโดยประมาณ** (`approx: true`) — ทางเลือกสุดท้าย, หมุดเส้นประ

---

## 3. ฐานข้อมูลทางการรายประเทศ (Official engines)

ฐานข้อมูลที่อย่างเป็นทางการของรัฐ **ฟรี ไม่ต้องผูกบัตร** — แม่นระดับตึกกว่า OSM มาก ใช้เป็นด่านแรกของการค้นที่อยู่ ถ้าไม่เจอ/หลุดประเทศ จะตกไปใช้ OSM (ไม่มีทางปักแย่กว่าเดิม เพราะมี bbox กันไว้)

| ประเทศ | เครื่องยนต์ | Proxy endpoint | Upstream |
|---|---|---|---|
| 🇭🇰 ฮ่องกง | ALS (OGCIO) | `/api/hk-geocode` | `als.gov.hk` |
| 🇯🇵 ญี่ปุ่น | GSI | `/api/jp-geocode` | `msearch.gsi.go.jp` |
| 🇸🇬 สิงคโปร์ | OneMap (SLA) | `/api/sg-geocode` | `onemap.gov.sg` |
| 🇹🇼 ไต้หวัน / 🇨🇳 จีน / 🇰🇷 เกาหลี | — (ไม่มี keyless) | — | **OSM + ที่อยู่ภาษาท้องถิ่น** (ดูข้อ 3.1) |
| 🌏 อื่นๆ | — | — | ใช้ OSM + ปักเองล็อกถาวร |

**Registry** อยู่ที่ `OFFICIAL_ENGINES` ใน `src/lib/geo.ts`:
- `officialEngineFor(text)` — เลือกเครื่องยนต์ตามประเทศจากข้อความ (ที่อยู่/เมือง/ประเทศ)
- `officialQueries(addr, engine, country)` — สร้าง query ให้เหมาะกับแต่ละประเทศ
  - **HK** (ที่อยู่อังกฤษ): `cleanAddress()` ตัด CJK/ไทย → `alsQuery()` เหลือ "เลขที่ ถนน" หรือ "ชื่อตึก ถนน"
  - **JP** (ที่อยู่ญี่ปุ่น): **ไม่ตัด CJK** (จะพัง) แค่ตัดชื่อร้านนำหน้า + คำประเทศ
  - **SG** (ที่อยู่อังกฤษ): คล้าย JP
- `officialRaw(query, path)` — ยิง proxy, คืน `LatLng | null`
- ผลจากฐานข้อมูลทางการติดธง **`precise: true`** → audit บังคับย้ายหมุดได้ (ข้ามกฎกันชน 250 ม.)

แต่ละ proxy (`api/*-geocode.js`) มี:
- **bbox กันประเทศ** — พิกัดหลุดกรอบประเทศ = ปฏิเสธ (`{error:'no match'}`) → ตกไป OSM
- **`?raw=1`** — dump คำตอบดิบจาก upstream (ไว้ debug format)
- **degrade อย่างสุภาพ** — upstream ล่ม/timeout = คืน error ไม่ crash, ไม่ cache
- **edge-cache 1 สัปดาห์** เฉพาะ hit (ข้อมูลทางการนิ่ง)

### 3.1 ที่อยู่ภาษาท้องถิ่น สำหรับประเทศเอเชียที่ไม่มีเครื่องยนต์ทางการ (keyless)

ไต้หวัน/จีน/เกาหลี **ไม่มี**ฐานข้อมูลทางการแบบฟรี-ไม่ต้องคีย์ แต่ยังทำให้แม่นแบบ keyless ได้ด้วย **OSM** — เคล็ดลับคือ**ภาษาของที่อยู่**:

- ปัญหา: `resolve-map` เดิมขอที่อยู่จาก Google เป็น en/th → ได้ถอดเสียง `"Guangzhou St"` ซึ่ง OSM เอเชีย**ไม่รู้จัก** (OSM เก็บชื่อถนนเป็นภาษาท้องถิ่น `廣州街`)
- แก้: `localLang(country)` แปลงประเทศ→ภาษา (ไต้หวัน→`zh-TW`, จีน→`zh-CN`, เกาหลี→`ko`, ญี่ปุ่น→`ja`) แล้วส่งเป็น `&lang=` ให้ `resolve-map` → forward เป็น `Accept-Language` → Google คืนที่อยู่ภาษาท้องถิ่น `"台北市萬華區廣州街104號"`
- `geocodeSmart` ค้น OSM ด้วย**ตัวอักษรท้องถิ่นตรงๆ** (ไม่ตัด CJK) → match ได้ระดับเลขที่บ้าน
- `addressFrom()` (ใน `resolve-map.js`) รับที่อยู่ CJK ที่**ไม่มี comma** ได้ (ที่อยู่จีน/ญี่ปุ่นเขียนติดกัน) เมื่อมีเครื่องหมายเมือง/ถนน + เลข
- cache แยกตามภาษา (`url6:<lang>:<url>`)

> ⚠️ ขึ้นกับ Google ยอมคืนภาษาท้องถิ่นสำหรับลิงก์นั้นมั้ย (บางลิงก์ฝัง locale ผู้แชร์มา) — ถ้าไม่ยอม ให้ปักเองล็อกถาวร (ข้อ 4)

### เพิ่มประเทศใหม่
1. เพิ่ม 1 บรรทัดใน `OFFICIAL_ENGINES` + เงื่อนไขใน `officialEngineFor()`
2. สร้าง `api/<cc>-geocode.js` (ก็อป template จาก `hk-geocode.js` แก้ upstream + bbox + การ parse)
3. ปรับ `officialQueries()` ถ้ารูปแบบที่อยู่ต่างจากเดิม
4. เพิ่ม test ใน `scripts/test-official-geocode.mjs`

> เกาหลี/ไต้หวันมีฐานข้อมูลทางการแต่ต้องขอ **API key** (ฟรี) — เพิ่มได้ถ้าต้องการ

---

## 4. ปักหมุดเอง = ล็อกถาวร (Manual pin lock)

ใช้ได้ **ทุกประเทศ** — สำหรับที่ที่ระบบอัตโนมัติทำได้ไม่แม่นพอ (เช่นแลนด์มาร์กในชนบท)

- user กด "ปักหมุด" → วางพิกัด `lat,lng` หรือแตะแผนที่ → `applyCoords()` (`TripMap.tsx`)
- `setManualPin()` (`src/lib/placeMutations.ts`) เขียน **`map_url` เป็นพิกัด** (`https://www.google.com/maps?q=lat,lng`)
- ผล: `latLngFromUrlExact()` อ่านพิกัดนี้เป็น **URL-exact** = ด่านแรกสุดของทุกส่วน → force ใช้ค่านี้เสมอ **ไม่มี geocode/audit ตัวไหนย้ายได้อีก**
- ถ้า user วางลิงก์ที่มีพิกัดในตัวอยู่แล้ว → เก็บลิงก์นั้นไว้ (ไม่ทับ)

### แก้พิกัดตรงใน DB (ทางลัด)
ถ้าจะตั้งพิกัดให้สถานที่ตรงๆ (เช่น Tian Tan Buddha) รันใน Supabase → SQL Editor:

```sql
update places
set lat = 22.2539847,
    lng = 113.904984,
    map_url = 'https://www.google.com/maps?q=22.2539847,113.904984'
where name ilike '%tian tan buddha%';
```

ตั้ง `map_url` เป็นพิกัดด้วย → ล็อกถาวรเหมือนปักในแอป

---

## 5. ปุ่ม "ตรวจพิกัดทั้งทริป" (Audit)

`runAudit()` ใน `TripMap.tsx` — กดครั้งเดียว ตรวจ+แก้ทั้งทริป (worker pool 6 ตัว) แสดงผลบนจอโดย **ไม่ต้องส่ง debug**:

- **แถบสถานะเครื่องยนต์** บนสุด — เปลี่ยนตามประเทศทริป (เช่น "✅ ญี่ปุ่น (GSI)" / "⚠️ ...ใช้ OSM แทน") probe จริงจาก endpoint ตอนกด
- แต่ละรายการโชว์: ที่อยู่ที่ใช้ค้น (`📍`), query ที่ส่งเครื่องยนต์ทางการ (`→ ค้นทางการ:`), และ **พิกัดที่ได้** (`· พิกัด ...`)
- แยกหมวด: ยืนยันถูกต้อง / แก้ให้แล้ว / โดยประมาณ / ตามลิงก์ไม่สำเร็จ / ต้องยืนยันเอง
- **กันของเดิม:** ฐานข้อมูลทางการ (`precise`) บังคับย้ายได้; OSM ธรรมดาย้ายได้เมื่อห่าง >250 ม.; หมุดที่ปักเอง (URL-exact) ไม่โดนแตะ

---

## 6. ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/geo.ts` | หัวใจ: parse URL, dispatch เครื่องยนต์ทางการ, `geocodeSmart`, `cleanAddress`, `alsQuery`, `officialHealth` |
| `src/pages/TripMap.tsx` | หน้าแผนที่, healer ตอนโหลด, `runAudit`, ปักหมุดเอง |
| `src/lib/placeMutations.ts` | `setPlaceCoords`, `setManualPin` (ล็อกพิกัด), `syncCoordsFromLink` |
| `api/resolve-map.js` | resolve ลิงก์ย่อ server-side (คืนพิกัด/ที่อยู่) |
| `api/hk-geocode.js` | proxy ALS (ฮ่องกง) |
| `api/jp-geocode.js` | proxy GSI (ญี่ปุ่น) |
| `api/sg-geocode.js` | proxy OneMap (สิงคโปร์) |
| `scripts/test-geo.mjs` | test pipeline + dispatch (มี esbuild bundle) |
| `scripts/test-hk-geocode.mjs`, `scripts/test-official-geocode.mjs` | test proxy แต่ละตัว (mock upstream) |
| `scripts/test-resolve.mjs` | test `api/resolve-map.js` |

รัน test: `node scripts/test-geo.mjs` (และไฟล์ test อื่น) — ไม่มี framework, เป็น plain Node

---

## 7. ตั้งค่า / ตรวจสอบ (Setup & health check)

- **หลัง deploy ต้องอัปเดต PWA** — แอปตั้งค่าให้ user กดอัปเดตเอง (ไม่ auto) โค้ด/พฤติกรรมใหม่จะยังไม่มีผลจนกว่าจะปิดแอปสนิท/refresh แล้วโหลดเวอร์ชันใหม่ (สังเกตได้จากที่อยู่ในพาเนล — เช่นถ้ายังเป็นอังกฤษทั้งที่ควรเป็นจีน = ยังไม่อัปเดต)
- **ไม่ต้องตั้ง key** สำหรับ HK/JP/SG (ฟรี key-less) — deploy แล้วใช้ได้เลย
- **สิงคโปร์:** ถ้าวันหน้า OneMap บังคับ token → ตั้ง env `ONEMAP_TOKEN` (proxy ส่งเป็น Bearer ให้เอง; ไม่ตั้งก็แค่ตกไป OSM)
- **Mapbox (ไม่บังคับ):** `VITE_MAPBOX_TOKEN` เพิ่มความแม่นของการค้นชื่อ POI

### เช็คว่าเครื่องยนต์ประเทศไหนใช้งานได้ (1 URL ต่อเครื่องยนต์)
```
https://<domain>/api/hk-geocode?q=440%20Jaffe%20Road%20Causeway%20Bay
https://<domain>/api/jp-geocode?q=東京都千代田区千代田1-1
https://<domain>/api/sg-geocode?q=1%20Marina%20Boulevard
```
- ได้ `{"lat":...,"lng":...}` = เครื่องยนต์ทำงาน
- error → เติม `&raw=1` เพื่อดูคำตอบดิบจาก upstream
- หรือกด "ตรวจพิกัดทั้งทริป" ในแอปแล้วดูแถบสถานะบนสุด (ง่ายสุด)

---

## 8. หลักการที่ยึด

1. **ห้ามปักแย่กว่าเดิม** — ทุก fallback มี bbox/geo-gate; ถ้าไม่ชัวร์ ใช้ค่าเดิม/ปักสถานีโดยประมาณ ดีกว่าปักมั่ว
2. **พิกัดในลิงก์ = ความจริงสูงสุด** — ทั้งลิงก์จริงและพิกัดที่ user ปักเอง
3. **ฐานข้อมูลทางการก่อน OSM** — แม่นระดับตึก, ฟรี
4. **ทุกอย่างเช็คได้ในแอป** — ไม่ต้อง copy URL/ส่ง debug JSON
