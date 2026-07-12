-- Layer 3: Quality Loop (Eval Suite)
-- Closes the signal -> fix -> re-measure -> confirm loop.
-- Admin-only surface, no client reads.

create table public.eval_results (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references public.conversation_signals(id),
  fix_description text,
  fix_commit text,
  eval_type text not null check (
    eval_type in ('signal_resolved', 'regression_check', 'effectiveness')
  ),
  pre_fix_state jsonb,
  post_fix_state jsonb,
  resolved boolean,
  confidence float,
  evaluated_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.fix_effectiveness (
  id uuid primary key default gen_random_uuid(),
  fix_id uuid not null references public.eval_results(id),
  signal_type text not null,
  recurrence_count int not null default 0,
  days_monitored int not null default 0,
  effectiveness_score float,
  last_checked_at timestamptz
);

alter table public.eval_results enable row level security;
alter table public.fix_effectiveness enable row level security;
