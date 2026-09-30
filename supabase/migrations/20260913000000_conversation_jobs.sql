-- A background job is a separate effect owner, linked to its accepted request.
-- Its private parent brief never enters the older family-readable job plan.
create table public.conversation_jobs (
  job_id uuid primary key references public.agent_jobs(id) on delete cascade,
  conversation_id uuid not null references public.conversation_records(id) on delete cascade,
  request_id uuid not null references public.conversation_requests(id) on delete cascade,
  operation_id uuid not null unique references public.conversation_operations(id) on delete cascade,
  access_epoch uuid not null,
  message_id uuid not null unique default gen_random_uuid(),
  title text not null,
  plan jsonb not null,
  source_session_id text not null,
  lease_token uuid not null default gen_random_uuid(),
  execution_session_id text unique,
  execution_turn_id text,
  execution_sequence integer,
  state text not null default 'queued' check(state in ('queued','dispatched','executing','recovery_required','completed','revoked')),
  created_at timestamptz not null default clock_timestamp(),
  check ((execution_session_id is null and execution_turn_id is null and execution_sequence is null)
    or (execution_session_id is not null and execution_turn_id is not null and execution_sequence is not null and execution_sequence>=0))
);
alter table public.conversation_jobs enable row level security;
revoke all on public.conversation_jobs from public,anon,authenticated;

create function public.track_conversation_job_feed() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.conversation_jobs%rowtype; c public.conversation_records%rowtype;
begin
  if tg_table_name='conversation_jobs' then
    if tg_op='DELETE' then j=old; else j=new; end if;
  elsif tg_table_name='agent_jobs' then
    select * into j from public.conversation_jobs where job_id=new.id;
  else
    if tg_op='DELETE' then select * into j from public.conversation_jobs where job_id=old.job_id;
    else select * into j from public.conversation_jobs where job_id=new.job_id; end if;
  end if;
  if j.job_id is null then return null; end if;
  select * into c from public.conversation_records where id=j.conversation_id;
  if c.id is not null then
    perform public.append_conversation_feed_change(c.family_id,c.member_user_id,j.message_id,'job:'||j.job_id::text,
      case when (tg_table_name='conversation_jobs' and tg_op='DELETE') or j.state='revoked' then 'delete' else 'invalidate' end);
  end if;
  return null;
end;
$$;
revoke all on function public.track_conversation_job_feed() from public,anon,authenticated;
create trigger conversation_jobs_feed after insert or update or delete on public.conversation_jobs for each row execute function public.track_conversation_job_feed();
create trigger conversation_jobs_status_feed after update on public.agent_jobs for each row execute function public.track_conversation_job_feed();
create trigger conversation_jobs_artifacts_feed after insert or update or delete on public.agent_job_stage_artifacts for each row execute function public.track_conversation_job_feed();

create function public.revoke_conversation_jobs() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.canonical_message_id is null or new.state='revoked' then
    update public.conversation_jobs set state='revoked',title='Unavailable work',plan='{}'::jsonb
      where request_id=new.id and state<>'revoked';
    update public.agent_jobs set status='cancelled',cancel_requested_at=coalesce(cancel_requested_at,clock_timestamp()),
      cancelled_at=clock_timestamp(),completed_at=null,delivered_at=null,delivered_channel=null,delivery_summary=null,
      failure_reason=null,updated_at=clock_timestamp()
      where id in (select job_id from public.conversation_jobs where request_id=new.id) and status<>'cancelled';
  end if;
  return null;
end;
$$;
revoke all on function public.revoke_conversation_jobs() from public,anon,authenticated;
create trigger conversation_jobs_revoke after update of canonical_message_id,state on public.conversation_requests
  for each row execute function public.revoke_conversation_jobs();

-- Revocation also fences requests already marked completed, whose durable
-- jobs may still be running. The request-state trigger alone cannot cover them.
create function public.revoke_conversation_jobs_epoch() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.access_epoch is distinct from old.access_epoch then
    update public.conversation_jobs set state='revoked',title='Unavailable work',plan='{}'::jsonb
      where conversation_id=new.id and access_epoch<>new.access_epoch and state<>'revoked';
    update public.agent_jobs set status='cancelled',cancel_requested_at=coalesce(cancel_requested_at,clock_timestamp()),
      cancelled_at=clock_timestamp(),completed_at=null,delivered_at=null,delivered_channel=null,delivery_summary=null,
      failure_reason=null,updated_at=clock_timestamp()
      where id in (select job_id from public.conversation_jobs where conversation_id=new.id and state='revoked') and status<>'cancelled';
  end if;
  return null;
end;
$$;
revoke all on function public.revoke_conversation_jobs_epoch() from public,anon,authenticated;
create trigger conversation_jobs_epoch after update of access_epoch on public.conversation_records
  for each row execute function public.revoke_conversation_jobs_epoch();

create function public.guard_conversation_job_result() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.conversation_jobs where job_id=new.job_id) and not exists(
    select 1 from public.conversation_jobs j join public.conversation_records c on c.id=j.conversation_id
    join public.family_members fm on fm.family_id=c.family_id and fm.user_id=c.member_user_id
    join public.conversation_requests r on r.id=j.request_id join public.families f on f.id=c.family_id
    where j.job_id=new.job_id and j.state in ('executing','recovery_required','completed')
      and j.access_epoch=c.access_epoch and r.canonical_message_id is not null and f.status<>'deleted') then
    raise exception 'Conversation job result revoked';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_conversation_job_result() from public,anon,authenticated;
create trigger conversation_jobs_result_guard before insert or update on public.agent_job_stage_artifacts
  for each row execute function public.guard_conversation_job_result();

create function public.track_conversation_job_material() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare j record; material uuid;
begin
  material=case when tg_op='DELETE' then old.id else new.id end;
  for j in select l.message_id,l.job_id,c.family_id,c.member_user_id from public.conversation_jobs l
    join public.conversation_records c on c.id=l.conversation_id
    join public.agent_job_stage_artifacts a on a.job_id=l.job_id where a.material_id=material
  loop perform public.append_conversation_feed_change(j.family_id,j.member_user_id,j.message_id,'job:'||j.job_id::text,'invalidate'); end loop;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.track_conversation_job_material() from public,anon,authenticated;
create trigger conversation_job_material_change before update or delete on public.materials
  for each row execute function public.track_conversation_job_material();

create function public.track_conversation_native_feed() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op<>'INSERT' and old.canonical_message_id is not null then
    perform public.invalidate_conversation_feed_message(old.canonical_message_id);
  end if;
  if tg_op<>'DELETE' and new.canonical_message_id is not null then
    perform public.invalidate_conversation_feed_message(new.canonical_message_id);
  end if;
  return null;
end;
$$;
revoke all on function public.track_conversation_native_feed() from public,anon,authenticated;
create trigger conversation_native_feed after insert or update or delete on public.conversation_native_batches
  for each row execute function public.track_conversation_native_feed();
