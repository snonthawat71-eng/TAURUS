# Live flight status — setup (ดีเลย์/ยกเลิก/เปลี่ยนเกท เรียลไทม์ในวันเดินทาง)

พอถึงวันเดินทาง ระบบจะเช็คสถานะไฟลท์กับ AeroDataBox ทุก ~10 นาที (ช่วง 6 ชม.ก่อนบิน
ถึง 18 ชม.หลังกำหนดบิน) แล้ว:

- **การ์ดเที่ยวบิน** ในหน้า Personal เปลี่ยนสถานะเอง (realtime): แถบเขียว "ตามเวลา /
  ออกเดินทางแล้ว / ถึงแล้ว" · ส้ม "ดีเลย์ +N นาที" (เวลาใหม่ทับเวลาเดิม) · แดง "ยกเลิก /
  เปลี่ยนเส้นทาง" + เลขเกทถ้ามี
- **เด้งแจ้งเตือน** ถึงทุกคนในทริปที่เปิด push ไว้ เมื่อ: เริ่มดีเลย์ / ถูกยกเลิก /
  เปลี่ยนเส้นทาง / กลับมาตามเวลา / ดีเลย์ขยับ ≥10 นาที / เปลี่ยนเกท

> ต้องทำ [PUSH_SETUP.md](./PUSH_SETUP.md) ให้เสร็จก่อน (ใช้ VAPID keys + ตาราง
> push_subscriptions ร่วมกัน) — ถ้าไม่เปิด push การ์ดยังอัปเดตเรียลไทม์ได้ แค่ไม่มีเด้งเตือน

ทำครั้งเดียว:

## 1) สมัคร AeroDataBox (ผ่าน RapidAPI)

1. สมัคร/ล็อกอิน https://rapidapi.com
2. ไปที่หน้า **AeroDataBox** → กด **Subscribe to Test** → เลือกแพลน (มี Free/Basic
   ให้เริ่มได้)
3. คัดลอกค่า **X-RapidAPI-Key** จากหน้า endpoint

## 2) รัน SQL

Supabase → SQL Editor → รันไฟล์ `supabase/flight_status.sql`
(เพิ่มคอลัมน์ `live_*` บนตาราง flights + เปิด realtime ให้ตาราง)

## 3) Deploy Edge Function + ตั้ง secret

```bash
supabase functions deploy check-flight-status --no-verify-jwt
supabase secrets set RAPIDAPI_KEY=<X-RapidAPI-Key จากข้อ 1>
```

(VAPID_* กับ CRON_SECRET ตั้งไว้แล้วตอนทำ PUSH_SETUP — ใช้ชุดเดียวกัน)

## 4) ตั้งเวลาเรียกทุก 10 นาที (pg_cron + pg_net)

ใน Supabase → SQL Editor:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'check-flight-status',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/check-flight-status',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET เดียวกับ push>')
  );
  $$
);
```

> ยกเลิก: `select cron.unschedule('check-flight-status');`

## โควต้า API

ฟังก์ชันยิง API เฉพาะไฟลท์ที่อยู่ในหน้าต่างเวลาเดินทางเท่านั้น — วันบิน 1 วัน
(ไฟลท์เดียว) ≈ 6–24 ชม. × ทุก 10 นาที ≈ **~90–140 call** ต่อไฟลท์-วัน วันอื่นๆ ไม่ยิงเลย
ถ้าโควต้าฟรีตึง ปรับ cron เป็น `*/20 * * * *` หรือ `*/30 * * * *` ได้ (การ์ดจะสดช้าลงเท่านั้น)

## ทดสอบ

ตั้ง `flight_date` ของไฟลท์เป็นวันนี้ + `dep_time` ภายใน ~6 ชม.ข้างหน้า แล้วเรียกตรง:

```bash
curl -X POST 'https://<PROJECT_REF>.supabase.co/functions/v1/check-flight-status' \
  -H 'x-cron-secret: <CRON_SECRET>'
```

ตอบกลับ `{"checked": N, "alerts": M}` — `checked` = จำนวนไฟลท์ที่เช็ค, `alerts` = push ที่ส่ง
(ใช้เลขไฟลท์จริงที่บินวันนี้ เช่น `TG600` จะเห็นสถานะจริงจาก AeroDataBox)

## หมายเหตุ

- เลขไฟลท์ต้องเป็นรูปแบบสากล เช่น `TG628`, `HB7936` (มี/ไม่มีช่องว่างได้) และ
  `dep_code` (BKK/HKG) ควรใส่ให้ตรง — ใช้เลือกขาที่ถูกเมื่อเลขไฟลท์เดียวมีหลายช่วงบิน
- สายการบินเล็ก/เช่าเหมาลำบางเจ้า AeroDataBox อาจไม่มีข้อมูล — การ์ดจะโชว์แบบปกติ
  (ไม่มีแถบสถานะ) โดยไม่พัง
