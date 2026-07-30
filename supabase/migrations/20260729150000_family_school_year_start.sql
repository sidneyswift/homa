-- The day a family's school year starts (gh#418, the filing service).
--
-- Only 14 of the 39 states that require a filing name a date in law. The
-- other 25 count from the day THAT family began homeschooling ("within
-- 30 days of starting"), so their deadline is unknowable until the
-- family says when they started. Founder ruling 2026-07-29: ask each
-- family once rather than guess, because a family told the wrong date
-- and filing late is worse off than one Homa stayed quiet about.
--
-- Stored as the real date the family gives. Its month and day are the
-- recurring pattern: schoolYearStartFor resolves the most recent
-- anniversary on or before today, so the answer keeps working in later
-- years without the family re-entering it.
--
-- Additive-only, safe to lead the deploy: nullable, no default, no
-- policy or constraint change. Null means never asked, which every
-- caller must treat as "ask" rather than as a guessable value.

alter table public.families
  add column if not exists school_year_start_on date;

comment on column public.families.school_year_start_on is
  'The day this family starts their school year, as they reported it. Month and day recur; the year is when they first told us. Null means never asked. Drives filing deadlines in the 25 states whose rule counts from the family start (gh#418).';
