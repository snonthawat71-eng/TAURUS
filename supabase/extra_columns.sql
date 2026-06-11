-- ============================================================
-- TRIP — คอลัมน์เสริม (รันใน Supabase > SQL Editor ครั้งเดียว)
-- ปลอดภัย: ไม่ลบ/แก้ข้อมูลเดิม ทุกคอลัมน์เป็น NULL ได้
-- ============================================================

-- สี avatar ของผู้เดินทาง (ของเดิมที่ยัง NULL จะใช้สีตามลำดับอัตโนมัติ)
alter table travelers add column if not exists avatar_color text;

-- รายละเอียดไฟลต์ที่แก้ไขได้: ชั้นโดยสาร / จำนวนที่นั่ง / สถานะ
alter table flights add column if not exists seat_class text;
alter table flights add column if not exists seats int;
alter table flights add column if not exists status text;

-- รูปภาพโรงแรม (เก็บ path ใน private bucket 'trip-files')
alter table hotels add column if not exists photo_path text;
