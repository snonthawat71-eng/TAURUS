-- lock_explore_coord.sql
-- One person fixing a place's pin should correct it for EVERYONE. A plain client
-- UPDATE can only touch the caller's own trips (Row-Level Security), so a fix
-- never reached other users' copies or the shared Explore source. This
-- SECURITY DEFINER function runs with the definer's rights, so a single call
-- writes the new coordinate to the Explore item AND every saved copy in every
-- trip (all users) at once. Run once in the Supabase SQL editor. Safe to re-run.
--
-- Needs the coordinate columns from explore_coords.sql / pinned.sql:
--   explore_places.lat / lng, places.lat / lng / pinned

create or replace function public.lock_explore_coord(
  p_explore_id uuid,
  p_lat double precision,
  p_lng double precision
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- ignore obviously bad input (keeps a stray call from nuking coordinates)
  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    return;
  end if;

  -- the shared source → future saves + other users inherit this pin
  update public.explore_places
     set lat = p_lat, lng = p_lng
   where id = p_explore_id;

  -- every existing copy in every trip → lock it (pinned) so the map trusts it
  -- and never re-geocodes, while KEEPING each copy's map_url for navigation
  update public.places
     set lat = p_lat, lng = p_lng, pinned = true
   where source_explore_id = p_explore_id;
end;
$$;

-- any signed-in user can lock a coordinate they've verified (it's a shared,
-- low-risk correction; re-lockable if someone gets it wrong)
grant execute on function public.lock_explore_coord(uuid, double precision, double precision) to authenticated;
