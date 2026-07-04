-- Migration #1: waitlist capture + event log (BUILD.md Deliverable 0, MJ-08 foundation).
-- Posture: public web traffic is WRITE-ONLY. The anon role may insert a pending
-- waitlist row and waitlist-scoped events, and can never read, update, or delete.
-- Emails are normalized to lowercase in the app layer before insert.

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'organic'
    check (source in ('conference', 'referral', 'organic', 'social', 'other')),
  utm jsonb not null default '{}'::jsonb,
  us_state text,
  kid_age_bands text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'invited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint waitlist_email_lowercase check (email = lower(email)),
  constraint waitlist_email_key unique (email)
);

alter table public.waitlist enable row level security;

create policy "public can join the waitlist"
  on public.waitlist
  for insert
  to anon
  with check (status = 'pending');

-- Typed event log (MJ-08). Product features must emit events; pre-signup web
-- events have no family and are restricted to the waitlist.* namespace.
create table public.events (
  id bigint generated always as identity primary key,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  family_id uuid,
  created_at timestamptz not null default now()
);

create index events_name_created_at_idx on public.events (name, created_at);

alter table public.events enable row level security;

create policy "public may emit waitlist events only"
  on public.events
  for insert
  to anon
  with check (name like 'waitlist.%' and family_id is null);
