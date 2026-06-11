# TRIP — travel planner

เว็บแอปวางแผนทริปกับเพื่อน โทนสะอาดแบบ Notion สีเขียว `#1D9E75`

**Stack:** React 19 + Vite + TypeScript · Tailwind CSS v4 · Supabase (auth/db/storage/realtime) · @tabler/icons-react · dnd-kit · PWA (offline)

---

## วิธีรันในเครื่อง (สำหรับนักพัฒนา)

```bash
npm install
cp .env.example .env.local   # แล้วใส่ค่า Supabase
npm run dev                  # เปิด http://localhost:5173
```

## คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รันเว็บในเครื่อง (โหมดพัฒนา) |
| `npm run build` | สร้างไฟล์สำหรับ deploy |
| `npm run preview` | ทดลองดูไฟล์ที่ build แล้ว |
| `npm run lint` | ตรวจ TypeScript |

## ตัวแปร environment ที่ต้องตั้ง

ไฟล์ `.env.local` (ดูตัวอย่างใน `.env.example`):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ....
```

หาได้ที่ **Supabase Dashboard → Project Settings → API**

---

## สถานะการพัฒนา

- [x] ขั้น 1 — ตั้งโปรเจกต์ + ระบบดีไซน์ (สี/ฟอนต์ตาม spec) + ระบบ login (Google / อีเมล)
- [x] ขั้น 2 — โครงหน้าแอป (sidebar + bottom nav มือถือ) + ดึงข้อมูลทริปจาก Supabase + หลายทริป
- [x] ขั้น 3 — หน้า Itinerary (drag จัดเรียงวัน/จุดแวะ + metro route แก้ไขได้)
- [x] ขั้น 4 — Places / Food & café / All plans
- [x] ขั้น 5 — Personal Information (ไฟล์ลับ + signed URL) + Budget
- [x] ขั้น 6 — Realtime sync + map deep links + PWA/offline

## ฐานข้อมูล

รัน `supabase/extra_columns.sql` ใน Supabase SQL Editor (รันซ้ำได้ ปลอดภัย) เพื่อเปิดใช้:
สี avatar, รายละเอียดไฟล์ต (class/seats/status), รูปโรงแรม/สถานที่, ธงทริป,
พฤติกรรมแตะจุดแวะ และฟังก์ชันรับคำเชิญ (owner-controlled sharing)
