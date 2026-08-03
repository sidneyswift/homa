-- Supabase can carry a named anon execute grant on newly created
-- security-definer functions. Revoke it explicitly so only authenticated
-- family members can reach the stale-safe schedule operation.

revoke all on function public.schedule_plan_activity_v2(
  uuid, text, smallint, smallint, date, text, bigint, uuid
) from public, anon;
grant execute on function public.schedule_plan_activity_v2(
  uuid, text, smallint, smallint, date, text, bigint, uuid
) to authenticated;
