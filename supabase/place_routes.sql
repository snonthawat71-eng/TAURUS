-- Multiple ways to reach a saved place (Places / Food & Cafe), mirroring the
-- explore_places.routes column. Each entry is { line, color, station }.
-- The primary route is still mirrored into station_line/station_color/station_name
-- so existing cards keep working. Optional column — apply in the Supabase SQL
-- editor; the app degrades gracefully if it's missing.
alter table places add column if not exists routes jsonb;
