-- Migration #25: the family texting line (founder decisions 2026-07-07, build-log):
-- one phone number per family, captured optionally at signup or on /home,
-- trusted as typed (verification deliberately skipped for cohort one,
-- founder call), and used by the Telnyx SMS channel to resolve an inbound
-- text to its family.
--
-- Posture: deny-all, exactly like the lead_* tables (migration #7). The
-- number is the key that routes a texter INTO a family's context, so no
-- Data API role may read or write it; every access goes through server
-- routes on the server-only connection. One row per family (unique) keeps
-- cohort one simple; multi-number later is just dropping that constraint.
-- The number itself is unique across ALL families because an inbound text
-- must resolve to exactly one family, never two.

create table public.family_phones (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- Canonical +1XXXXXXXXXX (US only for cohort one), normalized in code.
  phone_e164 text not null,
  -- The auth user who typed it, for auditability. No FK to auth.users on
  -- purpose: account deletion must never cascade into losing the row.
  added_by uuid,
  -- Where the number came from: the signup form, the /home card, or the
  -- lead bridge copying it forward at workspace creation.
  source text not null default 'home'
    check (source in ('signup', 'home', 'bridge')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_phones_e164_shape check (phone_e164 ~ '^\+1\d{10}$'),
  constraint family_phones_number_key unique (phone_e164),
  constraint family_phones_one_per_family unique (family_id)
);

alter table public.family_phones enable row level security;

-- No policies on purpose: deny-all for every Data API role, belt and
-- braces with revoked privileges, same as the lead tables.
revoke all on table public.family_phones from anon, authenticated;

-- Signup-time capture lands before any family exists, so the lead row
-- carries the number until the bridge copies it into family_phones.
-- Nullable, not unique: leads are messy and duplicates are tolerable
-- here; uniqueness is enforced where it matters, on family_phones.
alter table public.lead_families
  add column phone_e164 text
  constraint lead_families_phone_shape check (phone_e164 is null or phone_e164 ~ '^\+1\d{10}$');
