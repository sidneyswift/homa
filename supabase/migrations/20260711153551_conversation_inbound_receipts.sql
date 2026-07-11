-- Durable provider-webhook claims. The claim happens before Eve starts, so a
-- duplicate SMS/email webhook cannot repeat tools, writes, or replies.

create table if not exists public.conversation_inbound_receipts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families (id) on delete cascade,
  channel text not null check (channel in ('sms', 'email')),
  provider_message_id text not null,
  status text not null default 'claimed'
    check (status in ('claimed', 'completed', 'failed')),
  runtime_session_id text,
  claimed_at timestamptz not null default now(),
  completed_at timestamptz,
  failed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, provider_message_id)
);

create index if not exists conversation_inbound_receipts_family_idx
  on public.conversation_inbound_receipts (family_id, created_at desc)
  where family_id is not null;
create index if not exists conversation_inbound_receipts_stale_idx
  on public.conversation_inbound_receipts (claimed_at)
  where status = 'claimed';

alter table public.conversation_inbound_receipts enable row level security;
revoke all on table public.conversation_inbound_receipts
  from public, anon, authenticated;
