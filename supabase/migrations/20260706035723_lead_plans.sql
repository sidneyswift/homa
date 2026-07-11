-- Migration #11: four-week plans + the retest loop (founder: build it now).
-- A plan is a deterministic four-week program for one subject of one child,
-- built from the bank around the child's frontier, flavored by their
-- interests and the family's homeschool style. retest_at arms the cron's
-- retest-week email, which routes back into the subject's deep dive so the
-- numbers can visibly move. Same deny-all posture as migrations #7 and #8.

create table public.lead_plans (
  id uuid primary key default gen_random_uuid(),
  lead_child_id uuid not null references public.lead_children (id) on delete cascade,
  domain_id text not null,
  plan jsonb not null,
  bank_version text not null,
  created_at timestamptz not null default now(),
  retest_at timestamptz not null,
  retest_emailed_at timestamptz,
  constraint lead_plans_child_domain_key unique (lead_child_id, domain_id)
);

create index lead_plans_retest_idx on public.lead_plans (retest_at) where retest_emailed_at is null;

alter table public.lead_plans enable row level security;
revoke all on table public.lead_plans from anon, authenticated;
