-- Material studio runs: the founder console's test-bench ledger
-- (/admin/studio, direction lab
-- docs/homa-planning/plans/2026-07-18-material-studio-admin-directions.html).
-- One row per founder-launched test generation of the materials-studio
-- skill against a SANDBOX family. The run's materials live in
-- public.materials like any other (matched back by generation->>sessionId);
-- this table exists so a run that dies before create_printable stays
-- visible instead of vanishing, mirroring why homa_task_runs exists for
-- dispatch.
--
-- Additive only: safe to apply ahead of the deploy that reads it
-- (AGENTS.md deploy law). The /admin/studio page degrades to a labeled
-- setup note when this table is missing, so ordering cannot break prod.
--
-- Founder-only surface: no Data API access at all, matching the
-- founder-console tables (email_sends, cron_runs). All reads and writes
-- go through the server connections (lib/admin/db.ts, lib/map/db.ts);
-- family_id is stamped server-side from a founder-verified sandbox
-- family, never from model or client input.

create table if not exists public.materials_studio_runs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid references public.children (id) on delete set null,
  -- What the founder asked the skill to make, verbatim.
  request text not null check (char_length(request) between 3 and 600),
  -- The eve session that ran the test. Audit pointer for the session
  -- X-ray and the materials join; never load-bearing state.
  session_id text,
  status text not null default 'started'
    check (status in ('started', 'completed', 'failed')),
  error text check (error is null or char_length(error) <= 500),
  -- The founder who pressed the button (email from the admin gate).
  started_by text not null check (char_length(started_by) between 3 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists materials_studio_runs_created_idx
  on public.materials_studio_runs (created_at desc);
create index if not exists materials_studio_runs_family_idx
  on public.materials_studio_runs (family_id, created_at desc);

alter table public.materials_studio_runs enable row level security;
revoke all on table public.materials_studio_runs from anon, authenticated;
