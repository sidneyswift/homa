-- Migration #51: family invites (multi-parent plan Phase 3, NT-4 v0).
-- The join path signup never had: one adult invites another by email,
-- inbox possession of the tokenized link is the proof (the same trust
-- basis as phone_link_requests), and accepting inserts a family_members
-- row instead of creating a second family. Deny-all like every token
-- table: server routes on the server-only connection are the only door.

create table if not exists public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- The inviting adult, for audit. No FK on purpose: account deletion
  -- must never cascade into losing the invite record (family_phones
  -- posture).
  invited_by uuid,
  email text not null,
  role text not null default 'parent' check (role in ('parent', 'partner', 'helper')),
  token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  consumed_at timestamptz,
  consumed_by uuid,
  constraint family_invites_email_lowercase check (email = lower(email))
);

create index if not exists family_invites_token_idx on public.family_invites (token_hash);
create index if not exists family_invites_family_idx on public.family_invites (family_id);
create index if not exists family_invites_email_idx on public.family_invites (email);

alter table public.family_invites enable row level security;

-- No policies on purpose: deny-all for every Data API role, belt and
-- braces with revoked privileges, same as the token tables.
revoke all on table public.family_invites from anon, authenticated;
