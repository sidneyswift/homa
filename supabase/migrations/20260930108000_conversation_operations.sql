-- Private receipts for authored effects. The runtime call identity, never text
-- similarity, decides whether this is a replay of an admitted action.
create table public.conversation_operations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversation_records(id) on delete cascade,
  request_id uuid not null,
  access_epoch uuid not null,
  session_id text not null,
  turn_id text not null,
  call_id text not null,
  tool_name text not null,
  input_hash text not null,
  state text not null check (state in ('started','completed','unknown','erased')),
  result jsonb,
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  deadline_at timestamptz not null,
  foreign key (request_id,conversation_id) references public.conversation_requests(id,conversation_id) on delete cascade,
  unique (session_id,turn_id,call_id),
  check (state='completed' or result is null)
);
alter table public.conversation_operations enable row level security;
revoke all on public.conversation_operations from public,anon,authenticated;
create index conversation_operations_request on public.conversation_operations(request_id,state);

create function public.erase_conversation_operation_results() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.canonical_message_id is null then
    update public.conversation_operations set state='erased',result=null,finished_at=clock_timestamp()
      where request_id=new.id and conversation_id=new.conversation_id;
  end if;
  return new;
end;
$$;
revoke all on function public.erase_conversation_operation_results() from public,anon,authenticated;
create trigger conversation_operation_erasure after update of canonical_message_id on public.conversation_requests
  for each row execute function public.erase_conversation_operation_results();

create function public.erase_attachment_operation_results() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.conversation_operations o set state='erased',result=null,finished_at=clock_timestamp()
    from public.conversation_request_attachments a where a.request_id=o.request_id and a.attachment_id=old.attachment_id;
  return old;
end;
$$;
revoke all on function public.erase_attachment_operation_results() from public,anon,authenticated;
create trigger conversation_attachment_operation_erasure before delete on public.conversation_attachment_preparations
  for each row execute function public.erase_attachment_operation_results();

-- An executing answer may already have read the deleted card. Its late tool
-- result must not become a second durable copy of that erased context.
create function public.erase_question_operation_results() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.state='deleted' or new.canonical_message_id is null then
    update public.conversation_operations o set state='erased',result=null,finished_at=clock_timestamp()
      from public.conversation_requests r where r.id=o.request_id and r.conversation_id=new.conversation_id
        and r.reply_question_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.erase_question_operation_results() from public,anon,authenticated;
create trigger conversation_question_operation_erasure after update of state,canonical_message_id on public.conversation_question_cards
  for each row execute function public.erase_question_operation_results();
