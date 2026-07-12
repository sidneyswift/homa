-- Layer 4: Learning Loop, Skill Evolution
-- Detects patterns and evolves Eve's skills automatically.
-- Admin-only surface, no client reads.

create table public.signal_patterns (
  id uuid primary key default gen_random_uuid(),
  signal_type text not null,
  pattern_description text not null,
  family_count int not null default 0,
  occurrence_count int not null default 0,
  sample_evidence jsonb,
  status text not null default 'detected' check (
    status in ('detected', 'skill_drafted', 'skill_merged', 'dismissed')
  ),
  detected_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.skill_evolution_log (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid not null references public.signal_patterns(id),
  skill_name text not null,
  change_type text not null check (
    change_type in ('create', 'update', 'instruction_update')
  ),
  diff_summary text,
  pr_url text,
  status text not null default 'drafted' check (
    status in ('drafted', 'proposed', 'merged', 'rejected')
  ),
  created_at timestamptz not null default now()
);

create table public.response_engagement (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  session_id text not null,
  message_id uuid references public.conversation_messages(id),
  engagement_type text not null check (
    engagement_type in ('positive', 'negative', 'neutral')
  ),
  indicator text not null,
  created_at timestamptz not null default now()
);

create index idx_response_engagement_family on public.response_engagement (family_id);

alter table public.signal_patterns enable row level security;
alter table public.skill_evolution_log enable row level security;
alter table public.response_engagement enable row level security;
