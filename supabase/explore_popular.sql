-- ============================================================
-- TAURUS — Explore popularity: track clicks (views) & saves so the app can
-- flag "POPULAR" items (combined with likes & comments). Run in Supabase SQL
-- editor. Safe to re-run.
-- ============================================================
create table if not exists explore_events (
  id          uuid primary key default gen_random_uuid(),
  explore_id  uuid references explore_places on delete cascade,
  user_id     uuid references auth.users on delete set null,
  kind        text not null,            -- 'view' | 'save'
  created_at  timestamptz default now()
);

create index if not exists explore_events_explore_idx on explore_events (explore_id);

alter table explore_events enable row level security;

drop policy if exists "explore events read"   on explore_events;
drop policy if exists "explore events insert" on explore_events;
create policy "explore events read"   on explore_events for select using (auth.uid() is not null);
create policy "explore events insert" on explore_events for insert with check (auth.uid() = user_id);

-- realtime so the POPULAR ranking can update live (idempotent)
do $$
begin
  begin alter publication supabase_realtime add table explore_events; exception when duplicate_object then null; end;
end $$;
