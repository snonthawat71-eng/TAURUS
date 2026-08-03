-- ============================================================================
--  Admin-curated country pages ("สถานที่ยอดฮิต <ประเทศ>")
--
--  Run once in the Supabase SQL Editor. Safe to re-run.
--
--  The country page stops being a computed ranking and becomes something the
--  site owner lays out: a cover, then any number of banner blocks, each with
--  its own artwork and its own hand-picked list of places. Countries nobody has
--  laid out yet keep the automatic behaviour, so nothing goes blank.
-- ============================================================================

-- ── who may edit ────────────────────────────────────────────────────────────
alter table profiles add column if not exists is_admin boolean not null default false;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from profiles p where p.id = auth.uid()), false)
$$;

-- Nobody promotes themselves from the app: the client CAN update its own
-- profile row, so the flag is pinned back unless an admin is making the change.
--
-- `auth.uid() is not null` is what makes granting the FIRST admin possible: a
-- statement from the SQL editor has no JWT, so it is let through. Triggers run
-- for the service role too — without this test the very grant this file tells
-- you to run was silently reverted. Anonymous requests can't reach here: RLS on
-- profiles already requires auth.uid() = id.
create or replace function guard_is_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null
     and not is_admin() then
    new.is_admin := old.is_admin;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_is_admin on profiles;
create trigger profiles_guard_is_admin before update on profiles
  for each row execute function guard_is_admin();

-- ── the page ────────────────────────────────────────────────────────────────
create table if not exists country_pages (
  country      text primary key,             -- canonical name, e.g. 'Hong Kong'
  title        text,                         -- heading; null = the default one
  eyebrow      text,                         -- the small line above it
  cover_url    text,
  published    boolean not null default false,
  show_recent  boolean not null default true, -- the automatic "เพิ่งเพิ่มล่าสุด" rail
  show_cities  boolean not null default true, -- the automatic per-city rails
  updated_at   timestamptz not null default now()
);

-- ── the banner blocks (การ์ดหมวด) ───────────────────────────────────────────
create table if not exists country_blocks (
  id           uuid primary key default gen_random_uuid(),
  country      text not null references country_pages(country) on delete cascade,
  title        text not null default '',
  image_url    text,
  -- 'list'    → tapping opens this block's own places on the country page
  -- 'explore' → tapping opens Explore with the filter below applied
  action       text not null default 'list',
  filter_group text,                          -- 'place' | 'food'
  filter_cat   text,                          -- a category key, or null
  filter_city  text,
  position     int not null default 0,
  published    boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists country_blocks_country_idx on country_blocks (country, position);

-- ── the places inside a block, in the admin's own order ─────────────────────
create table if not exists country_block_places (
  block_id   uuid not null references country_blocks(id) on delete cascade,
  explore_id uuid not null references explore_places(id) on delete cascade,
  position   int not null default 0,
  primary key (block_id, explore_id)
);
create index if not exists country_block_places_block_idx on country_block_places (block_id, position);

-- ── who can see what ────────────────────────────────────────────────────────
alter table country_pages        enable row level security;
alter table country_blocks       enable row level security;
alter table country_block_places enable row level security;

drop policy if exists country_pages_read  on country_pages;
drop policy if exists country_pages_write on country_pages;
create policy country_pages_read on country_pages
  for select using (published or is_admin());
create policy country_pages_write on country_pages
  for all using (is_admin()) with check (is_admin());

drop policy if exists country_blocks_read  on country_blocks;
drop policy if exists country_blocks_write on country_blocks;
create policy country_blocks_read on country_blocks
  for select using (
    is_admin() or (
      published and exists (
        select 1 from country_pages p
        where p.country = country_blocks.country and p.published
      )
    )
  );
create policy country_blocks_write on country_blocks
  for all using (is_admin()) with check (is_admin());

drop policy if exists country_block_places_read  on country_block_places;
drop policy if exists country_block_places_write on country_block_places;
create policy country_block_places_read on country_block_places
  for select using (
    is_admin() or exists (
      select 1 from country_blocks b
      join country_pages p on p.country = b.country
      where b.id = country_block_places.block_id and b.published and p.published
    )
  );
create policy country_block_places_write on country_block_places
  for all using (is_admin()) with check (is_admin());

-- ── live updates ────────────────────────────────────────────────────────────
-- a published change shows up without a reload for anyone with the page open
do $$
begin
  begin execute 'alter publication supabase_realtime add table country_pages'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table country_blocks'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table country_block_places'; exception when others then null; end;
end $$;

-- ============================================================================
--  MAKE YOURSELF AN ADMIN — run this too, with your own email:
--
--    update profiles set is_admin = true
--    where id = (select id from auth.users where email = 's.nonthawat71@gmail.com');
-- ============================================================================
