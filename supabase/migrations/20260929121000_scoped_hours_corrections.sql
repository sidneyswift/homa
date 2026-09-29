-- gh#1201: explicit child-scoped corrections, including authenticated chat.
create function public.lock_hours_entry_pinned(target_family uuid, target_entry_id uuid)
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
  select h.family_id into member_family from public.hours_log h
    where h.id=target_entry_id and h.family_id=target_family;
  if member_family is null then return jsonb_build_object('result','not_found'); end if;

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
revoke all on function public.lock_hours_entry_pinned(uuid,uuid) from public, anon, authenticated, service_role;

create function public.correct_hours_entry_pinned(f uuid,eid uuid,revision text,scope text,operation text,subject text,minutes int,label text,note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ctx jsonb; aid uuid; split_id uuid; cid uuid; a public.planner_learning_activities%rowtype; ids uuid[];
begin
  if scope is null or scope not in ('child','shared') or operation is null or operation not in ('update','remove') then return jsonb_build_object('result','invalid'); end if;
  if operation='update' and (coalesce(subject,'') not in ('reading','math','science','social studies','art','music','PE','co-op','life skills','other','spanish')
    or minutes is null or minutes not between 1 and 600 or char_length(label)>40 or char_length(note)>200) then return jsonb_build_object('result','invalid'); end if;
  ctx := public.lock_hours_entry_pinned(f,eid);
  if ctx->>'result'<>'ready' then return ctx; end if;
  if revision is null or revision<>ctx->>'revision' then return jsonb_build_object('result','conflict','reason','stale'); end if;
  aid := (ctx->'activity'->>'id')::uuid;
  cid := (ctx->'entry'->>'childId')::uuid;
  if scope='child' and cid is null then
    return jsonb_build_object('result','conflict','reason','whole-family','note','This is a whole-family record. Review explicit participants before splitting it.'); end if;
  if aid is not null and scope='child' and jsonb_array_length(ctx->'activity'->'children')>1 then
    select * into a from public.planner_learning_activities where id=aid and family_id=f;
    split_id := public.learning_mutation_uuid('split-hours:'||eid::text,'activity');
    insert into public.planner_learning_activities(id,family_id,title,subject,activity_date,status,duration_minutes,note,source_channel,source_quote,source_message_id,idempotency_key,
      completion_source_channel,completion_source_quote,completion_source_message_id,completion_idempotency_key,completed_at,completed_by_user_id)
    values(split_id,f,a.title,a.subject,a.activity_date,a.status,a.duration_minutes,a.note,a.source_channel,a.source_quote,a.source_message_id,'split-hours:'||eid::text,
      a.completion_source_channel,a.completion_source_quote,a.completion_source_message_id,a.completion_idempotency_key,a.completed_at,a.completed_by_user_id);
    update public.planner_learning_activity_children set activity_id=split_id where activity_id=aid and family_id=f and child_id=cid;
    update public.planner_learning_activity_hours set activity_id=split_id where activity_id=aid and family_id=f and hours_entry_id=eid;
    update public.planner_learning_activities set updated_at=clock_timestamp() where id=aid and family_id=f;
    aid := split_id;
  end if;
  if aid is null then ids:=array[eid]; else
    select array_agg(hours_entry_id order by hours_entry_id) into ids from public.planner_learning_activity_hours where activity_id=aid and family_id=f;
  end if;
  if operation='remove' then
    delete from public.hours_log where id=any(ids) and family_id=f;
    update public.planner_learning_activities set duration_minutes=null,updated_at=clock_timestamp() where id=aid and family_id=f;
  else
    update public.hours_log h set subject=correct_hours_entry_pinned.subject,minutes=correct_hours_entry_pinned.minutes,
      custom_label=case when h.id=eid then nullif(btrim(label),'') else h.custom_label end,
      note=case when h.id=eid then nullif(btrim(correct_hours_entry_pinned.note),'') else h.note end
    where h.id=any(ids) and h.family_id=f;
    update public.planner_learning_activities set subject=correct_hours_entry_pinned.subject,duration_minutes=minutes,updated_at=clock_timestamp() where id=aid and family_id=f;
  end if;
  return jsonb_build_object('result','applied','entryId',eid,'affectedEntries',cardinality(ids),'scope',scope,'operation',operation);
end $$;
revoke all on function public.correct_hours_entry_pinned(uuid,uuid,text,text,text,text,int,text,text) from public,anon,authenticated,service_role;
create function public.correct_hours_entry(f uuid,eid uuid,revision text,scope text,operation text,subject text,minutes int,label text,note text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_family_member(f) then raise exception 'Family unavailable' using errcode='42501'; end if;
  return public.correct_hours_entry_pinned(f,eid,revision,scope,operation,subject,minutes,label,note);
end $$;
revoke all on function public.correct_hours_entry(uuid,uuid,text,text,text,text,int,text,text) from public,anon;
grant execute on function public.correct_hours_entry(uuid,uuid,text,text,text,text,int,text,text) to authenticated;
