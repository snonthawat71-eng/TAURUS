-- ============================================================
-- TAURUS — ตั๋วรถไฟรายคน (QR + ที่นั่ง ต่อผู้โดยสาร ต่อขบวน)
-- รันใน Supabase > SQL Editor (รันซ้ำได้ปลอดภัย)
-- ต้องรัน sharing.sql + trains.sql มาก่อน (ใช้ can_view_full / can_edit_trip)
-- ============================================================

create table if not exists train_tickets (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references trips(id)  on delete cascade,
  train_id       uuid not null references trains(id) on delete cascade,
  traveler_id    uuid references travelers(id) on delete set null,  -- ผูกกับผู้เดินทาง (ถ้ามี)
  passenger_name text,                                              -- ชื่อ (กรณีไม่ผูก traveler)
  seat_no        text,                                              -- ที่นั่ง
  car            text,                                              -- ตู้ที่
  qr_path        text,                                              -- รูป QR (bucket trip-files / Cloudinary)
  position       int  not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists train_tickets_train_id_idx on train_tickets(train_id);
create index if not exists train_tickets_trip_id_idx  on train_tickets(trip_id);

-- ---- RLS: อ่านได้ถ้าดูทริปได้, เขียนได้ถ้าแก้ทริปได้ (เหมือน trains) ----
alter table train_tickets enable row level security;
drop policy if exists "rw_read"  on train_tickets;
drop policy if exists "rw_write" on train_tickets;
create policy "rw_read"  on train_tickets for select using (can_view_full(trip_id));
create policy "rw_write" on train_tickets for all    using (can_edit_trip(trip_id)) with check (can_edit_trip(trip_id));

-- ---- realtime ----
do $$
begin
  alter publication supabase_realtime add table train_tickets;
exception when duplicate_object then null;
end $$;
