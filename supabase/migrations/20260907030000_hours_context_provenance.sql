-- Additive #1093 helpers. Apply after the #1090 schema, before the code using v2.
-- Existing signatures and immutable legacy operation request shapes are retained.
create function public.record_hours_operation_pinned_v2(target_family uuid, source_message uuid, activity_ordinal integer,
  source_quote text, target_child uuid, target_subject text, target_minutes integer, requested_date date,
  target_note text, target_label text, target_source text, target_member uuid, work_context jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare op_key text; op_id uuid; hours_id uuid; claim jsonb; payload jsonb; current_row jsonb; resolved date; context_id uuid; context_quote text; context_title text;
  earlier public.conversation_messages%rowtype; current_at timestamptz;
begin
  if work_context is null then
    return public.record_hours_operation_pinned(target_family,source_message,activity_ordinal,source_quote,
      target_child,target_subject,target_minutes,requested_date,target_note,target_label,target_source);
  end if;
  if jsonb_typeof(work_context) <> 'object' or (select count(*) from jsonb_object_keys(work_context)) <> 3
    or jsonb_typeof(work_context->'sourceMessageId') is distinct from 'string'
    or jsonb_typeof(work_context->'sourceQuote') is distinct from 'string'
    or jsonb_typeof(work_context->'workTitle') is distinct from 'string'
    or length(work_context->>'sourceQuote') not between 1 and 1000
    or length(btrim(work_context->>'workTitle')) not between 1 and 300
  then raise exception 'invalid Hours work context' using errcode='22023'; end if;
  context_id := (work_context->>'sourceMessageId')::uuid;
  context_quote := work_context->>'sourceQuote'; context_title := btrim(work_context->>'workTitle');
  if target_note is null or (length(context_title) <= 200 and strpos(target_note,context_title) <> 1)
    or (length(context_title) > 200 and (right(target_note,1) <> '…' or length(target_note) < 2 or strpos(context_title,left(target_note,-1)) <> 1))
  then raise exception 'Hours annotation must retain the verified work title' using errcode='22023'; end if;
  if target_member is null then raise exception 'context requires an authenticated member' using errcode='42501'; end if;
  perform 1 from public.family_members m where m.family_id=target_family and m.user_id=target_member for key share;
  if not found then raise exception 'context member unavailable' using errcode='42501'; end if;
  work_context := jsonb_build_object('sourceMessageId',context_id,'sourceQuote',context_quote,'workTitle',context_title);
  if activity_ordinal is null or activity_ordinal not between 1 and 32 or target_minutes is null or target_minutes not between 1 and 600
    or target_subject is null or target_subject not in ('reading','math','science','social studies','art','music','PE','co-op','life skills','spanish','other')
    or target_source is null or target_source not in ('chat','sms','call','email','dispatch')
    or length(coalesce(target_note,'')) > 200 or length(coalesce(target_label,'')) > 40
  then raise exception 'invalid Hours operation' using errcode = '22023'; end if;
  target_note := nullif(btrim(target_note),''); target_label := nullif(btrim(target_label),''); source_quote := btrim(source_quote);
  op_key := 'log-hours:' || source_message::text || ':' || activity_ordinal::text;
  op_id := public.learning_mutation_uuid(op_key,'operation'); hours_id := public.learning_mutation_uuid(op_key,'hours');
  payload := jsonb_build_object('childId',target_child,'subject',target_subject,'minutes',target_minutes,'happenedOn',requested_date,
    'note',target_note,'customLabel',target_label,'source',target_source,'workContext',work_context);
  claim := public.claim_learning_write_operation(target_family,op_id,op_key,source_message,source_quote,payload,array[hours_id],requested_date);
  resolved := (claim->>'resolvedDate')::date;
  if (claim->>'inserted')::boolean then
    select m.created_at into current_at from public.conversation_messages m where m.id=source_message and m.family_id=target_family and m.role='user';
    select * into earlier from public.conversation_messages m where m.id=context_id and m.family_id=target_family
      and m.role='user' and m.visibility='family' and m.created_at <= current_at
      and (m.member_user_id=target_member or exists (select 1 from public.conversation_deliveries d
        where d.family_id=m.family_id and d.message_id=m.id and d.recipient_member_user_id=target_member and d.status='sent'));
    if earlier.id is null or strpos(earlier.content,context_quote)=0 or strpos(context_quote,context_title)=0
    then raise exception 'Hours work context unavailable' using errcode='42501'; end if;
    if target_child is not null then
      perform 1 from public.children where id=target_child and family_id=target_family for key share;
      if not found then raise exception 'child unavailable' using errcode = '42501'; end if;
    end if;
    insert into public.hours_log(id,family_id,child_id,subject,minutes,happened_on,source,note,custom_label,capture_operation_id)
      values(hours_id,target_family,target_child,target_subject,target_minutes,resolved,target_source,target_note,target_label,op_id);
    update public.learning_write_operations set outcome=jsonb_build_object('hoursEntryIds',jsonb_build_array(hours_id)) where id=op_id;
  end if;
  select jsonb_build_object('id',h.id,'childId',h.child_id,'subject',h.subject,'minutes',h.minutes,'happenedOn',h.happened_on,
    'source',h.source,'note',h.note,'customLabel',h.custom_label) into current_row from public.hours_log h where h.id=hours_id and h.family_id=target_family;
  return jsonb_build_object('logged',current_row is not null,'inserted',(claim->>'inserted')::boolean,
    'status',case when current_row is null then 'removed' else 'recorded' end,'entry',current_row,'resolvedDate',resolved);
end $$;
revoke all on function public.record_hours_operation_pinned_v2(uuid,uuid,integer,text,uuid,text,integer,date,text,text,text,uuid,jsonb) from public,anon,authenticated;

create function public.record_hours_operation_v2(source_message uuid, activity_ordinal integer, source_quote text,
  target_child uuid, target_subject text, target_minutes integer, requested_date date, target_note text, target_label text, expected_resolved_date date default null, work_context jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' set statement_timeout = '15s' set lock_timeout = '5s' as $$
declare owned_family uuid; receipt jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select m.family_id into owned_family from public.family_members m
    join public.conversation_messages s on s.family_id=m.family_id and s.id=source_message
    where m.user_id=auth.uid() and s.role='user' and s.visibility='family'
      and (s.member_user_id=auth.uid() or exists (
        select 1 from public.conversation_deliveries d
        where d.family_id=s.family_id and d.message_id=s.id
          and d.recipient_member_user_id=auth.uid() and d.status='sent'
      )) for key share of m;
  if owned_family is null then raise exception 'source does not belong to caller' using errcode = '42501'; end if;
  receipt := public.record_hours_operation_pinned_v2(owned_family,source_message,activity_ordinal,source_quote,target_child,target_subject,target_minutes,
    requested_date,target_note,target_label,'chat',auth.uid(),work_context);
  if expected_resolved_date is not null and (receipt->>'resolvedDate')::date <> expected_resolved_date
  then raise exception 'source date changed' using errcode='P1090'; end if;
  return receipt;
end $$;
revoke all on function public.record_hours_operation_v2(uuid,integer,text,uuid,text,integer,date,text,text,date,jsonb) from public,anon;
grant execute on function public.record_hours_operation_v2(uuid,integer,text,uuid,text,integer,date,text,text,date,jsonb) to authenticated;


-- The existing editor keeps its CAS. Only newly added time receives the composed note.
create function public.set_planner_learning_activity_time_with_note(
  target_activity_id uuid,
  target_duration_minutes integer,
  capture_revision timestamptz,
  new_hours_note text
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
  if new_hours_note is null or length(new_hours_note) > 200 then
    raise exception 'invalid new Hours note' using errcode='22023';
  end if;
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
        jsonb_build_object('activityId',activity.id,'expectedUpdatedAt',capture_revision,'minutes',target_duration_minutes,
          'annotationContext',jsonb_build_object('title',activity.title,'note',activity.note,'sourceQuote',activity.source_quote),'hoursNote',new_hours_note),
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
        activity.activity_date, 'chat', new_hours_note, capture_id
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
          activity.activity_date, 'chat', new_hours_note, capture_id
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


revoke all on function public.set_planner_learning_activity_time_with_note(uuid,integer,timestamptz,text) from public,anon,authenticated,service_role;

create function public.update_planner_learning_activity_record_v2(
  target_activity_id uuid, target_expected_updated_at timestamptz,
  target_title text, target_note text, target_duration_minutes integer, target_hours_note text
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
  if target_hours_note is null or char_length(target_hours_note) > 200
    or target_title is null or char_length(btrim(target_title)) not between 1 and 300
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
  select * into time_receipt from public.set_planner_learning_activity_time_with_note(target_activity_id, target_duration_minutes, target_expected_updated_at, target_hours_note);
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
revoke all on function public.update_planner_learning_activity_record_v2(uuid, timestamptz, text, text, integer, text) from public, anon;
grant execute on function public.update_planner_learning_activity_record_v2(uuid, timestamptz, text, text, integer, text) to authenticated;



-- Same SECURITY INVOKER RLS and per-adult filters, with exact provenance IDs.
create function public.recall_semantic_v2(
  query_embedding text,
  match_limit int default 6,
  scopes text[] default null
)
returns table (
  source text,
  source_id uuid,
  source_role text,
  happened_at timestamptz,
  label text,
  content text,
  distance double precision
)
language sql
stable
set search_path = public, extensions
as $$
  with q as (
    select query_embedding::extensions.vector(1536) as v
  )
  select * from (
    select
      'memory'::text as source, memory.id as source_id, null::text as source_role,
      memory.created_at as happened_at,
      case
        when memory.superseded_at is not null then 'saved memory, older note that was later corrected'
        when memory.kind = 'what_works' then 'saved memory (what works)'
        else 'saved memory'
      end as label,
      memory.content,
      (memory.embedding <=> (select v from q))::double precision as distance
    from public.family_memories memory
    where memory.embedding is not null
      and (scopes is null or 'memory' = any(scopes))
    union all
    select
      'chat', message.id, message.role,
      message.created_at,
      (case when message.channel = 'sms' then 'text message' else 'chat' end)
        || ' (' || (case when message.role = 'user' then 'the parent' else 'Homa' end) || ')',
      message.content,
      (message.embedding <=> (select v from q))::double precision
    from public.conversation_messages message
    where message.embedding is not null
      and message.visibility = 'family'
      and (scopes is null or 'chat' = any(scopes))
      and (
        message.member_user_id = auth.uid()
        or exists (
          select 1
          from public.conversation_deliveries delivery
          where delivery.family_id = message.family_id
            and delivery.message_id = message.id
            and delivery.recipient_member_user_id = auth.uid()
            and delivery.status = 'sent'
        )
      )
    union all
    select
      'call', transcript.id, null::text,
      transcript.started_at,
      case when transcript.line = 'curriculum' then 'phone call (report review)' else 'phone call' end,
      left(transcript.transcript_text, 480),
      (transcript.embedding <=> (select v from q))::double precision
    from public.call_transcripts transcript
    where transcript.embedding is not null
      and transcript.member_user_id = auth.uid()
      and (scopes is null or 'call' = any(scopes))
  ) hits
  order by distance asc
  limit greatest(1, least(match_limit, 12));
$$;

revoke all on function public.recall_semantic_v2(text, int, text[]) from public;
revoke execute on function public.recall_semantic_v2(text, int, text[]) from anon;
grant execute on function public.recall_semantic_v2(text, int, text[]) to authenticated;
