-- flight_status.sql — live flight status (delay / cancel / gate) on travel day.
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.
-- Filled in by the check-flight-status Edge Function (AeroDataBox); the app only
-- reads these. Full setup: supabase/FLIGHT_STATUS_SETUP.md

alter table public.flights add column if not exists live_status     text;        -- ontime | delayed | cancelled | diverted | departed | arrived
alter table public.flights add column if not exists live_delay_min  integer;     -- departure delay in minutes (when delayed)
alter table public.flights add column if not exists live_dep_time   text;        -- revised departure "HH:MM" (local)
alter table public.flights add column if not exists live_arr_time   text;        -- revised arrival "HH:MM" (local)
alter table public.flights add column if not exists live_gate       text;
alter table public.flights add column if not exists live_terminal   text;
alter table public.flights add column if not exists live_checked_at timestamptz; -- last poll time

-- make sure the flights table broadcasts realtime changes (no-op if already added)
do $$
begin
  alter publication supabase_realtime add table public.flights;
exception when duplicate_object then null;
end $$;
