-- Conversation continuity spine.
--
-- Root cause: Homa had one agent definition but no application-owned
-- conversation identity. Eve sessions were keyed by transport (web cursor,
-- phone pair, email address, dispatch task), while Postgres stored only a
-- family-scoped bag of messages. A visible SMS thread could therefore contain
-- an outbound dispatch message that the inbound SMS Eve session never saw.
--
-- This migration makes conversational causality first-class:
--   * episodes group one related thought across surfaces and Eve sessions;
--   * messages gain actor, visibility, origin, thread, and reply edges;
--   * deliveries record one outcome per intended adult/destination;
--   * open loops record typed questions/offers awaiting each recipient;
--   * bindings map transport/runtime threads onto the canonical episode.
--
-- Eve remains the durable execution engine. These rows are the product truth
-- that lets any new Eve session rehydrate the conversation safely.

create table if not exists public.conversation_episodes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  scope text not null default 'household'
    check (scope in ('household', 'member')),
  member_user_id uuid references auth.users (id) on delete set null,
  status text not null default 'open'
    check (status in ('open', 'closed')),
  summary text check (summary is null or char_length(summary) <= 4000),
  summary_version text,
  opened_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  check (scope = 'household' or member_user_id is not null)
);

create index if not exists conversation_episodes_family_activity_idx
  on public.conversation_episodes (family_id, last_activity_at desc);
create index if not exists conversation_episodes_member_activity_idx
  on public.conversation_episodes (member_user_id, last_activity_at desc)
  where member_user_id is not null;

alter table public.conversation_episodes enable row level security;

create policy "members read their conversation episodes"
  on public.conversation_episodes
  for select
  to authenticated
  using (public.is_family_member(family_id));

alter table public.conversation_messages
  add column if not exists episode_id uuid
    references public.conversation_episodes (id) on delete set null,
  add column if not exists member_user_id uuid
    references auth.users (id) on delete set null,
  add column if not exists visibility text not null default 'family'
    check (visibility in ('family', 'internal')),
  add column if not exists task_run_id uuid
    references public.homa_task_runs (id) on delete set null,
  add column if not exists reply_to_message_id uuid
    references public.conversation_messages (id) on delete set null,
  add column if not exists provider_message_id text,
  add column if not exists thread_key_hash text
    check (thread_key_hash is null or thread_key_hash ~ '^[a-f0-9]{64}$');

-- Existing dispatch "user" rows are scheduler instructions, not parent words.
-- Mark them now so continuity hydration can never replay them as conversation.
update public.conversation_messages
set visibility = 'internal'
where channel = 'dispatch' and role = 'user';

create index if not exists conversation_messages_episode_created_idx
  on public.conversation_messages (episode_id, created_at)
  where episode_id is not null;
create index if not exists conversation_messages_member_created_idx
  on public.conversation_messages (member_user_id, created_at desc)
  where member_user_id is not null;
create index if not exists conversation_messages_task_run_idx
  on public.conversation_messages (task_run_id)
  where task_run_id is not null;
create unique index if not exists conversation_messages_provider_id_idx
  on public.conversation_messages (channel, provider_message_id)
  where provider_message_id is not null;

create table if not exists public.conversation_thread_bindings (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  member_user_id uuid references auth.users (id) on delete cascade,
  channel text not null
    check (channel in ('web', 'sms', 'email', 'dispatch', 'voice')),
  thread_key_hash text not null
    check (thread_key_hash ~ '^[a-f0-9]{64}$'),
  runtime_session_id text,
  episode_id uuid not null
    references public.conversation_episodes (id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (channel, thread_key_hash)
);

create index if not exists conversation_thread_bindings_family_idx
  on public.conversation_thread_bindings (family_id, last_seen_at desc);
create index if not exists conversation_thread_bindings_runtime_idx
  on public.conversation_thread_bindings (runtime_session_id)
  where runtime_session_id is not null;

alter table public.conversation_thread_bindings enable row level security;
-- No Data API policy: bindings are server-only routing state.
revoke all on table public.conversation_thread_bindings from anon, authenticated;

create table if not exists public.conversation_deliveries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  episode_id uuid not null
    references public.conversation_episodes (id) on delete cascade,
  message_id uuid not null
    references public.conversation_messages (id) on delete cascade,
  task_run_id uuid references public.homa_task_runs (id) on delete set null,
  recipient_member_user_id uuid references auth.users (id) on delete set null,
  channel text not null check (channel in ('sms', 'email', 'web')),
  destination_hash text not null
    check (destination_hash ~ '^[a-f0-9]{64}$'),
  provider_thread_key_hash text
    check (
      provider_thread_key_hash is null
      or provider_thread_key_hash ~ '^[a-f0-9]{64}$'
    ),
  provider_message_id text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'uncertain')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  error text,
  sent_at timestamptz,
  failed_at timestamptz,
  replied_at timestamptz,
  reply_message_id uuid
    references public.conversation_messages (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id, channel, destination_hash)
);

create index if not exists conversation_deliveries_recipient_open_idx
  on public.conversation_deliveries
    (recipient_member_user_id, channel, sent_at desc)
  where status = 'sent' and replied_at is null;
create index if not exists conversation_deliveries_task_run_idx
  on public.conversation_deliveries (task_run_id)
  where task_run_id is not null;

alter table public.conversation_deliveries enable row level security;

create policy "members read their conversation deliveries"
  on public.conversation_deliveries
  for select
  to authenticated
  using (public.is_family_member(family_id));

create table if not exists public.conversation_open_loops (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  episode_id uuid not null
    references public.conversation_episodes (id) on delete cascade,
  message_id uuid not null
    references public.conversation_messages (id) on delete cascade,
  delivery_id uuid not null unique
    references public.conversation_deliveries (id) on delete cascade,
  kind text not null
    check (kind in ('yes_no', 'free_text', 'choice', 'approval')),
  state text not null default 'open'
    check (state in ('open', 'resolved', 'expired', 'cancelled')),
  prompt_key text check (prompt_key is null or char_length(prompt_key) <= 120),
  reply_contract jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  resolved_at timestamptz,
  resolved_by_message_id uuid
    references public.conversation_messages (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists conversation_open_loops_family_open_idx
  on public.conversation_open_loops (family_id, expires_at)
  where state = 'open';

alter table public.conversation_open_loops enable row level security;

create policy "members read their conversation open loops"
  on public.conversation_open_loops
  for select
  to authenticated
  using (public.is_family_member(family_id));

alter table public.conversation_messages
  add column if not exists replied_delivery_id uuid
    references public.conversation_deliveries (id) on delete set null;

create index if not exists conversation_messages_replied_delivery_idx
  on public.conversation_messages (replied_delivery_id)
  where replied_delivery_id is not null;

-- A family-level task can reach one parent while another delivery fails.
-- Preserve that truth instead of collapsing "any delivered" into "done".
alter table public.homa_task_runs
  drop constraint if exists homa_task_runs_status_check;
alter table public.homa_task_runs
  add constraint homa_task_runs_status_check
  check (
    status in (
      'running', 'done', 'partial', 'partial_uncertain',
      'uncertain', 'failed', 'skipped'
    )
  );
