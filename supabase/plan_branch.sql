-- Multi-branch places: remember WHICH branch was picked when the place was
-- added to the plan, so map links / stations point at that branch (not the
-- main location). NULL = the place's own/main location.
-- Run once in the Supabase SQL Editor. The app degrades gracefully without it
-- (branch choice just isn't remembered).

alter table places add column if not exists plan_branch smallint;
