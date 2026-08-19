-- onboarding.sql
-- Show the profile-setup screen ONCE to a brand-new signup (right after they
-- confirm their email), never to existing users. A boolean flag on the profile
-- drives it.
--
-- ⚠️ RUN THIS FILE ONLY ONCE. The ALTER is always safe to re-run, but the
-- backfill UPDATE is not: re-running it later would mark accounts that signed
-- up AFTER the first run (but haven't finished setup yet) as onboarded, so
-- they'd silently skip the setup screen.

-- new accounts default to NOT onboarded → they get the setup screen (safe to re-run)
alter table public.profiles
  add column if not exists onboarded boolean not null default false;

-- ONE-TIME backfill: everyone who already exists has been using the app →
-- mark them onboarded so only future signups see the setup screen
update public.profiles set onboarded = true where onboarded = false;
