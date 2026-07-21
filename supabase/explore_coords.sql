-- explore_coords.sql
-- Give Explore pool items a SINGLE shared coordinate, so every trip that saves
-- an item inherits the same pin instead of independently re-geocoding it (which
-- made the same place land at different spots across trips). Run once in the
-- Supabase SQL editor. Safe to re-run.

-- 1) coordinate columns on the Explore pool
alter table explore_places add column if not exists lat double precision;
alter table explore_places add column if not exists lng double precision;

-- 2) backfill each item's coordinate from its MOST RECENT saved copy (the
--    newest copy was resolved with the latest pin-accuracy fixes)
update explore_places e
set lat = c.lat, lng = c.lng
from (
  select distinct on (source_explore_id) source_explore_id, lat, lng
  from places
  where source_explore_id is not null and lat is not null and lng is not null
  order by source_explore_id, created_at desc
) c
where e.id = c.source_explore_id and e.lat is null;

-- 3) converge every EXISTING copy onto its item's coordinate and LOCK it
--    (pinned = the map trusts lat/lng, no re-geocode drift) — but KEEP each
--    copy's map_url so navigation still follows the real link. Needs pinned.sql.
--    After this, all copies of an item sit on the identical spot.
alter table places add column if not exists pinned boolean not null default false;
update places p
set lat = e.lat,
    lng = e.lng,
    pinned = true
from explore_places e
where p.source_explore_id = e.id
  and e.lat is not null and e.lng is not null;
