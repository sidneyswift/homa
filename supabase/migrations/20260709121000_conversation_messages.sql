-- Migration #34: conversation_messages, the durable chat record (agentic
-- ladder item 5, an M1-02 slice; docs/homa-planning/
-- 15-agentic-architecture.md §5).
--
-- eve's Workflow storage owns the LIVE session (resume, parking, replay)
-- but retains completed runs about 7 days and is not queryable, so this
-- table is the permanent, searchable record (01-architecture.md state
-- model). Rows are written by the eve hook agent/hooks/
-- persist-conversation.ts on the server-only connection, for BOTH
-- channels (web chat and SMS), with family_id taken from the session's
-- auth attributes (channel-stamped, never model input).
--
-- Tenancy: members read their own family's rows (the recall tool runs
-- under the caller's token, so RLS is the wall there too). There is
-- deliberately NO insert/update/delete policy for authenticated: a
-- browser session can never forge or alter the transcript record.

-- Idempotent on purpose: this landed via MCP before the GitHub
-- integration replays the file (same posture as migration #27).
create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- eve durable session id; groups one conversation.
  session_id text not null,
  -- The event's per-session sequence number; makes capture idempotent.
  sequence integer not null,
  channel text not null default 'web'
    check (channel in ('web', 'sms')),
  role text not null
    check (role in ('user', 'assistant')),
  -- Truncated at write time; the check is the hard backstop.
  content text not null
    check (char_length(content) between 1 and 8000),
  turn_id text,
  created_at timestamptz not null default now(),
  unique (session_id, sequence)
);

create index if not exists conversation_messages_family_idx
  on public.conversation_messages (family_id, created_at desc);
create index if not exists conversation_messages_session_idx
  on public.conversation_messages (session_id, sequence);
create index if not exists conversation_messages_fts_idx
  on public.conversation_messages
  using gin (to_tsvector('english', content));

alter table public.conversation_messages enable row level security;

drop policy if exists "members read their conversation messages"
  on public.conversation_messages;
create policy "members read their conversation messages"
  on public.conversation_messages for select to authenticated
  using (public.is_family_member(family_id));
