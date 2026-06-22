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

-- การครอปรูป Explore เก็บเป็น "x y scale" (จุดโฟกัส % + ซูม) ดู src/lib/photoFocus.ts
alter table explore_places add column if not exists photo_focus text;

-- ให้สถานที่ในทริปเก็บรูปจาก URL ได้ (ตอน fav จาก Explore เข้าทริป รูปจะติดไปด้วย)
alter table places add column if not exists photo_url text;

-- ผูกสำเนาที่ fav มาเข้ากับรายการต้นทางใน Explore (ใช้เช็ค "เซฟแล้ว" + เอาออก)
alter table places add column if not exists source_explore_id uuid;

-- หลายเส้นทางการเดินทางต่อสถานที่ (array ของ {line,color,station})
alter table explore_places add column if not exists routes jsonb;

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

-- ============================================================
-- คอมเมนต์ใน Explore (เก็บชื่อผู้เขียนในแถวเลย เพื่อให้แสดงได้โดยไม่ต้องอ่าน profiles)
-- ============================================================
create table if not exists explore_comments (
  id           uuid primary key default gen_random_uuid(),
  explore_id   uuid references explore_places on delete cascade,
  user_id      uuid references auth.users on delete set null,
  author_name  text,
  author_color text,
  body         text not null,
  created_at   timestamptz default now()
);

-- ตอบกลับความคิดเห็น (threaded replies): อ้างถึงคอมเมนต์แม่ (ลบแม่ → ลบลูกตาม)
alter table explore_comments add column if not exists parent_id uuid references explore_comments(id) on delete cascade;

alter table explore_comments enable row level security;

drop policy if exists "explore comments read"   on explore_comments;
drop policy if exists "explore comments insert" on explore_comments;
drop policy if exists "explore comments delete" on explore_comments;
create policy "explore comments read"   on explore_comments for select using (auth.uid() is not null);
create policy "explore comments insert" on explore_comments for insert with check (auth.uid() = user_id);
create policy "explore comments delete" on explore_comments for delete using (auth.uid() = user_id);

-- ============================================================
-- โหวต แนะนำ (1) / ไม่แนะนำ (-1) — คนละ 1 เสียงต่อรายการ
-- ============================================================
create table if not exists explore_votes (
  explore_id uuid references explore_places on delete cascade,
  user_id    uuid references auth.users on delete cascade,
  vote       smallint not null,         -- 1 = แนะนำ, -1 = ไม่แนะนำ
  created_at timestamptz default now(),
  primary key (explore_id, user_id)
);

alter table explore_votes enable row level security;

drop policy if exists "explore votes read"   on explore_votes;
drop policy if exists "explore votes insert" on explore_votes;
drop policy if exists "explore votes update" on explore_votes;
drop policy if exists "explore votes delete" on explore_votes;
create policy "explore votes read"   on explore_votes for select using (auth.uid() is not null);
create policy "explore votes insert" on explore_votes for insert with check (auth.uid() = user_id);
create policy "explore votes update" on explore_votes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "explore votes delete" on explore_votes for delete using (auth.uid() = user_id);

-- ============================================================
-- Realtime: push likes & comments to the owner's notification bell instantly.
-- (idempotent — skips tables already in the publication)
-- ============================================================
do $$
begin
  begin alter publication supabase_realtime add table explore_votes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table explore_comments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table explore_places; exception when duplicate_object then null; end;
end $$;

