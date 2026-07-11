-- Migration #23: living-record columns (2026-07-07).
--
-- lead_plans.progress: the four-week plan's check-offs move server-side
-- (shape: the client's own check ids, "week.activityIndex", to booleans).
-- The row is already scoped by (lead_child_id, domain_id); the table
-- stays deny-all RLS, written only by session-gated server routes, so a
-- shared report link can read a month's story but never forge one.
--
-- lead_answers.source: provenance for every observation. Corrections and
-- report-page probes become distinguishable from the original checklist
-- sitting. Analytics and the re-norm loop read this; the scorer never
-- does (scoring stays a pure function of answers + age).

alter table public.lead_answers
  add column source text not null default 'checklist'
  check (source in ('checklist', 'deep_dive', 'report_correction', 'report_probe', 'recheck'));

alter table public.lead_plans
  add column progress jsonb not null default '{}'::jsonb;
