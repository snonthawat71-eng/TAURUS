-- ============================================================
-- TAURUS — รองรับร้าน/สถานที่ที่มี "หลายสาขา" (รันใน Supabase > SQL Editor)
--
-- เก็บสาขาเป็น JSON บนตาราง places: แต่ละสาขามีชื่อ + ลิงก์แผนที่ + สาย/สถานี
-- (รูปแบบ: [{ "label": "...", "map_url": "...", "line": "...", "color": "#...", "station": "..." }])
-- โค้ดจะตัดคอลัมน์นี้ออกอัตโนมัติถ้ายังไม่ได้รัน (graceful-degradation) — รันซ้ำได้ปลอดภัย
-- ============================================================

alter table places add column if not exists branches jsonb;
alter table explore_places add column if not exists branches jsonb;

-- ปุ่ม "มีหลายสาขา" แบบง่าย: แค่ติดธงเพื่อให้ขึ้นป้าย "หลายสาขา" บนการ์ด
-- (ไม่ต้องกรอกรายละเอียดสาขา/โลเคชั่น)
alter table places add column if not exists multi_branch boolean;
