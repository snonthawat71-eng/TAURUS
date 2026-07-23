-- onboarding.sql
-- Show the profile-setup screen ONCE to a brand-new signup (right after they
-- confirm their email), never to existing users. A boolean flag on the profile
-- drives it. Run once in the Supabase SQL editor. Safe to re-run.

-- new accounts default to NOT onboarded → they get the setup screen
alter table public.profiles
  add column if not exists onboarded boolean not null default false;

-- everyone who already exists has been using the app → mark them onboarded so
-- only future signups (created after this runs) see the setup screen
update public.profiles set onboarded = true where onboarded = false;
