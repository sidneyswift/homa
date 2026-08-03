-- Replace the unused first stale-safe check contract with a tenant-receipted
-- v2 before any web or native client adopts it. The client never supplies a
-- family id. The function locks the target child, derives its family, proves
-- the caller belongs to that family, and returns the same family in every
-- receipt for an existing plan.

-- No deployed client calls this six-argument v1. Remove its direct surface so
-- callers cannot bypass v2's bounded key and tenant receipt. The established
-- toggle_plan_activity_check legacy operation remains available during the
-- client rollout.
revoke execute on function public.set_plan_activity_check(
  uuid, text, text, boolean, text, bigint
) from authenticated;

create or replace function public.set_plan_activity_check_v2(
  target_child_id uuid,
  target_subject_id text,
  target_check_key text,
  target_done boolean,
  target_expected_text text,
  target_plan_revision bigint
)
returns table (
  status text,
  reason text,
  family_id uuid,
  plan_id uuid,
  plan_revision bigint,
  progress_revision bigint,
  progress_snapshot jsonb,
  progress_key text,
  done boolean,
  changed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_plan public.child_plans%rowtype;
  observed_family_id uuid;
  locked_membership_family_id uuid;
  actual_family_id uuid;
  target_week smallint;
  target_activity_index integer;
  matching_week_count integer;
  week_activities jsonb;
  current_activity_text text;
  current_done boolean;
  progress_changed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'set_plan_activity_check_v2 requires an authenticated caller'
      using errcode = '42501';
  end if;

  -- Observe the candidate tenant, then follow the repository's established
  -- membership -> child -> plan lock order. The unlocked observation grants
  -- nothing: both authority rows are locked and rechecked before the write.
  select child.family_id into observed_family_id
  from public.children as child
  where child.id = target_child_id;

  select member.family_id into locked_membership_family_id
  from public.family_members as member
  where member.family_id = observed_family_id
    and member.user_id = auth.uid()
  for key share;

  if locked_membership_family_id is null then
    raise exception 'child does not belong to the caller''s family'
      using errcode = '42501';
  end if;

  select child.family_id into actual_family_id
  from public.children as child
  where child.id = target_child_id
  for update;

  if actual_family_id is null
    or actual_family_id is distinct from observed_family_id
  then
    raise exception 'child family changed before the check could be saved'
      using errcode = '40001';
  end if;

  if target_check_key is null
    or target_check_key !~ '^[1-4]\.(0|[1-9][0-9]{0,2})$'
  then
    raise exception 'check key is invalid'
      using errcode = '22023';
  end if;

  if target_subject_id is null
    or char_length(target_subject_id) not between 1 and 40
    or target_done is null
    or target_expected_text is null
    or char_length(target_expected_text) not between 1 and 4000
    or target_plan_revision is null
    or target_plan_revision < 1
  then
    raise exception 'subject, done, expected text, and a positive plan revision are required'
      using errcode = '22023';
  end if;

  target_week := split_part(target_check_key, '.', 1)::smallint;
  target_activity_index := split_part(target_check_key, '.', 2)::integer;

  select * into locked_plan
  from public.child_plans
  where child_id = target_child_id and subject_id = target_subject_id
  for update;

  if locked_plan.id is null then
    return query select
      'conflict'::text,
      'plan-missing'::text,
      null::uuid,
      null::uuid,
      null::bigint,
      null::bigint,
      null::jsonb,
      target_check_key,
      null::boolean,
      null::boolean;
    return;
  end if;

  if locked_plan.plan_revision <> target_plan_revision then
    return query select
      'conflict'::text,
      'revision-mismatch'::text,
      actual_family_id,
      locked_plan.id,
      locked_plan.plan_revision,
      locked_plan.progress_revision,
      locked_plan.progress,
      target_check_key,
      null::boolean,
      null::boolean;
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
      locked_plan.progress_revision,
      locked_plan.progress,
      target_check_key,
      null::boolean,
      null::boolean;
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
      locked_plan.progress_revision,
      locked_plan.progress,
      target_check_key,
      null::boolean,
      null::boolean;
    return;
  end if;

  if jsonb_typeof(locked_plan.progress) <> 'object' then
    return query select
      'conflict'::text,
      'invalid-progress'::text,
      actual_family_id,
      locked_plan.id,
      locked_plan.plan_revision,
      locked_plan.progress_revision,
      locked_plan.progress,
      target_check_key,
      null::boolean,
      null::boolean;
    return;
  end if;

  if exists (
      select 1
      from jsonb_each(locked_plan.progress) as entry(progress_key, progress_value)
      where entry.progress_key !~ '^[1-4]\.(0|[1-9][0-9]{0,2})$'
        or jsonb_typeof(entry.progress_value) <> 'boolean'
    )
  then
    return query select
      'conflict'::text,
      'invalid-progress'::text,
      actual_family_id,
      locked_plan.id,
      locked_plan.plan_revision,
      locked_plan.progress_revision,
      locked_plan.progress,
      target_check_key,
      null::boolean,
      null::boolean;
    return;
  end if;

  -- Syntax alone is insufficient because a formerly valid positional key can
  -- outlive a malformed plan edit. Every stored key must resolve to exactly
  -- one real activity before this snapshot can be returned as authoritative.
  if exists (
    select 1
    from jsonb_each(locked_plan.progress) as entry(progress_key, progress_value)
    where (
      select count(*)
      from jsonb_array_elements(
        case
          when jsonb_typeof(locked_plan.plan -> 'weeks') = 'array'
            then locked_plan.plan -> 'weeks'
          else '[]'::jsonb
        end
      ) as progress_week
      where progress_week ->> 'week' = split_part(entry.progress_key, '.', 1)
        and jsonb_typeof(progress_week -> 'activities') = 'array'
        and split_part(entry.progress_key, '.', 2)::integer
          < jsonb_array_length(progress_week -> 'activities')
        and jsonb_typeof(
          (progress_week -> 'activities')
            -> split_part(entry.progress_key, '.', 2)::integer
        ) = 'string'
    ) <> 1
  ) then
    return query select
      'conflict'::text,
      'invalid-progress'::text,
      actual_family_id,
      locked_plan.id,
      locked_plan.plan_revision,
      locked_plan.progress_revision,
      locked_plan.progress,
      target_check_key,
      null::boolean,
      null::boolean;
    return;
  end if;

  current_done := coalesce(
    locked_plan.progress -> target_check_key = 'true'::jsonb,
    false
  );

  if coalesce(
    locked_plan.progress -> target_check_key,
    'false'::jsonb
  ) is distinct from to_jsonb(target_done)
  then
    update public.child_plans as target_plan
    set
      progress = jsonb_set(
        target_plan.progress,
        array[target_check_key],
        to_jsonb(target_done),
        true
      ),
      updated_at = clock_timestamp()
    where target_plan.id = locked_plan.id
    returning target_plan.progress, target_plan.progress_revision
    into locked_plan.progress, locked_plan.progress_revision;
    current_done := target_done;
    progress_changed := true;
  end if;

  return query select
    'applied'::text,
    null::text,
    actual_family_id,
    locked_plan.id,
    locked_plan.plan_revision,
    locked_plan.progress_revision,
    locked_plan.progress,
    target_check_key,
    current_done,
    progress_changed;
end;
$$;

revoke all on function public.set_plan_activity_check_v2(
  uuid, text, text, boolean, text, bigint
) from public, anon;
grant execute on function public.set_plan_activity_check_v2(
  uuid, text, text, boolean, text, bigint
) to authenticated;
