-- Migration #21: the LLM-written narrative layer (D8 overturn, founder rulings
-- 2026-07-06): the model's words live NEXT TO the deterministic facts,
-- versioned, never in place of them. narrative holds the generated pieces
-- (null until generated); narrative_meta tracks the attempt
-- ({ status: writing|ready|failed, promptVersion, model, startedAt,
--   generatedAt, durationMs, tokensIn, tokensOut, rejectedPieces,
--   failReason }). Same deny-all posture as the rest of the lead tables:
-- server routes only, no RLS change.
alter table public.lead_reports
  add column narrative jsonb,
  add column narrative_meta jsonb;

alter table public.lead_plans
  add column narrative jsonb,
  add column narrative_meta jsonb;
