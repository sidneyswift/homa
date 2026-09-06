-- #1092: mobile-web corrections keep the recorded time and its explicit
-- Planner activity together. Existing native direct Hours writes and old
-- Planner RPC signatures remain compatible; this is not a global write guard.

-- Internal authenticated resolver. Lock activity before linked Hours, matching
-- Planner completion/status and voice undo. The revision covers all affected
-- rows, so a stale editor cannot silently overwrite another parent's change.
create or replace function public.lock_hours_entry_edit_context(target_entry_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  entry public.hours_log%rowtype;
  activity public.planner_learning_activities%rowtype;
  observed_family uuid;
  member_family uuid;
  owner_ids uuid[];
  hour_ids uuid[];
  child_ids uuid[];
  child_names jsonb;
  hours_snapshot jsonb;
  activity_snapshot jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('result', 'not_found');
  end if;
  select h.family_id into observed_family from public.hours_log h where h.id = target_entry_id;
  select m.family_id into member_family from public.family_members m
    where m.family_id = observed_family and m.user_id = auth.uid() for key share;
  if member_family is null then return jsonb_build_object('result', 'not_found'); end if;

  select array_agg(l.activity_id order by l.activity_id) into owner_ids
    from public.planner_learning_activity_hours l
    where l.hours_entry_id = target_entry_id and l.family_id = member_family;
  if coalesce(cardinality(owner_ids), 0) > 1 then
    return jsonb_build_object('result', 'conflict', 'reason', 'link-shape');
  end if;

  if cardinality(owner_ids) = 1 then
    select * into activity from public.planner_learning_activities a
      where a.id = owner_ids[1] and a.family_id = member_family for update;
    if activity.id is null or activity.status <> 'completed' then
      return jsonb_build_object('result', 'conflict', 'reason', 'link-shape');
    end if;
    perform c.child_id from public.planner_learning_activity_children c
      where c.activity_id = activity.id and c.family_id = member_family
      order by c.child_id for update;
    perform l.hours_entry_id from public.planner_learning_activity_hours l
      where l.activity_id = activity.id and l.family_id = member_family
      order by l.hours_entry_id for update;
    select coalesce(array_agg(c.child_id order by c.child_id), '{}') into child_ids
      from public.planner_learning_activity_children c
      where c.activity_id = activity.id and c.family_id = member_family;
    select coalesce(array_agg(l.hours_entry_id order by l.hours_entry_id), '{}') into hour_ids
      from public.planner_learning_activity_hours l
      where l.activity_id = activity.id and l.family_id = member_family;
    if not target_entry_id = any(hour_ids) then
      return jsonb_build_object('result', 'conflict', 'reason', 'stale');
    end if;
    perform h.id from public.hours_log h
      where h.id = any(hour_ids) and h.family_id = member_family order by h.id for update;
    if cardinality(hour_ids) <> greatest(1, cardinality(child_ids))
       or exists (
         select 1 from public.planner_learning_activity_hours l
         where l.hours_entry_id = any(hour_ids) and l.activity_id <> activity.id
       )
       or exists (
         select 1 from public.hours_log h where h.id = any(hour_ids)
         and (h.family_id <> member_family or h.happened_on <> activity.activity_date
           or (cardinality(child_ids) = 0 and h.child_id is not null)
           or (cardinality(child_ids) > 0 and (h.child_id is null or not h.child_id = any(child_ids))))
       )
       or (cardinality(child_ids) > 0 and (
         select count(distinct h.child_id) from public.hours_log h where h.id = any(hour_ids)
       ) <> cardinality(child_ids))
    then return jsonb_build_object('result', 'conflict', 'reason', 'link-shape'); end if;
    select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.id), '[]')
      into child_names from public.children c
      where c.family_id = member_family and c.id = any(child_ids);
    activity_snapshot := to_jsonb(activity);
  else
    hour_ids := array[target_entry_id];
    child_ids := '{}';
    child_names := '[]';
  end if;

  select * into entry from public.hours_log h
    where h.id = target_entry_id and h.family_id = member_family for update;
  if entry.id is null then return jsonb_build_object('result', 'not_found'); end if;
  -- Recheck ownership after locks. Never reinterpret a link that disappeared
  -- while waiting as an unlinked row and write only one side of the record.
  if coalesce(owner_ids, '{}') is distinct from (
    select coalesce(array_agg(l.activity_id order by l.activity_id), '{}')
    from public.planner_learning_activity_hours l where l.hours_entry_id = entry.id
  ) then return jsonb_build_object('result', 'conflict', 'reason', 'stale'); end if;
  select jsonb_agg(to_jsonb(h) order by h.id) into hours_snapshot
    from public.hours_log h where h.id = any(hour_ids) and h.family_id = member_family;

  return jsonb_build_object(
    'result', 'ready',
    'revision', md5(jsonb_build_array(hours_snapshot, activity_snapshot, child_ids)::text),
    'entry', jsonb_build_object(
      'id', entry.id, 'childId', entry.child_id,
      'childName', (select c.name from public.children c where c.id = entry.child_id and c.family_id = member_family),
      'subject', entry.subject, 'customLabel', entry.custom_label, 'minutes', entry.minutes,
      'happenedOn', entry.happened_on, 'source', entry.source, 'note', entry.note
    ),
    'activity', case when activity.id is null then null else jsonb_build_object(
      'id', activity.id, 'title', activity.title, 'note', activity.note,
      'children', child_names, 'hoursEntryIds', hour_ids
    ) end
  );
end;
$$;
revoke all on function public.lock_hours_entry_edit_context(uuid) from public, anon, authenticated;

create or replace function public.get_hours_entry_edit_context(target_entry_id uuid)
returns jsonb language sql security definer set search_path = ''
as $$ select public.lock_hours_entry_edit_context(target_entry_id) $$;
revoke all on function public.get_hours_entry_edit_context(uuid) from public, anon;
grant execute on function public.get_hours_entry_edit_context(uuid) to authenticated;

create or replace function public.update_hours_entry(
  target_entry_id uuid, target_revision text, target_subject text,
  target_minutes integer, target_custom_label text, target_note text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  context jsonb;
  linked_activity_id uuid;
  authorized_family_id uuid;
  normalized_note text := nullif(btrim(target_note), '');
  normalized_label text := nullif(btrim(target_custom_label), '');
begin
  if target_subject is null or target_subject not in
    ('reading','math','science','social studies','art','music','PE','co-op','life skills','other','spanish')
    or target_minutes is null or target_minutes < 1 or target_minutes > 600
    or char_length(normalized_note) > 200 or char_length(normalized_label) > 40
  then return jsonb_build_object('result', 'invalid'); end if;
  context := public.lock_hours_entry_edit_context(target_entry_id);
  if context->>'result' <> 'ready' then return context; end if;
  if target_revision is null or target_revision <> context->>'revision' then
    return jsonb_build_object('result', 'conflict', 'reason', 'stale');
  end if;
  linked_activity_id := (context->'activity'->>'id')::uuid;
  select family_id into authorized_family_id from public.hours_log where id = target_entry_id;
  if linked_activity_id is not null then
    update public.planner_learning_activities set subject = target_subject,
      duration_minutes = target_minutes, updated_at = now() where id = linked_activity_id and family_id = authorized_family_id;
    -- Validate uniqueness against the selected row's final category, never an
    -- intermediate combination of new time and its old category.
    update public.hours_log h set subject = target_subject, minutes = target_minutes,
      custom_label = case when h.id = target_entry_id then normalized_label else h.custom_label end,
      note = case when h.id = target_entry_id then normalized_note else h.note end
      from public.planner_learning_activity_hours l
      where l.activity_id = linked_activity_id and l.family_id = authorized_family_id and h.id = l.hours_entry_id and h.family_id = l.family_id;
  else
    update public.hours_log set subject = target_subject, minutes = target_minutes,
      custom_label = normalized_label, note = normalized_note where id = target_entry_id and family_id = authorized_family_id;
  end if;
  return jsonb_build_object('result', 'applied', 'entryId', target_entry_id);
exception when unique_violation then
  -- This exception block rolls back every requested field, including Planner.
  return jsonb_build_object('result', 'conflict', 'reason', 'duplicate');
end;
$$;
revoke all on function public.update_hours_entry(uuid, text, text, integer, text, text) from public, anon;
grant execute on function public.update_hours_entry(uuid, text, text, integer, text, text) to authenticated;

create or replace function public.delete_hours_entry(target_entry_id uuid, target_revision text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  context jsonb;
  linked_activity_id uuid;
  authorized_family_id uuid;
begin
  context := public.lock_hours_entry_edit_context(target_entry_id);
  if context->>'result' <> 'ready' then return context; end if;
  if target_revision is null or target_revision <> context->>'revision' then
    return jsonb_build_object('result', 'conflict', 'reason', 'stale');
  end if;
  linked_activity_id := (context->'activity'->>'id')::uuid;
  select family_id into authorized_family_id from public.hours_log where id = target_entry_id;
  if linked_activity_id is not null then
    delete from public.hours_log h using public.planner_learning_activity_hours l
      where l.activity_id = linked_activity_id and l.family_id = authorized_family_id and h.id = l.hours_entry_id and h.family_id = l.family_id;
    update public.planner_learning_activities set duration_minutes = null, updated_at = now()
      where id = linked_activity_id and family_id = authorized_family_id;
  else
    delete from public.hours_log where id = target_entry_id and family_id = authorized_family_id;
  end if;
  return jsonb_build_object('result', 'applied', 'entryId', target_entry_id);
end;
$$;
revoke all on function public.delete_hours_entry(uuid, text) from public, anon;
grant execute on function public.delete_hours_entry(uuid, text) to authenticated;

-- One parent Save is one transaction. Keep legacy RPCs callable, but never
-- let the web form commit its title/note before a failed time correction.
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
  select * into time_receipt from public.set_planner_learning_activity_time(target_activity_id, target_duration_minutes);
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
