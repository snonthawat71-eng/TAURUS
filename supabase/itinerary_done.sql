-- Itinerary check-in: mark a stop as visited/done (shared across the trip).
-- Paste into the Supabase SQL editor and run once.
--
-- The app degrades gracefully without this: the check-in toggle works in the UI
-- but won't persist until these columns exist.

alter table public.itinerary_stops
  add column if not exists done    boolean not null default false,
  add column if not exists done_at timestamptz;
