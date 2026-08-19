-- ============================================================
-- TAURUS — รูปโปรไฟล์ (avatar photo) สำหรับผู้เดินทาง + บัญชี
-- ใส่รูปแทนวงกลมตัวอักษรได้ · ถ้าไม่ใส่ก็ยังโชว์ตัวอักษร+สีเหมือนเดิม
-- รูปเก็บใน public bucket 'explore-photos' (มีอยู่แล้วจาก explore.sql)
-- รันซ้ำได้ปลอดภัย
-- ============================================================
alter table travelers add column if not exists avatar_url text;
alter table profiles  add column if not exists avatar_url text;
-- การครอปรูป avatar เก็บเป็น "x y scale" (จุดโฟกัส % + ซูม) เหมือน places.photo_focus
alter table travelers add column if not exists avatar_focus text;
alter table profiles  add column if not exists avatar_focus text;

-- รูปผู้เขียนในคอมเมนต์/ข้อเสนอ Explore (denormalize เหมือน author_name/author_color
-- เพื่อโชว์รูปได้โดยไม่ต้อง join profiles)
alter table explore_comments add column if not exists author_photo text;
alter table explore_comments add column if not exists author_focus text;
do $$ begin
  if exists (select from information_schema.tables where table_name = 'explore_suggestions') then
    alter table explore_suggestions add column if not exists author_photo text;
    alter table explore_suggestions add column if not exists author_focus text;
  end if;
end $$;
