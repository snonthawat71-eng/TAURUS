-- Map pin coordinates for places. Optional — filled from the place's map link,
-- geocoding, or a manual pick (see src/lib/geo.ts). Safe to run more than once.
alter table public.places add column if not exists lat double precision;
alter table public.places add column if not exists lng double precision;
