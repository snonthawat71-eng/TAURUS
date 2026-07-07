-- Shared trip notes — the pull-out note panel (right screen edge).
-- Any trip member can read & add notes; everyone edits/deletes their own
-- (the trip owner can also delete anyone's).

create table if not exists public.trip_notes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  author_name text,
  author_color text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_notes_trip_idx on public.trip_notes(trip_id, created_at desc);

alter table public.trip_notes enable row level security;

drop policy if exists trip_notes_select on public.trip_notes;
create policy trip_notes_select on public.trip_notes for select using (
  exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
  or exists (select 1 from public.trip_members m where m.trip_id = trip_notes.trip_id and m.user_id = auth.uid())
);

drop policy if exists trip_notes_insert on public.trip_notes;
create policy trip_notes_insert on public.trip_notes for insert with check (
  user_id = auth.uid() and (
    exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
    or exists (select 1 from public.trip_members m where m.trip_id = trip_notes.trip_id and m.user_id = auth.uid())
  )
);

drop policy if exists trip_notes_update on public.trip_notes;
create policy trip_notes_update on public.trip_notes for update using (user_id = auth.uid());

drop policy if exists trip_notes_delete on public.trip_notes;
create policy trip_notes_delete on public.trip_notes for delete using (
  user_id = auth.uid()
  or exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
);
