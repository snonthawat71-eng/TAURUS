# Live flight status — setup (สรุปก่อนบิน / ดีเลย์ / ยกเลิก / เปลี่ยนเกท)

ตัวเช็คคือ `/api/check-flights` (Vercel serverless — deploy อัตโนมัติพร้อมแอป
ไม่ต้อง deploy อะไรเอง) ถูกปลุกโดย pg_cron ทุก 15 นาที และยิง AeroDataBox
เฉพาะไฟลท์ที่อยู่ในช่วง 6 ชม.ก่อนบิน … 18 ชม.หลังกำหนดบิน (ตาม timezone ทริป)

สิ่งที่ได้:

- **การ์ดเที่ยวบิน** หน้า Personal เปลี่ยนสถานะเอง (realtime): แถบเขียว
  "ตามเวลา / ออกเดินทางแล้ว / ถึงแล้ว" · ส้ม "ดีเลย์ +N นาที" (เวลาใหม่ทับเวลาเดิม)
  · แดง "ยกเลิก / เปลี่ยนเส้นทาง" + เลขเกท
- **push แจ้งเตือน** ถึงสมาชิกทริปที่เปิดเตือนไว้ (ค่า default ของระบบ ไม่มีสวิตช์แยก):
  สรุปครั้งเดียว ~3 ชม.ก่อนบิน · เริ่มดีเลย์/ดีเลย์ขยับ ≥10 นาที · ยกเลิก ·
  เปลี่ยนเส้นทาง · กลับมาตามเวลา · เปลี่ยนเกท

## ตั้งครั้งเดียว

1. **RapidAPI**: สมัคร https://rapidapi.com → หน้า AeroDataBox → Subscribe
   (แพลนฟรี) → คัดลอก **X-RapidAPI-Key**
2. **Vercel** → Settings → Environment Variables → เพิ่ม `RAPIDAPI_KEY` = key
   จากข้อ 1 → Redeploy (ค่าอื่นๆ ใช้ชุดเดียวกับระบบเตือนแพลนที่ตั้งไว้แล้ว)
3. **Supabase SQL Editor**: รัน `supabase/flight_status.sql` (เพิ่มคอลัมน์
   `live_*` + เปิด realtime) แล้วตั้ง cron:

```sql
select cron.schedule(
  'taurus-flight-status',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://<โดเมนแอป>/api/check-flights',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET เดียวกับระบบเตือนแพลน>')
  );
  $$
);
```

> ยกเลิก: `select cron.unschedule('taurus-flight-status');`

## เช็คว่าทำงาน

```sql
select status_code, content::text
from net._http_response
order by created desc limit 5;
```

- `200` + `{"checked":0,"reason":"no flights in window"}` = ปกติ (ยังไม่ถึงช่วงบิน)
- `500` + `missing RAPIDAPI_KEY` = ยังไม่ได้เพิ่ม key ใน Vercel / ยังไม่ Redeploy

## โควต้า API

ยิงเฉพาะช่วงใกล้บิน: ทุก 15 นาที ≈ 60–95 call ต่อไฟลท์-วัน วันอื่นไม่ยิงเลย
ถ้าโควต้าฟรีตึง ปรับ cron เป็น `*/30 * * * *` ได้ (สถานะสดช้าลงเท่านั้น)

## หมายเหตุ

- เลขไฟลท์ต้องเป็นรูปแบบสากล เช่น `TG628` และควรใส่ `dep_code` (BKK/HKG)
  ให้ตรง — ใช้เลือกช่วงบินที่ถูกเมื่อเลขเดียวมีหลายเลก
- สายการบินเช่าเหมาลำเล็กบางเจ้าอาจไม่มีข้อมูล — การ์ดโชว์แบบปกติโดยไม่พัง
- ตัวเก่าที่เป็น Supabase Edge Function ถูกถอดออกจากโปรเจกต์แล้ว (ย้ายมาอยู่
  ฝั่ง Vercel ทั้งหมด)
