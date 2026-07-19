-- Agent-jobs cost attribution
-- (docs/homa-planning/plans/2026-07-19-agent-jobs-cost-attribution.md).
--
-- The authoritative per-stage cost source is public.model_usage, the
-- server-side consumption ledger, NOT the three model-supplied metering
-- columns already on this table. Those columns
-- (sandbox_cpu_seconds, page_fetch_count, model_tokens) are filled from
-- report_agent_job_stage args the build session (a model) reports about
-- itself: unreliable by the tool-honesty law, never asked for by the build
-- brief, never read, and NULL on essentially every stage. They stay for
-- now (dropping is a breaking migration) but are retired as non-authoritative
-- by the comments below so no future reader mistakes them for billing truth.
--
-- The real key is the build session. Every model call a stage causes (the
-- build session's chat turns, plus its nested image and review calls now that
-- those carry sessionId) lands in model_usage keyed by that session's id. This
-- column records the session that SUCCESSFULLY reported the stage, so a
-- read-time rollup can join model_usage.session_id to it and sum the stage's
-- true model spend, priced through the live price book. Failed retry attempts
-- that never reported are intentionally excluded (we do not attribute our own
-- retry waste to a family).
--
-- Additive only, nullable, safe to lead the deploy. Idempotent on purpose:
-- lands via MCP before the GitHub integration replays this file.

alter table public.agent_job_stages
  add column if not exists build_session_id text;

-- The runner claims one runnable stage per active job per tick and joins its
-- build sessions here; this index keeps that join and the per-job spend
-- rollup cheap without scanning unstamped stages.
create index if not exists agent_job_stages_build_session_idx
  on public.agent_job_stages (build_session_id)
  where build_session_id is not null;

comment on column public.agent_job_stages.build_session_id is
  'The eve session that successfully built and reported this stage. Join '
  'model_usage.session_id to this for the stage''s authoritative model spend '
  '(agent-jobs cost attribution, 2026-07-19). NULL for stages built before '
  'this shipped or still unbuilt.';

comment on column public.agent_job_stages.model_tokens is
  'RETIRED as non-authoritative (2026-07-19): model-supplied, unpopulated, '
  'unread. Authoritative model spend is model_usage joined by build_session_id.';
comment on column public.agent_job_stages.page_fetch_count is
  'RETIRED as non-authoritative (2026-07-19): model-supplied and no server '
  'ledger exists for page fetches (web_fetch is Firecrawl-backed).';
comment on column public.agent_job_stages.sandbox_cpu_seconds is
  'RETIRED as non-authoritative (2026-07-19): model-supplied and no sandbox '
  'CPU ledger exists in the cloud runtime.';
