-- Planner: delete a chat-logged learning activity (Carolyng feedback,
-- 2026-08-27): "add a delete button porfa. I have doubles from what HOMA
-- put in based on our block schedule and our recorded hours." One of her
-- two duplicate sources is a planner_learning_activities row; the other
-- (a generated-plan schedule placement) is handled separately since it
-- lives in plan_activity_schedule, which authenticated delete already
-- reaches directly (no RPC needed there).
--
-- Mirrors update_planner_learning_activity_details' security shape
-- (family_members lock, family-scoped row lock): direct table writes
-- stay revoked from authenticated per the owning migration's rule, so
-- this is the only door.
--
-- A completed activity may have logged Hours through the same-turn
-- planner_learning_activity_hours join. set_planner_learning_activity_status
-- already established the pattern for removing those Hours rows in the
-- same locked transaction when a completion is undone; deleting the
-- activity outright needs the identical cleanup, or her manually-deleted
-- duplicate would leave its Hours entry behind as a new orphan.

create or replace function public.delete_planner_learning_activity(
  target_activity_id uuid
)
returns table (
  result text,
  activity_id uuid,
  family_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity public.planner_learning_activities%rowtype;
  observed_family_id uuid;
  locked_membership_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'delete_planner_learning_activity requires an authenticated caller'
      using errcode = '42501';
  end if;

  select row.family_id into observed_family_id
  from public.planner_learning_activities row
  where row.id = target_activity_id;

  select member.family_id into locked_membership_family_id
  from public.family_members member
  where member.family_id = observed_family_id
    and member.user_id = auth.uid()
  for key share;

  if locked_membership_family_id is null then
    raise exception 'planner activity does not belong to the caller'
      using errcode = '42501';
  end if;

  select * into activity
  from public.planner_learning_activities row
  where row.id = target_activity_id
    and row.family_id = locked_membership_family_id
  for update;

  if activity.id is null then
    raise exception 'planner activity changed before the delete could be saved'
      using errcode = '40001';
  end if;

  -- Same reasoning as set_planner_learning_activity_status's revert
  -- cleanup: remove only Hours rows linked to this exact activity, in
  -- the same locked transaction, before the activity row (and its
  -- children/hours junction rows) cascade away.
  delete from public.hours_log as hours
  using public.planner_learning_activity_hours as link
  where link.family_id = activity.family_id
    and link.activity_id = activity.id
    and hours.family_id = link.family_id
    and hours.id = link.hours_entry_id;

  delete from public.planner_learning_activities
  where id = activity.id;

  return query select 'applied'::text, activity.id, activity.family_id;
end;
$$;

revoke all on function public.delete_planner_learning_activity(uuid)
  from public, anon;
grant execute on function public.delete_planner_learning_activity(uuid)
  to authenticated;
