-- ============================================================
-- TAURUS — รูปโปรไฟล์ (avatar photo) สำหรับผู้เดินทาง + บัญชี
-- ใส่รูปแทนวงกลมตัวอักษรได้ · ถ้าไม่ใส่ก็ยังโชว์ตัวอักษร+สีเหมือนเดิม
-- รูปเก็บใน public bucket 'explore-photos' (มีอยู่แล้วจาก explore.sql)
-- รันซ้ำได้ปลอดภัย
-- ============================================================
alter table travelers add column if not exists avatar_url text;
alter table profiles  add column if not exists avatar_url text;
