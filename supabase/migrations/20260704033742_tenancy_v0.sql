-- Migration #2: tenancy schema v0 (M0-05). families / family_members / children.
-- Laws enforced here (docs/homa-planning/01-architecture.md):
--   1. RLS deny-by-default on every table; policies grant only family-scoped access.
--   2. familyId in app code comes from auth context only, never from model output.
-- Family creation is a server-side concern (FR-1, invite flow) and gets its own
-- policies when it lands; until then only reads are granted to members.

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My family',
  us_state text,
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'parent' check (role in ('parent', 'partner', 'helper')),
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null,
  -- Day is always 01: age-band math needs month + year only, and a full DOB is
  -- data we chose not to hold (journeys/02 part 2).
  birth_month date not null,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index children_family_id_idx on public.children (family_id);
create index family_members_user_id_idx on public.family_members (user_id);

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.children enable row level security;

-- Membership lookup shared by every family-scoped policy. SECURITY DEFINER so
-- the check itself does not recurse through RLS on family_members.
create or replace function public.is_family_member(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_members m
    where m.family_id = fid
      and m.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_family_member(uuid) from anon;

create policy "members read their family"
  on public.families
  for select
  to authenticated
  using (public.is_family_member(id));

create policy "members read their own memberships"
  on public.family_members
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "members read their children"
  on public.children
  for select
  to authenticated
  using (public.is_family_member(family_id));

create policy "members add children"
  on public.children
  for insert
  to authenticated
  with check (public.is_family_member(family_id));

create policy "members update their children"
  on public.children
  for update
  to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));
