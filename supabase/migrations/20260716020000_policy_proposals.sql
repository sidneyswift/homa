-- Layer 2: Policy Layer
-- Self-modifying policy system with founder approval gates.
-- Admin-only surface, no client reads.

create table public.system_policies (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  title text not null,
  body_md text,
  autonomy_level text not null check (
    autonomy_level in ('observe', 'pr_only', 'auto_merge_green', 'full_auto')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.policy_proposals (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null,
  proposed_by text not null check (
    proposed_by in ('night_manager', 'signal_pattern', 'manual')
  ),
  rationale text not null,
  current_value text,
  proposed_value text not null,
  evidence jsonb,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'applied')
  ),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.system_policies enable row level security;
alter table public.policy_proposals enable row level security;
