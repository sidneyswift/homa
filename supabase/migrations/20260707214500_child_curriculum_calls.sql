-- The "Call Homa" curriculum feature (founder decision 2026-07-07,
-- build-log): a button on the report triggers an outbound voice call
-- where Homa reviews the report and digs deeper, then an LLM-authored
-- curriculum (not the deterministic four-week plan; richer, whatever
-- length Homa judges the family needs) is generated from the call and
-- shown on /home.
--
-- Product-side only, no lead-side twin: by the time a report is
-- viewable, the parent has already signed up (password is the last
-- onboarding question, before scoring) and the score route has already
-- bridged a family workspace (lib/map/bridge.ts), so every real report
-- viewer already has a family_id + child_id to key on.
--
-- Tenancy: same is_child_family_member() posture as child_plans/
-- child_reports (migration #23). Product-table writes run under the
-- caller's own session for the trigger row; the post-call generation
-- write happens on the server-only connection (mapDb, same as the map
-- lead pipeline) because it is driven by a Telnyx webhook, not a signed-
-- in request, so it cannot carry the caller's RLS token. That webhook
-- write is scoped by re-deriving child/family from a matching
-- 'initiated' call row, never from anything the model or a request body
-- claims blindly.

create table public.child_curriculum_calls (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  phone_e164 text not null,
  -- Telnyx's call_control_id from the outbound-call response, for audit
  -- and dedup; never used alone to authorize a write (see header).
  call_control_id text,
  status text not null default 'initiated'
    check (status in ('initiated', 'completed', 'failed')),
  -- The structured facts the Telnyx Insight extracted from the finished
  -- call (subjects discussed, concerns, interests, goals). Raw, kept for
  -- audit; the generated curriculum is the parent-facing artifact.
  transcript_facts jsonb,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index child_curriculum_calls_child_idx on public.child_curriculum_calls (child_id);
-- The insights webhook looks up "the most recent initiated call for this
-- child" to correlate a Telnyx-echoed child_id back to a real call.
create index child_curriculum_calls_pending_idx
  on public.child_curriculum_calls (child_id, created_at desc)
  where status = 'initiated';

alter table public.child_curriculum_calls enable row level security;

create policy "members read curriculum calls"
  on public.child_curriculum_calls for select to authenticated
  using (public.is_child_family_member(child_id));
create policy "members start curriculum calls"
  on public.child_curriculum_calls for insert to authenticated
  with check (public.is_child_family_member(child_id));
-- No update/delete policy for authenticated: only the server-only
-- connection (the insights webhook) transitions status, so a browser
-- session can start a call but never forge its completion.

-- One current curriculum per child (regenerating on a later call
-- replaces it, same "last-write-wins" posture as child_plans rebuilds).
create table public.child_curricula (
  child_id uuid primary key references public.children (id) on delete cascade,
  call_id uuid references public.child_curriculum_calls (id) on delete set null,
  -- { title, durationLabel, overview, subjects: [...], materialsList, parentNote }
  curriculum jsonb not null,
  model text not null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.child_curricula enable row level security;

create policy "members read curricula"
  on public.child_curricula for select to authenticated
  using (public.is_child_family_member(child_id));
-- No write policy for authenticated on purpose: only the server-only
-- connection (post-call generation) ever writes a curriculum; a parent
-- cannot inject one directly, only trigger the call that leads to one.
