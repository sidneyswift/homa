-- Migration #85: sandbox (test) families, founder ask 2026-07-14.
--
-- The founder rehearses the product by signing up real families with a
-- reserved email alias (anything+homatest...@). This flag makes those
-- families first-class citizens of the fence: labeled in the console,
-- excluded from funnels and the physical thank-you card sweep, and
-- deletable from the family file. Additive-only, safe to lead the
-- deploy: no policy, constraint, or existing column changes.
--
-- The flag is set server-side at signup (attachAuthUser matches the
-- alias) or by the founder's own console action; it never arrives from
-- model or client choice, so the tenancy law is untouched.

alter table public.families
  add column if not exists sandbox boolean not null default false;

comment on column public.families.sandbox is
  'True for founder test families (reserved +homatest email alias or a console action). Fenced out of funnels, digests, and physical mail; deletable from the founder console.';

-- Backfill: nothing to backfill; existing test families get marked by
-- hand from the console, where a wrong guess is visible and reversible.
