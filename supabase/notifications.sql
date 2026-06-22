-- notifications.sql — Web Push reminders for itinerary stops.
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.
-- See supabase/PUSH_SETUP.md for the full setup (VAPID keys, Edge Function, cron).

-- 1) Each device's push subscription + the user's preferred lead time.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  lead_minutes integer not null default 30,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- users manage only their own subscriptions
drop policy if exists "push own select" on public.push_subscriptions;
create policy "push own select" on public.push_subscriptions for select using (auth.uid() = user_id);
drop policy if exists "push own insert" on public.push_subscriptions;
create policy "push own insert" on public.push_subscriptions for insert with check (auth.uid() = user_id);
drop policy if exists "push own update" on public.push_subscriptions;
create policy "push own update" on public.push_subscriptions for update using (auth.uid() = user_id);
drop policy if exists "push own delete" on public.push_subscriptions;
create policy "push own delete" on public.push_subscriptions for delete using (auth.uid() = user_id);

-- 2) Dedupe table so a stop reminds each user at most once.
--    Only the service-role Edge Function touches it; RLS on with no policies
--    denies all client access.
create table if not exists public.sent_reminders (
  stop_id uuid not null,
  user_id uuid not null,
  sent_at timestamptz not null default now(),
  primary key (stop_id, user_id)
);
alter table public.sent_reminders enable row level security;

-- 3) Optional per-trip timezone used to interpret day_date + time. Defaults to
--    REMINDER_DEFAULT_TZ (Asia/Bangkok) in the Edge Function when null.
alter table public.trips add column if not exists timezone text;
