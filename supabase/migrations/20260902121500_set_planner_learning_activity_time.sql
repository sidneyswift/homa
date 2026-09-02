-- Planner: let a parent add or edit an activity's reported time herself
-- (Carolyng feedback, 2026-09-02 WhatsApp: "In planner I would like there
-- to be the option for me to add the reported time manually"). Today the
-- web checkbox (set_planner_learning_activity_status) only ever flips
-- planned/completed and never asks for a duration, so a web-completed
-- item logs zero Hours unless she separately says the time out loud in
-- Chat or Voice. The details modal's "Reported time" row has been
-- read-only since it shipped (20260826200000): this adds the write side.
--
-- Mirrors set_planner_learning_activity_status and
-- update_planner_learning_activity_details's security shape (family_members
-- lock, family-scoped row lock, direct table writes staying revoked from
-- authenticated). Setting a duration also marks the activity completed
-- when it was still planned -- entering how long it actually took IS
-- marking it done, the same single action complete_planner_activity
-- already treats as one step from Chat/Voice -- and clearing it (null)
-- only removes the reported time, leaving status alone, since a finished
-- activity does not stop being finished just because she takes the
-- number back out.
--
-- Hours fan-out mirrors recordPlannerLearningActivity/
-- completePlannerLearningActivity (lib/planner-learning-activities.ts):
-- one row per participating child, or one family-wide row when the
-- activity has none. When Hours rows already exist for this activity
-- (a prior manual save, or an original chat/voice completion), their
-- minutes are updated in place instead of being replaced, so the row
-- keeps its own identity, source, and note. A genuine collision with an
-- unrelated Hours entry (hours_log_block_unique_idx, widened same-day in
-- 20260902120000) is caught and reported as a conflict rather than
-- surfacing a raw constraint error.

create or replace function public.set_planner_learning_activity_time(
  target_activity_id uuid,
  target_duration_minutes integer
)
returns table (
  result text,
  reason text,
  activity_id uuid,
  family_id uuid,
  activity_status text,
  duration_minutes integer,
  hours_entry_ids uuid[],
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity public.planner_learning_activities%rowtype;
  observed_family_id uuid;
  locked_membership_family_id uuid;
  child_ids uuid[];
  existing_hours_ids uuid[];
  collected_hours_ids uuid[] := '{}';
  hours_child uuid;
  new_hours_id uuid;
begin
  if auth.uid() is null then
    raise exception 'set_planner_learning_activity_time requires an authenticated caller'
      using errcode = '42501';
  end if;

  if target_duration_minutes is not null
     and (target_duration_minutes < 1 or target_duration_minutes > 600)
  then
    raise exception 'planner activity duration is invalid' using errcode = '22023';
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
    raise exception 'planner activity changed before the time could be saved'
      using errcode = '40001';
  end if;

  select coalesce(array_agg(child.child_id), '{}') into child_ids
  from public.planner_learning_activity_children child
  where child.activity_id = activity.id and child.family_id = activity.family_id;

  select coalesce(array_agg(link.hours_entry_id), '{}') into existing_hours_ids
  from public.planner_learning_activity_hours link
  where link.activity_id = activity.id and link.family_id = activity.family_id;

  if target_duration_minutes is null then
    delete from public.hours_log as hours
    using public.planner_learning_activity_hours as link
    where link.family_id = activity.family_id
      and link.activity_id = activity.id
      and hours.family_id = link.family_id
      and hours.id = link.hours_entry_id;

    update public.planner_learning_activities as target
    set duration_minutes = null, updated_at = now()
    where target.id = activity.id
    returning * into activity;

    return query select
      'applied'::text, null::text, activity.id, activity.family_id,
      activity.status, activity.duration_minutes, '{}'::uuid[], activity.updated_at;
    return;
  end if;

  begin
    if coalesce(array_length(existing_hours_ids, 1), 0) > 0 then
      update public.hours_log as target
      set minutes = target_duration_minutes
      where target.id = any(existing_hours_ids) and target.family_id = activity.family_id;
      collected_hours_ids := existing_hours_ids;
    elsif array_length(child_ids, 1) is null then
      insert into public.hours_log
        (family_id, child_id, subject, minutes, happened_on, source, note)
      values (
        activity.family_id, null, activity.subject, target_duration_minutes,
        activity.activity_date, 'chat', left(activity.title, 200)
      )
      returning id into new_hours_id;
      collected_hours_ids := array[new_hours_id];
      insert into public.planner_learning_activity_hours
        (family_id, activity_id, hours_entry_id)
      values (activity.family_id, activity.id, new_hours_id)
      on conflict do nothing;
    else
      foreach hours_child in array child_ids loop
        insert into public.hours_log
          (family_id, child_id, subject, minutes, happened_on, source, note)
        values (
          activity.family_id, hours_child, activity.subject, target_duration_minutes,
          activity.activity_date, 'chat', left(activity.title, 200)
        )
        returning id into new_hours_id;
        collected_hours_ids := collected_hours_ids || new_hours_id;
        insert into public.planner_learning_activity_hours
          (family_id, activity_id, hours_entry_id)
        values (activity.family_id, activity.id, new_hours_id)
        on conflict do nothing;
      end loop;
    end if;
  exception when unique_violation then
    return query select
      'conflict'::text, 'duplicate'::text, activity.id, activity.family_id,
      activity.status, activity.duration_minutes, existing_hours_ids, activity.updated_at;
    return;
  end;

  update public.planner_learning_activities as target
  set duration_minutes = target_duration_minutes,
      status = 'completed',
      completed_at = coalesce(target.completed_at, now()),
      completion_source_channel = coalesce(target.completion_source_channel, 'web'),
      updated_at = now()
  where target.id = activity.id
  returning * into activity;

  return query select
    'applied'::text, null::text, activity.id, activity.family_id,
    activity.status, activity.duration_minutes, collected_hours_ids, activity.updated_at;
end;
$$;

revoke all on function public.set_planner_learning_activity_time(uuid, integer)
  from public, anon;
grant execute on function public.set_planner_learning_activity_time(uuid, integer)
  to authenticated;
