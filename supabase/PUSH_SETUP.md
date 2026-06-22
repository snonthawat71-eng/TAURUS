# Push reminders — setup (Web Push, เด้งแม้ปิดแอป)

แจ้งเตือนบนมือถือเมื่อใกล้ถึงเวลากิจกรรมในแผนการเดินทาง ผู้ใช้เปิด/ปิดและตั้งเวลาเตือนล่วงหน้าเองได้ (ตรงเวลา / 5 / 15 / 30 นาที) ที่หน้า **Personal Information**

> ข้อจำกัด: บน **iPhone** ต้อง "เพิ่มลงหน้าโฮม (Add to Home Screen)" ให้เป็น PWA ก่อน (iOS 16.4+) เปิดผ่าน Safari เฉยๆ จะแจ้งเตือนไม่ได้ บน Android/Chrome ใช้ได้เลย

ทำตามขั้นตอนนี้ครั้งเดียว:

## 1) สร้าง VAPID keys
```bash
npx web-push generate-vapid-keys
```
จะได้ `Public Key` และ `Private Key`

## 2) ใส่ Public key ฝั่งเว็บ
ใน `.env.local` (และใน Environment Variables ของ Vercel):
```
VITE_VAPID_PUBLIC_KEY=<Public Key>
```
แล้ว build/deploy ใหม่ (ถ้าไม่ใส่ ปุ่มแจ้งเตือนจะถูกซ่อนไว้)

## 3) รัน SQL
ใน Supabase → SQL Editor → รัน `supabase/notifications.sql`
(สร้างตาราง `push_subscriptions`, `sent_reminders` และคอลัมน์ `trips.timezone`)

## 4) Deploy Edge Function
```bash
supabase functions deploy send-due-reminders --no-verify-jwt
```

ตั้ง secrets ให้ฟังก์ชัน:
```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=<Public Key> \
  VAPID_PRIVATE_KEY=<Private Key> \
  VAPID_SUBJECT="mailto:you@example.com" \
  REMINDER_DEFAULT_TZ="Asia/Bangkok" \
  CRON_SECRET=<สุ่มสตริงยาวๆ>
```
(`SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY` มีให้อัตโนมัติในรันไทม์)

## 5) ตั้งเวลาเรียกทุก 5 นาที (pg_cron + pg_net)
ใน Supabase → SQL Editor:
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-due-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-due-reminders',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET เดียวกับข้อ 4>')
  );
  $$
);
```
แทน `<PROJECT_REF>` ด้วย ref ของโปรเจกต์ และ `<CRON_SECRET>` ให้ตรงกับข้อ 4

> ยกเลิกงาน cron: `select cron.unschedule('send-due-reminders');`

## วิธีทำงาน
- ทุก 5 นาที cron เรียกฟังก์ชัน → ฟังก์ชันหาสต็อปที่ `day_date + time` (ตีความตาม `trips.timezone` หรือค่าเริ่มต้น Asia/Bangkok) ลบด้วยเวลาเตือนล่วงหน้าของผู้ใช้ ถ้าตกอยู่ในช่วง ~6 นาทีนี้ก็ส่ง push
- ตาราง `sent_reminders` กันส่งซ้ำ (สต็อปละ 1 ครั้งต่อผู้ใช้)
- ส่งให้ทุกสมาชิกของทริป (เจ้าของ + ผู้ถูกแชร์) ที่เปิดแจ้งเตือนไว้
- subscription ที่หมดอายุ (404/410) จะถูกลบอัตโนมัติ

## ทดสอบ
เรียกฟังก์ชันตรงๆ:
```bash
curl -X POST 'https://<PROJECT_REF>.supabase.co/functions/v1/send-due-reminders' \
  -H 'x-cron-secret: <CRON_SECRET>'
```
ตอบกลับเป็น `{"sent": N}` — ลองตั้งสต็อปให้เวลาใกล้ๆ (ภายในเวลาเตือนล่วงหน้า) แล้วเรียกดู
