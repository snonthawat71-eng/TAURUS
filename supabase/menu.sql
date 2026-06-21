-- ============================================================
-- TAURUS — แนบ "เมนูอาหาร" ให้ร้านอาหาร (รันใน Supabase > SQL Editor)
--
-- เก็บไฟล์เมนู (รูป/PDF) เป็น array ของ path/URL บนตาราง places
-- รูปแบบ: ["{trip_id}/place-menu-....jpg", "https://res.cloudinary.com/...pdf"]
-- ไฟล์จริงอยู่ใน bucket "trip-files" (ส่วนตัว) หรือ Cloudinary เหมือนรูปสถานที่
-- โค้ดจะตัดคอลัมน์นี้ออกอัตโนมัติถ้ายังไม่ได้รัน (graceful-degradation) — รันซ้ำได้ปลอดภัย
-- ============================================================

alter table places add column if not exists menu_paths text[];
