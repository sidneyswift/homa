-- Expand first. The final insert fence/index removal is a separate post-READY migration.
create table public.learning_write_operations (
  id uuid primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  operation_key text not null check (length(operation_key) between 8 and 240),
  source_message_id uuid,
  source_quote text,
  request jsonb not null check (jsonb_typeof(request) = 'object' and octet_length(request::text) <= 32768),
  expected_hours_ids uuid[] not null default '{}',
  resolved_date date not null check (resolved_date between date '0001-01-01' and date '9999-12-31'),
  outcome jsonb check (outcome is null or (jsonb_typeof(outcome) = 'object' and octet_length(outcome::text) <= 32768)),
  created_at timestamptz not null default now(),
  unique (family_id, operation_key),
  unique (id, family_id),
  check (cardinality(expected_hours_ids) <= 12)
);
alter table public.learning_write_operations enable row level security;
revoke all on public.learning_write_operations from public, anon, authenticated;
-- Voice needs only a retry date filtered by its exact family and operation key.
-- Full quotes and request context retain conversation privacy and are server-only.
grant select (family_id, operation_key, resolved_date) on public.learning_write_operations to authenticated;
create policy learning_operations_family_read on public.learning_write_operations for select to authenticated
using (exists (select 1 from public.family_members m where m.family_id = learning_write_operations.family_id and m.user_id = auth.uid()));
alter table public.hours_log add column capture_operation_id uuid;
alter table public.hours_log add constraint hours_capture_operation_family_fk
  foreign key (capture_operation_id, family_id) references public.learning_write_operations(id, family_id)
  deferrable initially deferred;

-- Request identity remains after source retention, edits, undo, or deletion of effect rows.
create function public.preserve_learning_write_operation() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.operation_key <> old.operation_key
     or new.source_message_id is distinct from old.source_message_id
     or new.source_quote is distinct from old.source_quote or new.request <> old.request
     or new.expected_hours_ids <> old.expected_hours_ids or new.resolved_date <> old.resolved_date
     or new.created_at <> old.created_at or (old.outcome is not null and new.outcome is distinct from old.outcome)
  then raise exception 'learning operation is immutable' using errcode = '23000'; end if;
  return new;
end $$;
create trigger learning_operation_immutable before update on public.learning_write_operations
for each row execute function public.preserve_learning_write_operation();
-- Deferred triggers run after the caller RPC returns. Keep this invariant check
-- privileged without granting the caller access to private receipt columns.
create function public.require_completed_learning_write_operation() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.learning_write_operations o where o.id = new.id and o.outcome is null)
  then raise exception 'learning operation cannot commit without outcome' using errcode = '23514'; end if;
  return null;
end $$;
revoke all on function public.require_completed_learning_write_operation() from public, anon, authenticated;
create constraint trigger learning_operation_completed after insert or update on public.learning_write_operations
 deferrable initially deferred for each row execute function public.require_completed_learning_write_operation();

-- Private leaf for authenticated server-pinned writers. No browser role may mint a claim.
create function public.claim_learning_write_operation(
  target_family uuid, operation_id uuid, operation_key text, source_message uuid,
  source_quote text, request_payload jsonb, expected_hours uuid[], requested_date date
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare prior public.learning_write_operations%rowtype; source_row public.conversation_messages%rowtype;
  zone text; resolved date;
begin
  if target_family is null or operation_id is null or source_message is null or source_quote is null
     or operation_key is null or request_payload is null or expected_hours is null or length(source_quote) not between 1 and 1000
     or jsonb_typeof(request_payload) <> 'object' or octet_length(request_payload::text) > 32768
     or cardinality(expected_hours) > 12 or array_position(expected_hours, null) is not null
     or (select count(distinct x) from unnest(expected_hours) x) <> cardinality(expected_hours)
  then raise exception 'invalid learning operation' using errcode = '22023'; end if;
  perform 1 from public.families where id = target_family for key share;
  if not found then raise exception 'family unavailable' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_family::text || ':' || operation_key, 0));
  select * into prior from public.learning_write_operations o
    where o.family_id = target_family and o.operation_key = claim_learning_write_operation.operation_key;
  if found then
    if prior.id <> operation_id or prior.request <> request_payload or prior.source_message_id <> source_message
       or prior.source_quote <> source_quote or prior.expected_hours_ids <> expected_hours
    then raise exception 'learning operation payload conflict' using errcode = 'P1090'; end if;
    return jsonb_build_object('inserted',false,'id',prior.id,'resolvedDate',prior.resolved_date,'outcome',prior.outcome);
  end if;
  select * into source_row from public.conversation_messages m
    where m.id = source_message and m.family_id = target_family and m.role = 'user';
  if not found or strpos(source_row.content, source_quote) = 0
  then raise exception 'learning source unavailable' using errcode = '42501'; end if;
  select case when exists (select 1 from pg_timezone_names z where z.name=f.time_zone)
    then f.time_zone else 'America/Chicago' end into zone from public.families f where id=target_family;
  resolved := coalesce(requested_date, (source_row.created_at at time zone zone)::date);
  insert into public.learning_write_operations(id,family_id,operation_key,source_message_id,source_quote,request,expected_hours_ids,resolved_date)
    values(operation_id,target_family,operation_key,source_message,source_quote,request_payload,expected_hours,resolved);
  return jsonb_build_object('inserted',true,'id',operation_id,'resolvedDate',resolved,'outcome',null);
end $$;
revoke all on function public.claim_learning_write_operation(uuid,uuid,text,uuid,text,jsonb,uuid[],date) from public,anon,authenticated;

-- UUID slots match learningMutationUuid in the server library.
create function public.learning_mutation_uuid(seed text, slot text) returns uuid language plpgsql immutable strict set search_path = '' as $$
declare bytes bytea; hex text;
begin
  bytes := substring(sha256(convert_to(seed || ':' || slot, 'UTF8')) from 1 for 16);
  bytes := set_byte(bytes,6,(get_byte(bytes,6) & 15) | 64);
  bytes := set_byte(bytes,8,(get_byte(bytes,8) & 63) | 128);
  hex := encode(bytes,'hex'); return (substr(hex,1,8)||'-'||substr(hex,9,4)||'-'||substr(hex,13,4)||'-'||substr(hex,17,4)||'-'||substr(hex,21,12))::uuid;
end $$;
revoke all on function public.learning_mutation_uuid(text,text) from public,anon,authenticated;

create function public.record_hours_operation_pinned(target_family uuid, source_message uuid, activity_ordinal integer,
  source_quote text, target_child uuid, target_subject text, target_minutes integer, requested_date date,
  target_note text, target_label text, target_source text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare op_key text; op_id uuid; hours_id uuid; claim jsonb; payload jsonb; current_row jsonb; resolved date;
begin
  if activity_ordinal is null or activity_ordinal not between 1 and 32 or target_minutes is null or target_minutes not between 1 and 600
    or target_subject is null or target_subject not in ('reading','math','science','social studies','art','music','PE','co-op','life skills','spanish','other')
    or target_source is null or target_source not in ('chat','sms','call','email','dispatch')
    or length(coalesce(target_note,'')) > 200 or length(coalesce(target_label,'')) > 40
  then raise exception 'invalid Hours operation' using errcode = '22023'; end if;
  target_note := nullif(btrim(target_note),''); target_label := nullif(btrim(target_label),''); source_quote := btrim(source_quote);
  op_key := 'log-hours:' || source_message::text || ':' || activity_ordinal::text;
  op_id := public.learning_mutation_uuid(op_key,'operation'); hours_id := public.learning_mutation_uuid(op_key,'hours');
  payload := jsonb_build_object('childId',target_child,'subject',target_subject,'minutes',target_minutes,'happenedOn',requested_date,
    'note',target_note,'customLabel',target_label,'source',target_source);
  claim := public.claim_learning_write_operation(target_family,op_id,op_key,source_message,source_quote,payload,array[hours_id],requested_date);
  resolved := (claim->>'resolvedDate')::date;
  if (claim->>'inserted')::boolean then
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
revoke all on function public.record_hours_operation_pinned(uuid,uuid,integer,text,uuid,text,integer,date,text,text,text) from public,anon,authenticated;

-- Caller keeps its JWT. This wrapper resolves membership, never accepts a family id.
create function public.record_hours_operation(source_message uuid, activity_ordinal integer, source_quote text,
  target_child uuid, target_subject text, target_minutes integer, requested_date date, target_note text, target_label text, expected_resolved_date date default null)
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
  receipt := public.record_hours_operation_pinned(owned_family,source_message,activity_ordinal,source_quote,target_child,target_subject,target_minutes,
    requested_date,target_note,target_label,'chat');
  if expected_resolved_date is not null and (receipt->>'resolvedDate')::date <> expected_resolved_date
  then raise exception 'source date changed' using errcode='P1090'; end if;
  return receipt;
end $$;
revoke all on function public.record_hours_operation(uuid,integer,text,uuid,text,integer,date,text,text,date) from public,anon;
grant execute on function public.record_hours_operation(uuid,integer,text,uuid,text,integer,date,text,text,date) to authenticated;

-- Preserve the complete Planner graph during an authenticated family fold.
do $$ declare c record; begin
  for c in select conname,conrelid::regclass as relation from pg_constraint
    where contype='f' and conrelid in ('public.planner_learning_activity_children'::regclass,'public.planner_learning_activity_hours'::regclass)
      and array_length(conkey,1)=2
  loop execute format('alter table %s alter constraint %I deferrable initially deferred',c.relation,c.conname); end loop;
end $$;
