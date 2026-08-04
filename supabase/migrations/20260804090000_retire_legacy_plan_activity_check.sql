-- Retire the positional Planner check RPC after all authenticated clients
-- moved to set_plan_activity_check_v2.
--
-- Keeping the function definition makes rollback and historical inspection
-- safe, but no client or anonymous caller may execute an operation whose
-- child, subject, week, and index tuple is not bound to a plan revision and
-- exact activity text.

revoke all on function public.toggle_plan_activity_check(
  uuid, text, smallint, smallint, boolean
) from public, anon, authenticated;
