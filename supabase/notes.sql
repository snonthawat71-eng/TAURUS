-- Trip notes & to-do lists — the pull-out panel (right screen edge).
-- Each row is ONE topic (a note or a checklist), owned by one user and PRIVATE
-- by default. Turning `shared` on makes it visible to everyone on the trip.
-- Only the owner can edit/delete their own rows.
--
-- Idempotent: safe to run again to upgrade an older install.

create table if not exists public.trip_notes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  author_name text,
  author_color text,
  kind text not null default 'note',          -- 'note' | 'todo'
  title text,
  body text,                                   -- note text (kind = 'note')
  items jsonb,                                 -- checklist [{id,text,done}] (kind = 'todo')
  status text not null default 'draft',        -- draft | in_progress | in_review | completed
  shared boolean not null default false,       -- false = private to the owner
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- upgrade older installs (first version only had body/author_*)
alter table public.trip_notes add column if not exists kind text not null default 'note';
alter table public.trip_notes add column if not exists title text;
alter table public.trip_notes add column if not exists items jsonb;
alter table public.trip_notes add column if not exists status text not null default 'draft';
alter table public.trip_notes add column if not exists shared boolean not null default false;
alter table public.trip_notes alter column body drop not null; -- to-dos carry no body

create index if not exists trip_notes_trip_idx on public.trip_notes(trip_id, created_at desc);

alter table public.trip_notes enable row level security;

-- read: my own rows always; other people's only when they shared them to the trip
drop policy if exists trip_notes_select on public.trip_notes;
create policy trip_notes_select on public.trip_notes for select using (
  user_id = auth.uid()
  or (shared and (
    exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
    or exists (select 1 from public.trip_members m where m.trip_id = trip_notes.trip_id and m.user_id = auth.uid())
  ))
);

-- write: only on the trips I belong to, and only as myself
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
create policy trip_notes_delete on public.trip_notes for delete using (user_id = auth.uid());
