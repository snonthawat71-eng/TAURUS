-- ============================================================
-- TAURUS — ตั๋วรถไฟรายคน (QR + ที่นั่ง ต่อผู้โดยสาร ต่อขบวน)
-- รันใน Supabase > SQL Editor (รันซ้ำได้ปลอดภัย)
-- ต้องรัน sharing.sql + trains.sql มาก่อน (ใช้ can_view_full / can_edit_trip)
-- ============================================================

create table if not exists train_tickets (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references trips(id) on delete cascade,
  train_id       uuid references trains(id) on delete set null,     -- (optional) ผูกกับขบวน
  traveler_id    uuid references travelers(id) on delete set null,  -- ผูกกับผู้เดินทาง (ถ้ามี)
  passenger_name text,                                              -- ชื่อ (กรณีไม่ผูก traveler)
  kind           text default 'train',                              -- ประเภท: train / park / esim / other
  note           text,                                              -- รายละเอียดทั่วไป (ประเภทที่ไม่ใช่รถไฟ)
  label          text,                                              -- ป้ายกำกับ เช่น "ขาไป" / "Shinkansen"
  from_station   text,                                              -- สถานีต้นทาง
  to_station     text,                                              -- สถานีปลายทาง
  seat_no        text,                                              -- ที่นั่ง
  car            text,                                              -- ตู้ที่ (Car)
  gate           text,                                              -- ประตู (Gate)
  qr_path        text,                                              -- รูป QR (bucket trip-files / Cloudinary)
  is_main        boolean not null default false,                    -- QR หลักของคนนี้
  used           boolean not null default false,                    -- ใช้แล้ว
  position       int  not null default 0,
  created_at     timestamptz not null default now()
);

-- เผื่อเคยสร้างเวอร์ชันก่อน (train_id NOT NULL / ยังไม่มีคอลัมน์ใหม่)
alter table train_tickets alter column train_id drop not null;
alter table train_tickets add column if not exists label        text;
alter table train_tickets add column if not exists from_station text;
alter table train_tickets add column if not exists to_station   text;
alter table train_tickets add column if not exists gate         text;
alter table train_tickets add column if not exists is_main      boolean not null default false;
alter table train_tickets add column if not exists used         boolean not null default false;
alter table train_tickets add column if not exists kind         text default 'train';
alter table train_tickets add column if not exists note         text;

create index if not exists train_tickets_trip_id_idx on train_tickets(trip_id);

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
