-- notif_state.sql
-- Server-side read-state for Explore notifications, so "already opened" survives
-- a re-login or a switch to another device (it used to live only in each
-- device's localStorage, which is why read notifications kept coming back).
-- One row per user: the last time they cleared the bell (seen_at) + the ids of
-- notifications they've opened (read_ids). Run once in the Supabase SQL editor.

create table if not exists notif_state (
  user_id    uuid primary key,
  seen_at    timestamptz,
  read_ids   text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table notif_state enable row level security;

-- each user sees and writes ONLY their own row
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'notif_state' and policyname = 'notif_state own select') then
    create policy "notif_state own select" on notif_state for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'notif_state' and policyname = 'notif_state own insert') then
    create policy "notif_state own insert" on notif_state for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'notif_state' and policyname = 'notif_state own update') then
    create policy "notif_state own update" on notif_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
