-- expense_extras.sql
-- Expense-tracker fields for the Budget page: a spending CATEGORY (food /
-- transport / hotel / shopping / ticket / other) and a per-expense CURRENCY
-- code (THB when omitted). Run once in the Supabase SQL editor. Safe to re-run.
-- The app degrades gracefully before this runs (columns are stripped on error).

alter table expenses add column if not exists category text;
alter table expenses add column if not exists currency text;
-- the date the money was spent (YYYY-MM-DD); the Budget page groups + filters by
-- it. Falls back to the row's created_at date when null.
alter table expenses add column if not exists spent_on date;
