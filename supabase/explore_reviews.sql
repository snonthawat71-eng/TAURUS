-- ============================================================
-- TAURUS — Explore reviews: ดาวจริง 1–5 + คะแนนแยกด้าน + แท็กแตะเดียว + โหวตเมนูเด็ด
-- (รันใน Supabase > SQL Editor · รันซ้ำได้ปลอดภัย)
--
-- ก่อนหน้านี้ "ดาว" บนหน้า Explore ไม่ใช่คะแนนที่ใครให้ — มันถูกคำนวณจาก
-- สัดส่วนกดถูกใจ/ไม่ถูกใจ (explore_votes) ร้านที่มี 3 ถูกใจ 0 ไม่ถูกใจ จึงได้
-- 5 ดาวเต็มทั้งที่ไม่มีใครให้ดาวเลย ตารางด้านล่างเก็บ "คะแนนที่คนให้จริง"
--
--   explore_ratings     — 1 คน 1 คะแนนต่อที่ (1–5 ดาว) + คะแนนแยกด้าน 4 ด้าน
--   explore_tags        — แท็กแตะเดียว ("ต้องต่อคิว" ฯลฯ) 1 คนกดได้หลายแท็ก
--   explore_menu_items  — เมนูของร้าน (ใครก็เพิ่มได้)
--   explore_menu_votes  — โหวต "สั่งอะไรดี" 1 คน 1 เสียงต่อเมนู
--
-- ทุกตารางเปิดอ่านให้คน login แล้ว · เขียน/ลบได้เฉพาะแถวของตัวเอง (RLS)
-- ============================================================

-- ── 1) ดาวจริง 1–5 + คะแนนแยกด้าน ───────────────────────────
-- `stars` ไม่ได้กดเอง — เป็น "ค่าเฉลี่ยของ 4 ด้าน" ที่คำนวณให้ตอนบันทึก
-- (จึงเป็นทศนิยม) กันเคสให้ 5 ดาวรวมทั้งที่ทุกด้านแย่
create table if not exists explore_ratings (
  explore_id   uuid references explore_places on delete cascade,
  user_id      uuid references auth.users on delete cascade,
  stars        numeric(3,2) not null check (stars between 1 and 5),
  -- คะแนนแยกด้าน (แถวเก่าอาจเป็น null ได้ · ฟอร์มปัจจุบันบังคับให้ครบ 4 ด้าน)
  taste        smallint check (taste between 1 and 5),   -- รสชาติ / ความน่าสนใจ
  worth        smallint check (worth between 1 and 5),   -- คุ้มราคา
  vibe         smallint check (vibe between 1 and 5),    -- บรรยากาศ
  queue        smallint check (queue between 1 and 5),   -- คิว (5 = ไม่ต้องรอ)
  -- เก็บชื่อผู้เขียนในแถวเลย เหมือน explore_comments เพื่อโชว์ได้โดยไม่ต้อง join profiles
  author_name  text,
  author_color text,
  author_photo text,
  author_focus text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  primary key (explore_id, user_id)
);

create index if not exists explore_ratings_explore_idx on explore_ratings (explore_id);

-- เผื่อเคยรันเวอร์ชันแรกที่ stars เป็น smallint — ขยายให้เก็บทศนิยมได้
alter table explore_ratings alter column stars type numeric(3,2);

-- ข้อความรีวิว + รูปที่แนบมากับรีวิว (public URL เหมือนรูป Explore)
alter table explore_ratings add column if not exists body   text;
alter table explore_ratings add column if not exists photos text[];

-- โหมดไม่ระบุตัวตน: true = ไม่เก็บชื่อ/สี/รูปโปรไฟล์ลงแถวนี้เลย (author_* เป็น
-- null) แล้วหน้าเว็บจะขึ้นว่า "ไม่ระบุตัวตน"
--
-- ⚠️ ยังไม่ใช่การปิดบังระดับฐานข้อมูล — `user_id` เป็น primary key ของตารางนี้
-- และ policy อ่านเปิดให้คน login ทุกคน ใครที่ query ตรงเป็นก็ยังโยงกลับได้
-- ถ้าอยากให้ปิดจริง ต้องซ่อน user_id หลัง view/RPC (ดูหมายเหตุใน
-- src/lib/exploreReviews.ts)
alter table explore_ratings add column if not exists anonymous boolean;

alter table explore_ratings enable row level security;

drop policy if exists "explore ratings read"   on explore_ratings;
drop policy if exists "explore ratings insert" on explore_ratings;
drop policy if exists "explore ratings update" on explore_ratings;
drop policy if exists "explore ratings delete" on explore_ratings;
create policy "explore ratings read"   on explore_ratings for select using (auth.uid() is not null);
create policy "explore ratings insert" on explore_ratings for insert with check (auth.uid() = user_id);
create policy "explore ratings update" on explore_ratings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "explore ratings delete" on explore_ratings for delete using (auth.uid() = user_id);

-- ── 2) แท็กแตะเดียว ─────────────────────────────────────────
-- `tag` เป็นคีย์คงที่จากรายการในโค้ด (src/lib/exploreReviews.ts) เช่น 'queue',
-- 'mustgo', 'spicy' — เก็บคีย์ ไม่ใช่ข้อความ เพื่อให้เปลี่ยนคำแสดงผลได้ทีหลัง
create table if not exists explore_tags (
  explore_id uuid references explore_places on delete cascade,
  user_id    uuid references auth.users on delete cascade,
  tag        text not null,
  created_at timestamptz default now(),
  primary key (explore_id, user_id, tag)
);

create index if not exists explore_tags_explore_idx on explore_tags (explore_id);

alter table explore_tags enable row level security;

drop policy if exists "explore tags read"   on explore_tags;
drop policy if exists "explore tags insert" on explore_tags;
drop policy if exists "explore tags delete" on explore_tags;
create policy "explore tags read"   on explore_tags for select using (auth.uid() is not null);
create policy "explore tags insert" on explore_tags for insert with check (auth.uid() = user_id);
create policy "explore tags delete" on explore_tags for delete using (auth.uid() = user_id);

-- ── 3) เมนูเด็ด — ใครก็เพิ่มเมนูได้ ────────────────────────
create table if not exists explore_menu_items (
  id         uuid primary key default gen_random_uuid(),
  explore_id uuid references explore_places on delete cascade,
  name       text not null,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz default now()
);

-- กันเมนูซ้ำในร้านเดียวกัน (ไม่สนตัวพิมพ์ใหญ่เล็ก/ช่องว่างหัวท้าย)
create unique index if not exists explore_menu_items_uniq
  on explore_menu_items (explore_id, lower(btrim(name)));

alter table explore_menu_items enable row level security;

drop policy if exists "explore menu read"   on explore_menu_items;
drop policy if exists "explore menu insert" on explore_menu_items;
drop policy if exists "explore menu delete" on explore_menu_items;
create policy "explore menu read"   on explore_menu_items for select using (auth.uid() is not null);
create policy "explore menu insert" on explore_menu_items for insert with check (auth.uid() = created_by);
-- ลบได้ทั้งคนที่เพิ่มเมนู และเจ้าของสถานที่ (กันสแปม/พิมพ์ผิดค้าง)
create policy "explore menu delete" on explore_menu_items for delete using (
  auth.uid() = created_by
  or exists (select 1 from explore_places p where p.id = explore_id and p.created_by = auth.uid())
);

-- ── 4) โหวตเมนู — 1 คน 1 เสียงต่อเมนู ──────────────────────
create table if not exists explore_menu_votes (
  item_id    uuid references explore_menu_items on delete cascade,
  user_id    uuid references auth.users on delete cascade,
  created_at timestamptz default now(),
  primary key (item_id, user_id)
);

alter table explore_menu_votes enable row level security;

drop policy if exists "explore menu votes read"   on explore_menu_votes;
drop policy if exists "explore menu votes insert" on explore_menu_votes;
drop policy if exists "explore menu votes delete" on explore_menu_votes;
create policy "explore menu votes read"   on explore_menu_votes for select using (auth.uid() is not null);
create policy "explore menu votes insert" on explore_menu_votes for insert with check (auth.uid() = user_id);
create policy "explore menu votes delete" on explore_menu_votes for delete using (auth.uid() = user_id);

-- ── 5) Realtime — ให้คะแนน/แท็ก/โหวตเด้งสดทุกเครื่อง ───────
-- (idempotent — ข้ามตารางที่อยู่ใน publication แล้ว)
do $$
begin
  begin alter publication supabase_realtime add table explore_ratings;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table explore_tags;       exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table explore_menu_items; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table explore_menu_votes; exception when duplicate_object then null; end;
end $$;
