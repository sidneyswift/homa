-- Expand phase for stale-safe Planner check-offs.
--
-- A progress key such as "2.0" is positional. Its meaning can change when
-- the plan is rebuilt, so every second-client write must prove both the plan
-- revision and the exact activity text the parent saw. The legacy five-arg
-- function remains during this migration so compatible web and mobile
-- clients can ship before the contract phase disables ambiguous writes.

alter table public.child_plans
  add column plan_revision bigint not null default 1
  check (plan_revision >= 1),
  add column progress_revision bigint not null default 0
  check (progress_revision >= 0);

comment on column public.child_plans.plan_revision is
  'Increments only when plan JSON changes. Progress-only writes do not change it.';

comment on column public.child_plans.progress_revision is
  'Increments only when progress JSON changes. Orders authoritative check snapshots.';

create or replace function public.bump_child_plan_revisions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.plan_revision := 1;
    new.progress_revision := 0;
  else
    if new.plan is distinct from old.plan then
      new.plan_revision := old.plan_revision + 1;
    else
      -- A caller cannot manufacture a revision by updating the column alone.
      new.plan_revision := old.plan_revision;
    end if;

    if new.progress is distinct from old.progress then
      new.progress_revision := old.progress_revision + 1;
    else
      -- The same protection keeps response ordering server-controlled.
      new.progress_revision := old.progress_revision;
    end if;
  end if;
  return new;
end;
$$;

create trigger child_plans_bump_revisions
before insert or update of plan, plan_revision, progress, progress_revision
on public.child_plans
for each row execute function public.bump_child_plan_revisions();

revoke all on function public.bump_child_plan_revisions()
  from public, anon, authenticated;

create or replace function public.set_plan_activity_check(
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
  plan_id uuid,
  plan_revision bigint,
  progress_revision bigint,
  progress_snapshot jsonb,
  progress_key text,
  done boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_plan public.child_plans%rowtype;
  target_week smallint;
  target_activity_index integer;
  matching_week_count integer;
  week_activities jsonb;
  current_activity_text text;
  current_done boolean;
begin
  if auth.uid() is null then
    raise exception 'set_plan_activity_check requires an authenticated caller'
      using errcode = '42501';
  end if;

  if not public.is_child_family_member(target_child_id) then
    raise exception 'child does not belong to the caller''s family'
      using errcode = '42501';
  end if;

  if target_check_key is null
    or target_check_key !~ '^[1-4]\.(0|[1-9][0-9]*)$'
  then
    raise exception 'check key is invalid'
      using errcode = '22023';
  end if;

  if target_done is null or target_expected_text is null
    or target_plan_revision is null
    or target_plan_revision < 1
  then
    raise exception 'done, expected text, and a positive plan revision are required'
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
      null::bigint,
      null::bigint,
      null::jsonb,
      target_check_key,
      null::boolean;
    return;
  end if;

  if locked_plan.plan_revision <> target_plan_revision then
    return query select
      'conflict'::text,
      'revision-mismatch'::text,
      locked_plan.id,
      locked_plan.plan_revision,
      locked_plan.progress_revision,
      locked_plan.progress,
      target_check_key,
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
      locked_plan.id,
      locked_plan.plan_revision,
      locked_plan.progress_revision,
      locked_plan.progress,
      target_check_key,
      null::boolean;
    return;
  end if;

  current_activity_text := week_activities ->> target_activity_index;

  if current_activity_text is distinct from target_expected_text then
    return query select
      'conflict'::text,
      'activity-mismatch'::text,
      locked_plan.id,
      locked_plan.plan_revision,
      locked_plan.progress_revision,
      locked_plan.progress,
      target_check_key,
      null::boolean;
    return;
  end if;

  if jsonb_typeof(locked_plan.progress) <> 'object' then
    return query select
      'conflict'::text,
      'invalid-progress'::text,
      locked_plan.id,
      locked_plan.plan_revision,
      locked_plan.progress_revision,
      locked_plan.progress,
      target_check_key,
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
        coalesce(target_plan.progress, '{}'::jsonb),
        array[target_check_key],
        to_jsonb(target_done),
        true
      ),
      updated_at = clock_timestamp()
    where target_plan.id = locked_plan.id
    returning target_plan.progress, target_plan.progress_revision
    into locked_plan.progress, locked_plan.progress_revision;
    current_done := target_done;
  end if;

  return query select
    'applied'::text,
    null::text,
    locked_plan.id,
    locked_plan.plan_revision,
    locked_plan.progress_revision,
    locked_plan.progress,
    target_check_key,
    current_done;
end;
$$;

revoke all on function public.set_plan_activity_check(uuid, text, text, boolean, text, bigint)
  from public, anon;
grant execute on function public.set_plan_activity_check(uuid, text, text, boolean, text, bigint)
  to authenticated;
