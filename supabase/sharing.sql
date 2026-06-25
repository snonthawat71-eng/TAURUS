-- ============================================================
-- TAURUS — สิทธิ์การแชร์ทริป 3 ระดับ (รันใน Supabase > SQL Editor)
--   permission: 'edit'   = แชร์และแก้ไขได้ทั้งหมด
--               'places' = ดูเฉพาะ Places/Food (พินไปเซฟทริปตัวเองได้)
--               'view'   = ดูอย่างเดียว (ทุกหน้า) แก้ไม่ได้
-- รันซ้ำได้ปลอดภัย
-- ============================================================

alter table trip_invites add column if not exists permission text default 'edit';
alter table trip_members add column if not exists permission text default 'edit';

-- ---- helper functions (security definer) ----
create or replace function can_edit_trip(tid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from trips where id = tid and owner_id = auth.uid())
      or exists (select 1 from trip_members where trip_id = tid and user_id = auth.uid()
                 and coalesce(permission, 'edit') = 'edit');
$$;

create or replace function can_view_full(tid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from trips where id = tid and owner_id = auth.uid())
      or exists (select 1 from trip_members where trip_id = tid and user_id = auth.uid()
                 and coalesce(permission, 'edit') in ('edit', 'view'));
$$;

-- ---- accept invites carrying their permission ----
create or replace function accept_my_invites()
returns void language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  for inv in select ti.* from trip_invites ti
    where lower(ti.email) = lower(coalesce(auth.jwt() ->> 'email','')) and ti.status = 'pending'
  loop
    insert into trip_members (trip_id, user_id, role, permission)
    values (inv.trip_id, auth.uid(), 'member', coalesce(inv.permission, 'edit'))
    on conflict (trip_id, user_id) do update set permission = excluded.permission;
    update trip_invites set status = 'accepted' where id = inv.id;
  end loop;
end;
$$;

-- ---- rewrite table policies: read vs write by permission ----
-- "full" tables: read needs can_view_full, write needs can_edit_trip
do $$
declare t text;
begin
  foreach t in array array['travelers','traveler_files','flights','hotels','itinerary_days','itinerary_stops','expenses']
  loop
    execute format('drop policy if exists %I on %I', t || ' - member', t);
    execute format('drop policy if exists %I on %I', 'rw_read', t);
    execute format('drop policy if exists %I on %I', 'rw_write', t);
    execute format('create policy "rw_read" on %I for select using (can_view_full(trip_id))', t);
    execute format('create policy "rw_write" on %I for all using (can_edit_trip(trip_id)) with check (can_edit_trip(trip_id))', t);
  end loop;
end $$;

-- places: any member can READ (incl. places-only); only editors WRITE
drop policy if exists "places - member" on places;
drop policy if exists "places_read" on places;
drop policy if exists "places_write" on places;
create policy "places_read"  on places for select using (is_trip_member(trip_id));
create policy "places_write" on places for all using (can_edit_trip(trip_id)) with check (can_edit_trip(trip_id));

-- place_interest: read any member, write editors
drop policy if exists "interest - member" on place_interest;
drop policy if exists "interest_read" on place_interest;
drop policy if exists "interest_write" on place_interest;
create policy "interest_read" on place_interest for select using (
  exists (select 1 from places p where p.id = place_id and is_trip_member(p.trip_id))
);
create policy "interest_write" on place_interest for all using (
  exists (select 1 from places p where p.id = place_id and can_edit_trip(p.trip_id))
) with check (
  exists (select 1 from places p where p.id = place_id and can_edit_trip(p.trip_id))
);

-- trips: the dashboard lists trips straight from this table, so EVERY member
-- (incl. 'places'/'view') must be able to READ the shared trip row — otherwise
-- shared trips never appear on a non-owner's dashboard (no card / no cover image
-- / wrong tab counts). Writing the trip row itself stays owner-only (unchanged).
drop policy if exists "trips_read_member" on trips;
create policy "trips_read_member" on trips for select using (
  owner_id = auth.uid() or is_trip_member(id)
);
