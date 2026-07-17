-- Explicit table-level revokes for the self-improving system's nine tables
-- (PR #3, migrations #20260716010000-050000). Those tables are admin-only,
-- server-written surfaces holding conversation-derived signals; they shipped
-- with RLS enabled and no policies, which PostgREST answers with HTTP 200
-- and an empty list. The isolation guard (scripts/isolation-check.mjs)
-- expects the deny-all contract from migration #56: a revoked role gets a
-- permission error, not an empty success, so a future broad grant or policy
-- mistake has to cross one more boundary. Without this, every main CI run
-- fails the tenancy isolation smoke check.

revoke all on table public.conversation_signals from anon, authenticated;
revoke all on table public.system_policies from anon, authenticated;
revoke all on table public.policy_proposals from anon, authenticated;
revoke all on table public.eval_results from anon, authenticated;
revoke all on table public.fix_effectiveness from anon, authenticated;
revoke all on table public.signal_patterns from anon, authenticated;
revoke all on table public.skill_evolution_log from anon, authenticated;
revoke all on table public.response_engagement from anon, authenticated;
revoke all on table public.knowledge_gaps from anon, authenticated;
