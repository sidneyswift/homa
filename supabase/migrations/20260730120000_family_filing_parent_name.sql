-- The parent's name as it should appear on a government filing (gh#424).
--
-- Deliberately NOT families.first_name/last_name and NOT the member
-- display name. Those are how Homa greets someone ("Hi Robin"), they are
-- written only by the signup and waitlist paths, and 48 of 90 real
-- families had no way to set them at all. A legal filing wants the name
-- a superintendent will read, which a parent may write differently from
-- what she wants to be called, so it gets its own column rather than
-- overloading a greeting into a legal claim.
--
-- Additive and nullable, so it may lead its deploy. Null means never
-- asked, and every caller must render a blank line rather than guess.
alter table public.families
  add column if not exists filing_parent_name text;

comment on column public.families.filing_parent_name is
  'Parent name for state filings (gh#424). Null means never collected; the filing renders a labeled blank rather than falling back to a greeting name.';
