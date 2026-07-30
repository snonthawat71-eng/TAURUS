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
alter table explore_places add column if not exists multi_branch boolean;

-- ชื่อของ "ที่ตั้งหลัก" เมื่อร้านมีหลายสาขา — ที่ตั้งบนตัวรายการเองก็คือสาขาหนึ่ง
-- เหมือนกัน ตัวเลือกในหน้ารายละเอียดจะได้ขึ้นชื่อจริง (เช่น "สาขาสยาม") แทนคำว่า
-- "ที่ตั้งหลัก" ที่ไม่ได้บอกอะไร · ว่างไว้ได้ แล้วจะกลับไปใช้คำเดิม
alter table places add column if not exists branch_label text;
alter table explore_places add column if not exists branch_label text;
