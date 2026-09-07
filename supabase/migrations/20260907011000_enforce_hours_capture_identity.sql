-- POST-READY contract step. See the rollout receipt before applying this file.
create or replace function public.set_planner_learning_activity_time_identified(
  target_activity_id uuid,
  target_duration_minutes integer,
  capture_revision timestamptz
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
  capture_id uuid;
  capture_key text;
  capture_ids uuid[];
  capture_slot integer := 0;
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
    if target_duration_minutes is not null and coalesce(cardinality(existing_hours_ids), 0) = 0 then
      if capture_revision is null then raise exception 'revision required' using errcode = '22023'; end if;
      capture_key := 'manual-hours:' || activity.id::text || ':' || capture_revision::text;
      capture_id := public.learning_mutation_uuid(capture_key, 'operation');
      select array_agg(public.learning_mutation_uuid(capture_key,'hours:' || i::text) order by i)
        into capture_ids from generate_series(0, greatest(1,cardinality(child_ids))-1) i;
      insert into public.learning_write_operations(id,family_id,operation_key,request,expected_hours_ids,resolved_date)
      values(capture_id,activity.family_id,capture_key,
        jsonb_build_object('activityId',activity.id,'expectedUpdatedAt',capture_revision,'minutes',target_duration_minutes),
        capture_ids,activity.activity_date);
    end if;
    if coalesce(array_length(existing_hours_ids, 1), 0) > 0 then
      update public.hours_log as target
      set minutes = target_duration_minutes
      where target.id = any(existing_hours_ids) and target.family_id = activity.family_id;
      collected_hours_ids := existing_hours_ids;
    elsif array_length(child_ids, 1) is null then
      insert into public.hours_log
        (id, family_id, child_id, subject, minutes, happened_on, source, note, capture_operation_id)
      values (
        capture_ids[1], activity.family_id, null, activity.subject, target_duration_minutes,
        activity.activity_date, 'chat', left(activity.title, 200), capture_id
      )
      returning id into new_hours_id;
      collected_hours_ids := array[new_hours_id];
      insert into public.planner_learning_activity_hours
        (family_id, activity_id, hours_entry_id)
      values (activity.family_id, activity.id, new_hours_id)
      on conflict do nothing;
    else
      foreach hours_child in array child_ids loop
        capture_slot := capture_slot + 1;
        insert into public.hours_log
          (id, family_id, child_id, subject, minutes, happened_on, source, note, capture_operation_id)
        values (
          capture_ids[capture_slot], activity.family_id, hours_child, activity.subject, target_duration_minutes,
          activity.activity_date, 'chat', left(activity.title, 200), capture_id
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

  if capture_id is not null then
    update public.learning_write_operations set outcome=jsonb_build_object('hoursEntryIds',to_jsonb(collected_hours_ids)) where id=capture_id;
  end if;
  return query select
    'applied'::text, null::text, activity.id, activity.family_id,
    activity.status, activity.duration_minutes, collected_hours_ids, activity.updated_at;
end;
$$;


revoke all on function public.set_planner_learning_activity_time_identified(uuid,integer,timestamptz) from public,anon,authenticated,service_role;

create or replace function public.update_planner_learning_activity_record(
  target_activity_id uuid, target_expected_updated_at timestamptz,
  target_title text, target_note text, target_duration_minutes integer
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  activity public.planner_learning_activities%rowtype;
  member_family uuid;
  observed_family uuid;
  linked_hours_id uuid;
  context jsonb;
  time_receipt record;
begin
  if auth.uid() is null then return jsonb_build_object('result', 'not_found'); end if;
  if target_title is null or char_length(btrim(target_title)) not between 1 and 300
    or char_length(btrim(target_note)) > 500
    or (target_duration_minutes is not null and target_duration_minutes not between 1 and 600)
  then return jsonb_build_object('result', 'invalid'); end if;
  select a.family_id into observed_family from public.planner_learning_activities a where a.id = target_activity_id;
  select m.family_id into member_family from public.family_members m
    where m.family_id = observed_family and m.user_id = auth.uid() for key share;
  if member_family is null then return jsonb_build_object('result', 'not_found'); end if;
  perform 1 from public.families where id=member_family for key share;
  select * into activity from public.planner_learning_activities a
    where a.id = target_activity_id and a.family_id = member_family for update;
  if activity.id is null then return jsonb_build_object('result', 'not_found'); end if;
  if target_expected_updated_at is null or activity.updated_at <> target_expected_updated_at then
    return jsonb_build_object('result', 'conflict', 'reason', 'stale');
  end if;
  select l.hours_entry_id into linked_hours_id from public.planner_learning_activity_hours l
    where l.activity_id = activity.id and l.family_id = member_family order by l.hours_entry_id limit 1;
  if linked_hours_id is not null then
    context := public.lock_hours_entry_edit_context(linked_hours_id);
    if context->>'result' <> 'ready' then return context; end if;
  end if;
  perform public.update_planner_learning_activity_details(target_activity_id, target_title, target_note);
  select * into time_receipt from public.set_planner_learning_activity_time_identified(target_activity_id, target_duration_minutes, target_expected_updated_at);
  if time_receipt.result <> 'applied' then
    raise exception 'reported time conflict' using errcode = '23505';
  end if;
  select * into activity from public.planner_learning_activities where id = target_activity_id;
  return jsonb_build_object('result', 'applied', 'title', activity.title, 'note', activity.note,
    'durationMinutes', activity.duration_minutes, 'status', activity.status, 'updatedAt', activity.updated_at);
exception when unique_violation then
  return jsonb_build_object('result', 'conflict', 'reason', 'duplicate');
end;
$$;
revoke all on function public.update_planner_learning_activity_record(uuid, timestamptz, text, text, integer) from public, anon;
grant execute on function public.update_planner_learning_activity_record(uuid, timestamptz, text, text, integer) to authenticated;


-- Stale clients cannot replay an unversioned time-add after a later deletion.
create or replace function public.set_planner_learning_activity_time(target_activity_id uuid,target_duration_minutes integer)
returns table(result text,reason text,activity_id uuid,family_id uuid,activity_status text,duration_minutes integer,hours_entry_ids uuid[],updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  return query select 'conflict'::text,'stale'::text,null::uuid,null::uuid,null::text,null::integer,'{}'::uuid[],null::timestamptz;
end $$;

-- Apply only after every writer deploy is READY. Existing rows keep absent provenance.
create function public.enforce_hours_capture_identity() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.capture_operation_id is null or not exists (
    select 1 from public.learning_write_operations o where o.id=new.capture_operation_id and o.family_id=new.family_id
      and new.id=any(o.expected_hours_ids) and o.outcome is null
  ) then raise exception 'Hours capture requires an active operation' using errcode = '42501'; end if;
  return new;
end $$;
revoke all on function public.enforce_hours_capture_identity() from public,anon,authenticated,service_role;
create trigger hours_require_capture_identity before insert on public.hours_log for each row execute function public.enforce_hours_capture_identity();
-- An old in-flight INSERT now refuses; there is no permissive gap after removing the coarse key.
drop index public.hours_log_block_unique_idx;

create function public.preserve_hours_capture_identity() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.capture_operation_id is distinct from old.capture_operation_id
  then raise exception 'Hours capture identity is immutable' using errcode='23000'; end if;
  return new;
end $$;
create trigger hours_capture_identity_immutable before update on public.hours_log for each row execute function public.preserve_hours_capture_identity();
