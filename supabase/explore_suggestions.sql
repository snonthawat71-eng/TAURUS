-- ============================================================
-- TAURUS — Explore: ข้อเสนอแก้ไข & รายงาน (รันใน Supabase > SQL Editor)
-- คนที่ "ไม่ได้เป็นเจ้าของ" สถานที่ เสนอเพิ่มเส้นทาง/สาขา/แก้ข้อมูล หรือรายงานได้
-- เจ้าของรีวิวแล้วกด "นำไปใช้" หรือ "ปิด" — ไม่แก้ของจริงจนกว่าจะกดรับ
-- รันซ้ำได้ปลอดภัย
-- ============================================================
create table if not exists explore_suggestions (
  id           uuid primary key default gen_random_uuid(),
  explore_id   uuid references explore_places on delete cascade,
  user_id      uuid references auth.users on delete set null,
  author_name  text,
  author_color text,
  kind         text not null,                    -- 'route' | 'branch' | 'edit' | 'report'
  payload      jsonb,                            -- ข้อมูล structured ตาม kind
  note         text,
  status       text not null default 'pending',  -- 'pending' | 'accepted' | 'dismissed'
  created_at   timestamptz default now(),
  resolved_at  timestamptz
);
create index if not exists explore_suggestions_explore_idx on explore_suggestions (explore_id);
create index if not exists explore_suggestions_status_idx  on explore_suggestions (status);

alter table explore_suggestions enable row level security;

drop policy if exists "sugg read"   on explore_suggestions;
drop policy if exists "sugg insert" on explore_suggestions;
drop policy if exists "sugg update" on explore_suggestions;
drop policy if exists "sugg delete" on explore_suggestions;

-- อ่านได้: คนที่เสนอเอง หรือ เจ้าของสถานที่นั้น
create policy "sugg read" on explore_suggestions for select using (
  auth.uid() = user_id
  or exists (select 1 from explore_places p where p.id = explore_id and p.created_by = auth.uid())
);
-- เสนอได้: ต้องเป็นตัวเอง (user_id = ฉัน)
create policy "sugg insert" on explore_suggestions for insert with check (auth.uid() = user_id);
-- เปลี่ยนสถานะ (รับ/ปิด): เฉพาะเจ้าของสถานที่
create policy "sugg update" on explore_suggestions for update using (
  exists (select 1 from explore_places p where p.id = explore_id and p.created_by = auth.uid())
) with check (
  exists (select 1 from explore_places p where p.id = explore_id and p.created_by = auth.uid())
);
-- ลบข้อเสนอของตัวเองได้ (เช่นเสนอผิด ยังไม่ถูกรับ)
create policy "sugg delete" on explore_suggestions for delete using (auth.uid() = user_id);

-- Realtime: เด้งกระดิ่งเจ้าของทันทีเมื่อมีข้อเสนอใหม่ (idempotent)
do $$
begin
  begin alter publication supabase_realtime add table explore_suggestions; exception when duplicate_object then null; end;
end $$;
