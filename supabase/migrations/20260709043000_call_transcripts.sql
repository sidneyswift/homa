-- Migration: call_transcripts (founder decision 2026-07-09, build-log):
-- persist EVERY Telnyx voice call's raw transcript into our own database,
-- both the general companion line and the curriculum line. This reverses
-- the earlier "general line keeps nothing" privacy-by-default posture, at
-- founder direction; retention is verbatim and indefinite for now, to be
-- revisited (logged in build-log as the ruling on journeys Q3).
--
-- Telnyx stays the system of record DURING a call; this is our durable
-- copy, pulled from GET /ai/conversations/{id}/messages after the call and
-- keyed by Telnyx's conversation_id so re-capture is an idempotent upsert.
--
-- Tenancy: family-level, the same is_family_member() read posture as
-- family_memories (migration #13). family_id and child_id are NULLABLE on
-- purpose: an unknown caller (a number linked to no family) is still
-- stored, but with a null family_id it is unreadable by anyone through the
-- Data API, only the server-only mapDb connection can see it, which is the
-- correct "there is no family to show this to" behavior. Every write runs
-- on mapDb (the Telnyx webhook / sync job carries no caller session), so
-- there is deliberately NO authenticated write policy at all.

create table public.call_transcripts (
  id uuid primary key default gen_random_uuid(),
  -- Telnyx AI conversation id; the idempotency key for re-capture upserts.
  conversation_id text not null unique,
  -- Which line produced it, resolved from the assistant id at capture time.
  line text not null default 'general'
    check (line in ('general', 'curriculum')),
  assistant_id text,
  channel text,
  -- Resolved owner. Null when the caller's number maps to no family.
  family_id uuid references public.families (id) on delete cascade,
  child_id uuid references public.children (id) on delete set null,
  caller_e164 text,
  agent_e164 text,
  -- The full turn-by-turn history: [{ role, text, tool_calls, sent_at }].
  -- Verbatim raw record; memory and curricula are derived from it later.
  messages jsonb not null default '[]'::jsonb,
  message_count integer not null default 0,
  -- Telnyx's post-call "Summary" insight, when one is available.
  summary text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index call_transcripts_family_idx
  on public.call_transcripts (family_id, created_at desc);
create index call_transcripts_child_idx
  on public.call_transcripts (child_id);

alter table public.call_transcripts enable row level security;

-- Members read their own family's transcripts. Unknown-caller rows
-- (family_id null) are readable by no one through the Data API. There is
-- no insert/update/delete policy for authenticated: only the server-only
-- connection (the capture webhook and the sync job) ever writes, so a
-- browser session can never forge or alter a transcript.
create policy "members read call transcripts"
  on public.call_transcripts for select to authenticated
  using (family_id is not null and public.is_family_member(family_id));
