-- pinned.sql
-- Lock a place's coordinate WITHOUT overwriting its map_url. Previously a
-- hand-fixed / Explore-shared pin was locked by stamping the coordinate into
-- map_url — but that destroyed the user's real link, so "นำทาง" opened a bare
-- coordinate instead of the actual place. Now the coordinate lives in lat/lng
-- and `pinned=true` tells the map to trust it (no re-geocode), while map_url
-- keeps the original link for navigation. Run once in the Supabase SQL editor.

alter table places add column if not exists pinned boolean not null default false;
