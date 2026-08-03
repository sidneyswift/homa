-- Make plan activity scheduling stale-safe across rebuilds and edits.
-- A positional slot is not an identity once the plan changes. The caller
-- therefore sends the plan revision and exact activity text it saw, and the
-- function locks the child and plan before it accepts the date.

create or replace function public.schedule_plan_activity_v2(
  target_child_id uuid,
  target_subject_id text,
  target_week smallint,
  target_activity_index smallint,
  target_scheduled_date date,
  target_expected_text text,
  target_plan_revision bigint,
  target_schedule_id uuid default null
)
returns table (
  status text,
  reason text,
  family_id uuid,
  plan_id uuid,
  plan_revision bigint,
  scheduled_date date,
  activity_text text,
  schedule_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  observed_family_id uuid;
  locked_membership_family_id uuid;
  actual_family_id uuid;
  locked_plan public.child_plans%rowtype;
  matching_week_count integer;
  week_activities jsonb;
  current_activity_text text;
  written_schedule_id uuid;
begin
  if auth.uid() is null then
    raise exception 'schedule_plan_activity_v2 requires an authenticated caller'
      using errcode = '42501';
  end if;

  -- Observe the candidate tenant, then lock membership, child, and plan in
  -- that order. The observation grants no authority by itself.
  select child.family_id
    into observed_family_id
  from public.children as child
  where child.id = target_child_id;

  select member.family_id
    into locked_membership_family_id
  from public.family_members as member
  where member.family_id = observed_family_id
    and member.user_id = auth.uid()
  for key share;

  if locked_membership_family_id is null then
    raise exception 'child does not belong to the caller''s family'
      using errcode = '42501';
  end if;

  select child.family_id
    into actual_family_id
  from public.children as child
  where child.id = target_child_id
  for update;

  if actual_family_id is null
    or actual_family_id is distinct from observed_family_id
  then
    raise exception 'child family changed before the schedule could be saved'
      using errcode = '40001';
  end if;

  if target_subject_id is null
    or char_length(target_subject_id) not between 1 and 80
    or target_week is null
    or target_week not between 1 and 4
    or target_activity_index is null
    or target_activity_index < 0
    or target_scheduled_date is null
    or target_expected_text is null
    or char_length(target_expected_text) not between 1 and 4000
    or target_plan_revision is null
    or target_plan_revision < 1
  then
    raise exception 'subject, week, activity index, date, expected text, and a positive plan revision are required'
      using errcode = '22023';
  end if;

  select *
    into locked_plan
  from public.child_plans as plan
  where plan.child_id = target_child_id
    and plan.subject_id = target_subject_id
  for update;

  if locked_plan.id is null then
    return query select
      'conflict'::text,
      'plan-missing'::text,
      actual_family_id,
      null::uuid,
      null::bigint,
      null::date,
      null::text,
      null::uuid;
    return;
  end if;

  if locked_plan.plan_revision <> target_plan_revision then
    return query select
      'conflict'::text,
      'revision-mismatch'::text,
      actual_family_id,
      locked_plan.id,
      locked_plan.plan_revision,
      null::date,
      null::text,
      null::uuid;
    return;
  end if;

  select
    count(*)::integer,
    jsonb_agg(week_entry -> 'activities') -> 0
    into matching_week_count, week_activities
  from jsonb_array_elements(
    case
      when jsonb_typeof(locked_plan.plan -> 'weeks') = 'array'
        then locked_plan.plan -> 'weeks'
      else '[]'::jsonb
    end
  ) as week_entry
  where week_entry ->> 'week' = target_week::text;

  if matching_week_count <> 1
    or week_activities is null
    or jsonb_typeof(week_activities) <> 'array'
    or target_activity_index >= jsonb_array_length(week_activities)
    or jsonb_typeof(week_activities -> target_activity_index) <> 'string'
  then
    return query select
      'conflict'::text,
      'invalid-plan'::text,
      actual_family_id,
      locked_plan.id,
      locked_plan.plan_revision,
      null::date,
      null::text,
      null::uuid;
    return;
  end if;

  current_activity_text := week_activities ->> target_activity_index;
  if current_activity_text is distinct from target_expected_text then
    return query select
      'conflict'::text,
      'activity-mismatch'::text,
      actual_family_id,
      locked_plan.id,
      locked_plan.plan_revision,
      null::date,
      current_activity_text,
      null::uuid;
    return;
  end if;

  insert into public.plan_activity_schedule (
    id, family_id, child_id, subject_id, week, activity_index, scheduled_date
  )
  values (
    coalesce(target_schedule_id, gen_random_uuid()),
    actual_family_id,
    target_child_id,
    target_subject_id,
    target_week,
    target_activity_index,
    target_scheduled_date
  )
  on conflict (family_id, child_id, subject_id, week, activity_index)
  do update set scheduled_date = excluded.scheduled_date, updated_at = now()
  returning id into written_schedule_id;

  return query select
    'applied'::text,
    null::text,
    actual_family_id,
    locked_plan.id,
    locked_plan.plan_revision,
    target_scheduled_date,
    current_activity_text,
    written_schedule_id;
end;
$$;

revoke all on function public.schedule_plan_activity_v2(
  uuid, text, smallint, smallint, date, text, bigint, uuid
) from public;
grant execute on function public.schedule_plan_activity_v2(
  uuid, text, smallint, smallint, date, text, bigint, uuid
) to authenticated;
