-- Layer 1: Signal Classification
-- Classifies conversation signals (bugs, feature requests, confusion, etc.)
-- Admin-only surface, no client reads.

create table public.conversation_signals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  session_id text not null,
  message_id uuid references public.conversation_messages(id),
  signal_type text not null check (
    signal_type in (
      'bug', 'feature_request', 'confusion', 'delight',
      'churn_risk', 'knowledge_gap', 'repeated_ask'
    )
  ),
  confidence float not null check (confidence >= 0 and confidence <= 1),
  evidence text not null,
  created_at timestamptz not null default now()
);

create index idx_conversation_signals_family on public.conversation_signals (family_id);
create index idx_conversation_signals_type on public.conversation_signals (signal_type);
create index idx_conversation_signals_created on public.conversation_signals (created_at);

alter table public.conversation_signals enable row level security;
