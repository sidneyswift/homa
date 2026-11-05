-- Native runtime input is an immutable server-observed batch, scoped to one adult.
-- Prompt and option data are needed for the answer UI; action arguments stay in Eve.
create table public.conversation_native_batches (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversation_records(id) on delete cascade,
  origin_request_id uuid not null,
  canonical_message_id uuid references public.conversation_messages(id) on delete set null,
  access_epoch uuid not null,
  session_id text not null,
  source_index bigint not null check(source_index >= 0),
  turn_id text not null,
  sequence integer not null check(sequence >= 0),
  step_index integer not null check(step_index >= 0),
  payload jsonb,
  state text not null default 'pending' check(state in ('pending','answered','deleted')),
  answer_request_id uuid,
  responses jsonb,
  dispatch_started_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique(id,conversation_id),
  unique(session_id,source_index),
  foreign key(origin_request_id,conversation_id) references public.conversation_requests(id,conversation_id) on delete cascade,
  foreign key(answer_request_id,conversation_id) references public.conversation_requests(id,conversation_id) on delete cascade,
  check(payload is null or jsonb_typeof(payload)='object'),
  check(responses is null or jsonb_typeof(responses)='array')
);
alter table public.conversation_requests add column native_batch_id uuid;
alter table public.conversation_requests add constraint conversation_request_native_batch
  foreign key(native_batch_id,conversation_id) references public.conversation_native_batches(id,conversation_id);
alter table public.conversation_native_batches enable row level security;
revoke all on public.conversation_native_batches from public,anon,authenticated;
grant all on public.conversation_native_batches to service_role;

create function public.erase_conversation_native_batches() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.canonical_message_id is null and old.canonical_message_id is not null then
    with recursive affected(id) as (
      select b.id from public.conversation_native_batches b where b.origin_request_id=new.id or b.answer_request_id=new.id
      union select b.id from public.conversation_native_batches b join public.conversation_requests r on r.id=b.origin_request_id
        join affected a on a.id=r.native_batch_id
    ) update public.conversation_native_batches b set state='deleted',payload=null,responses=null
      where b.id in (select id from affected);
    update public.conversation_requests r set state='revoked',lease_token=null,lease_until=null,updated_at=clock_timestamp()
      from public.conversation_native_batches b where r.native_batch_id=b.id and b.state='deleted'
        and r.state in ('queued','leased');
  end if;
  return new;
end $$;
create trigger conversation_native_batch_erasure after update of canonical_message_id on public.conversation_requests
  for each row execute function public.erase_conversation_native_batches();

-- A deleted card is a tombstone, not permission to recreate its runtime prompt.
-- Descendant answers cannot resume an erased request or retain its private text.
create function public.erase_conversation_native_card() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if (new.canonical_message_id is null and old.canonical_message_id is not null)
    or (new.state='deleted' and old.state<>'deleted') then
    with recursive affected(id) as (
      select new.id
      union select b.id from public.conversation_native_batches b join public.conversation_requests r on r.id=b.origin_request_id
        join affected a on a.id=r.native_batch_id
    ) update public.conversation_native_batches b set state='deleted',payload=null,responses=null
      where b.id in(select id from affected) and b.state<>'deleted';
    delete from public.conversation_messages m using public.conversation_native_batches b
      where b.state='deleted' and b.canonical_message_id=m.id and b.conversation_id=new.conversation_id;
    update public.conversation_requests r set state='revoked',lease_token=null,lease_until=null,updated_at=clock_timestamp()
      from public.conversation_native_batches b where r.native_batch_id=b.id and b.state='deleted'
        and b.conversation_id=new.conversation_id and r.state in('queued','leased');
  end if;
  return new;
end $$;
create trigger conversation_native_card_erasure after update of canonical_message_id,state on public.conversation_native_batches
  for each row execute function public.erase_conversation_native_card();

-- A provider callback receipt and verified resumed work are different states.
create table public.conversation_native_authorizations (
  request_id uuid not null references public.conversation_requests(id) on delete cascade,
  name text not null,
  turn_id text not null,
  sequence integer not null,
  step_index integer not null,
  state text not null check(state in ('pending','callback_received','resolved')),
  primary key(request_id,name,turn_id,sequence,step_index)
);
alter table public.conversation_native_authorizations enable row level security;
revoke all on public.conversation_native_authorizations from public,anon,authenticated;
grant all on public.conversation_native_authorizations to service_role;

-- Every continuation retains the original deletion and attachment fence, even
-- after several native question/approval rounds in the same runtime session.
create function public.conversation_native_ancestry_live(request_id uuid,conversation_id uuid,access_epoch uuid)
returns boolean language sql stable set search_path='' as $$
  with recursive lineage as (
    select r.id,r.canonical_message_id,r.native_batch_id,r.access_epoch from public.conversation_requests r
      where r.id=$1 and r.conversation_id=$2
    union
    select origin.id,origin.canonical_message_id,origin.native_batch_id,origin.access_epoch from lineage l
      join public.conversation_native_batches b on b.id=l.native_batch_id and b.conversation_id=$2
      join public.conversation_requests origin on origin.id=b.origin_request_id and origin.conversation_id=$2
  ) select count(*)>0 and bool_and(l.canonical_message_id is not null and l.access_epoch=$3
    and (l.native_batch_id is null or exists(select 1 from public.conversation_native_batches b
      where b.id=l.native_batch_id and b.conversation_id=$2 and b.state='answered' and b.answer_request_id=l.id
        and b.access_epoch=$3 and b.payload is not null and b.canonical_message_id is not null))
    and not exists(select 1 from public.conversation_request_attachments a where a.request_id=l.id and a.attachment_id is null))
    from lineage l;
$$;
revoke all on function public.conversation_native_ancestry_live(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.conversation_native_ancestry_live(uuid,uuid,uuid) to service_role;
