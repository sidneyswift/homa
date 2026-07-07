-- Migration #16: email moves from required-at-start to required-at-signup
-- (founder call: "no email needed, sign up as the last question to create
-- an account and generate the report"). The lead now exists anonymously
-- from the very first tap (kids + checklist auto-save under a cookie-only
-- session), and email is captured once, right before the report is scored.
-- Same deny-all posture as migration #7: server routes only, RLS unchanged.

alter table public.lead_families
  drop constraint lead_families_email_key,
  drop constraint lead_families_email_lowercase;

alter table public.lead_families
  alter column email drop not null;

alter table public.lead_families
  add constraint lead_families_email_lowercase check (email is null or email = lower(email));

-- Partial: many anonymous rows share NULL, only real emails must be unique.
create unique index lead_families_email_key on public.lead_families (email)
  where email is not null;
