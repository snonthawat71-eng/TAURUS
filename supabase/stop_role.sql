-- stop_role.sql — สถานที่ "หลัก/สำรอง" ในแพลนแต่ละวัน
-- รันใน Supabase SQL Editor ครั้งเดียว · รันซ้ำได้ปลอดภัย
-- role: null/'main' = แผนหลัก · 'backup' = แผนสำรอง (โซนพับท้ายวัน ไม่นับ/ไม่เตือน)
alter table public.itinerary_stops add column if not exists role text;
