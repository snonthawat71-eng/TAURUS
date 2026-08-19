-- concurrency.sql — optimistic locking for the collaborative tables.
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.
--
-- Adds a `version` column that auto-increments on every UPDATE. The web app
-- sends the version it loaded each time it saves an edit (.eq('version', n));
-- if the row was changed by a teammate in the meantime the update matches 0
-- rows and the app shows a "someone edited this first" notice instead of
-- silently overwriting their change. Until this migration is run the app simply
-- skips the check (graceful degradation — see src/lib/concurrency.ts).

-- 1. version columns
alter table public.itinerary_stops add column if not exists version integer not null default 0;
alter table public.itinerary_days  add column if not exists version integer not null default 0;
alter table public.places          add column if not exists version integer not null default 0;
alter table public.expenses        add column if not exists version integer not null default 0;

-- 2. trigger function: bump version on every meaningful UPDATE.
-- Position-only writes (drag reorders touch every row in the day) are excluded —
-- they don't change content, and bumping on them would spuriously invalidate any
-- teammate's in-flight edit ("someone edited this first" with nothing edited).
create or replace function public.bump_version()
returns trigger language plpgsql as $$
begin
  if (to_jsonb(new) - 'version' - 'position') is distinct from (to_jsonb(old) - 'version' - 'position') then
    new.version := coalesce(old.version, 0) + 1;
  else
    new.version := coalesce(old.version, new.version);
  end if;
  return new;
end;
$$;

-- 3. attach the trigger to each table (drop first so re-running is safe)
drop trigger if exists trg_bump_version on public.itinerary_stops;
create trigger trg_bump_version before update on public.itinerary_stops
  for each row execute function public.bump_version();

drop trigger if exists trg_bump_version on public.itinerary_days;
create trigger trg_bump_version before update on public.itinerary_days
  for each row execute function public.bump_version();

drop trigger if exists trg_bump_version on public.places;
create trigger trg_bump_version before update on public.places
  for each row execute function public.bump_version();

drop trigger if exists trg_bump_version on public.expenses;
create trigger trg_bump_version before update on public.expenses
  for each row execute function public.bump_version();
