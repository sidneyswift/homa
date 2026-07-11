-- Migration #55: full birthdays, product-wide (founder ruling 2026-07-11: "we should
-- get the full data so we know how old the kid is"). This restores the
-- 2026-07-06 "get the actual birthday" ruling and retires the month-only
-- convention the 2026-07-08 onboarding-card unification reintroduced.
--
-- No shape change: children.birth_month and lead_children.birth_month
-- were always full `date` columns, and the map claim path has written
-- real days since 2026-07-06. What changes is policy: every intake form
-- (web onboarding, /app/settings, SMS signup, mobile) now collects
-- month, day, and year, and age math is day-precise everywhere.
-- Rows saved under the old convention keep day 01 and read exactly as
-- before; their real day can be filled in whenever a parent edits.
--
-- The column comment below overrides the "day is always 01" comments in
-- migrations #2 and #16, which are left untouched as applied history
-- (#16's lead_children no longer exists in prod; the lead flow writes
-- public.children directly). Column name stays birth_month: a rename is
-- a breaking migration with no behavior payoff.

comment on column public.children.birth_month is
  'The child''s full birthday (YYYY-MM-DD). Founder ruling 2026-07-11: full DOB is collected; rows from the 2026-07-08 to 2026-07-11 month-only window have day 01.';
