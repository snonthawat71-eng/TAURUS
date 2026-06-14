-- ============================================================
-- TAURUS — Explore: community pool ของสถานที่/ร้าน (รันใน Supabase > SQL Editor)
-- ทุกคนที่ login เห็นได้ + เพิ่มได้ · แก้/ลบได้เฉพาะคนที่สร้าง
-- รันซ้ำได้ปลอดภัย
-- ============================================================
create table if not exists explore_places (
  id            uuid primary key default gen_random_uuid(),
  group_type    text,            -- 'place' | 'food'
  category      text,
  name          text not null,
  city          text,
  country       text,
  station_line  text,
  station_color text,
  station_name  text,
  map_url       text,
  note          text,
  photo_url     text,            -- รูปจาก URL ภายนอก (pool เป็นสาธารณะ)
  created_by    uuid references auth.users on delete set null,
  created_at    timestamptz default now()
);

alter table explore_places enable row level security;

drop policy if exists "explore read"   on explore_places;
drop policy if exists "explore insert" on explore_places;
drop policy if exists "explore update" on explore_places;
drop policy if exists "explore delete" on explore_places;
create policy "explore read"   on explore_places for select using (auth.uid() is not null);
create policy "explore insert" on explore_places for insert with check (auth.uid() = created_by);
create policy "explore update" on explore_places for update using (auth.uid() = created_by) with check (auth.uid() = created_by);
create policy "explore delete" on explore_places for delete using (auth.uid() = created_by);

-- ให้สถานที่ในทริปเก็บรูปจาก URL ได้ (ตอน fav จาก Explore เข้าทริป รูปจะติดไปด้วย)
alter table places add column if not exists photo_url text;

-- ผูกสำเนาที่ fav มาเข้ากับรายการต้นทางใน Explore (ใช้เช็ค "เซฟแล้ว" + เอาออก)
alter table places add column if not exists source_explore_id uuid;

-- ============================================================
-- Public bucket สำหรับรูป Explore (อัปโหลดเองได้ + เปิดดูสาธารณะ)
-- ============================================================
insert into storage.buckets (id, name, public) values ('explore-photos', 'explore-photos', true)
on conflict (id) do nothing;

drop policy if exists "explore photos read"   on storage.objects;
drop policy if exists "explore photos insert" on storage.objects;
drop policy if exists "explore photos delete" on storage.objects;
create policy "explore photos read"   on storage.objects for select using (bucket_id = 'explore-photos');
create policy "explore photos insert" on storage.objects for insert with check (bucket_id = 'explore-photos' and auth.uid() is not null);
create policy "explore photos delete" on storage.objects for delete using (bucket_id = 'explore-photos' and owner = auth.uid());

