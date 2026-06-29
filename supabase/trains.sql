-- ============================================================
-- TAURUS — ตาราง "รถไฟ" (mirror ของ flights, มีขาไป/ขากลับ)
-- รันใน Supabase > SQL Editor (รันซ้ำได้ปลอดภัย)
-- ต้องรัน sharing.sql มาก่อน (ใช้ can_view_full / can_edit_trip)
-- ============================================================

create table if not exists trains (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references trips(id) on delete cascade,
  direction    text not null default 'outbound',  -- 'outbound' = ขาไป | 'return' = ขากลับ
  operator     text,                               -- สายการเดินรถ
  train_no     text,                               -- ขบวน
  dep_code     text,                               -- รหัสสถานีต้นทาง
  dep_name     text,                               -- ชื่อสถานีต้นทาง
  dep_time     text,
  arr_code     text,                               -- รหัสสถานีปลายทาง
  arr_name     text,
  arr_time     text,
  travel_date  text,
  booking_ref  text,
  storage_path text,                               -- ไฟล์ตั๋ว/ใบจอง (bucket trip-files)
  seat_class   text,
  seats        int,
  dep_tz       text,                               -- IANA tz ต้นทาง (คิดเวลาเดินทางข้ามโซน)
  arr_tz       text,
  created_at   timestamptz not null default now()
);

create index if not exists trains_trip_id_idx on trains(trip_id);

-- ---- RLS: อ่านได้ถ้าดูทริปได้, เขียนได้ถ้าแก้ทริปได้ (เหมือน flights) ----
alter table trains enable row level security;
drop policy if exists "rw_read"  on trains;
drop policy if exists "rw_write" on trains;
create policy "rw_read"  on trains for select using (can_view_full(trip_id));
create policy "rw_write" on trains for all    using (can_edit_trip(trip_id)) with check (can_edit_trip(trip_id));

-- ---- realtime (ถ้าใช้ publication เดียวกับตารางอื่น) ----
alter publication supabase_realtime add table trains;
