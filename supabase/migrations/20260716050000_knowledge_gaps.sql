-- Layer 5: Knowledge Compounding
-- Closes the knowledge gap -> research -> answer loop.
-- Admin-only surface, no client reads.

create table public.knowledge_gaps (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  query_text text not null,
  family_id uuid references public.families(id),
  source text not null check (
    source in ('recall_miss', 'signal', 'manual')
  ),
  status text not null default 'open' check (
    status in ('open', 'researching', 'filled', 'stale')
  ),
  filled_by_knowledge_id uuid,
  research_priority int not null default 0,
  created_at timestamptz not null default now(),
  filled_at timestamptz
);

create index idx_knowledge_gaps_status_priority on public.knowledge_gaps (status, research_priority desc);

alter table public.knowledge_gaps enable row level security;
