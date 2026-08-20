-- Native onboarding resume state (mobile onboarding v1, plan
-- docs/homa-planning/plans/2026-08-18-mobile-onboarding-v1-plan.md).
--
-- The flow's law is pausable-everywhere: every answer is durable the
-- moment it is given, and re-entry lands on the exact screen the parent
-- left with her words still there. This row is that memory. It is
-- working state for the walk itself, one row per family; the real
-- product records (children, materials) land in their own tables as
-- the flow writes them, never here. Additive only; nothing reads it yet.

create table if not exists public.mobile_onboarding_state (
  family_id uuid primary key references public.families (id) on delete cascade,
  step text not null
    check (step in ('door', 'hello', 'intent', 'kids', 'making', 'reveal', 'next')),
  -- Draft answers for the current walk: intent pick plus per-kid draft
  -- cards not yet written as children. Bounded so a runaway client
  -- cannot grow the row.
  answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(answers) = 'object')
    check (char_length(answers::text) <= 20000),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mobile_onboarding_state enable row level security;

create policy "members read their onboarding state"
  on public.mobile_onboarding_state
  for select
  to authenticated
  using (public.is_family_member(family_id));

create policy "members write their onboarding state"
  on public.mobile_onboarding_state
  for insert
  to authenticated
  with check (public.is_family_member(family_id));

create policy "members update their onboarding state"
  on public.mobile_onboarding_state
  for update
  to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));
