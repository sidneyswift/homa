-- The paid tier a family bought, separate from whether they're paying at
-- all (billing_exempt/trial_started/stripe_subscription_status already
-- answer that). Additive only: default 'regular' preserves every
-- existing row's behavior.
--
-- 'plus' and 'elite' are sellable today (Payment Links exist, see
-- lib/billing/wall.ts) ahead of their differentiating product work
-- (state filing support for plus; model/credit/queue tiering for elite).
-- This column is what lets that work land later without a second
-- migration: the tier a family already paid for is recorded now.
alter table public.families
  add column if not exists plan_tier text not null default 'regular'
    check (plan_tier in ('regular', 'plus', 'elite'));
