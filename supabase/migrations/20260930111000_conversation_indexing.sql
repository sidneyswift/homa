-- One metadata-only search job per canonical message. Provider failure never
-- changes whether the conversation itself was recorded.
alter table public.conversation_messages add column search_revision uuid not null default gen_random_uuid();
create index conversation_messages_missing_embedding on public.conversation_messages(created_at,id)
  where embedding is null and member_user_id is not null;

create table public.conversation_index_jobs (
  message_id uuid primary key references public.conversation_messages(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  member_user_id uuid references auth.users(id) on delete cascade,
  revision uuid not null,
  state text not null default 'pending' check (state in ('pending','leased','done','skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default clock_timestamp(),
  lease_token uuid,
  lease_until timestamptz,
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.conversation_index_jobs enable row level security;
revoke all on public.conversation_index_jobs from public,anon,authenticated;
create index conversation_index_jobs_due on public.conversation_index_jobs(next_attempt_at,message_id)
  where state in ('pending','leased');

create function public.advance_conversation_search_revision() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.conversation_rebuild_enabled() then return new; end if;
  if (new.content,new.family_id,new.member_user_id) is distinct from (old.content,old.family_id,old.member_user_id)
    or (old.embedding is not null and new.embedding is null) then
    new.search_revision := gen_random_uuid();
    new.embedding := null;
  end if;
  return new;
end;
$$;
revoke all on function public.advance_conversation_search_revision() from public,anon,authenticated;
create trigger zz_conversation_search_revision before update on public.conversation_messages
  for each row execute function public.advance_conversation_search_revision();

create function public.queue_conversation_search_revision() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.conversation_rebuild_enabled() then return new; end if;
  if tg_op='UPDATE' and new.search_revision=old.search_revision then return new; end if;
  insert into public.conversation_index_jobs(message_id,family_id,member_user_id,revision,next_attempt_at)
    values(new.id,new.family_id,new.member_user_id,new.search_revision,clock_timestamp()+interval '5 seconds')
    on conflict(message_id) do update set family_id=excluded.family_id,member_user_id=excluded.member_user_id,
      revision=excluded.revision,state='pending',attempts=0,next_attempt_at=excluded.next_attempt_at,
      lease_token=null,lease_until=null,updated_at=clock_timestamp();
  return new;
end;
$$;
revoke all on function public.queue_conversation_search_revision() from public,anon,authenticated;
create trigger conversation_search_queue after insert or update on public.conversation_messages
  for each row execute function public.queue_conversation_search_revision();

-- A lease from before access removal must not publish even if the adult rejoins.
create function public.revoke_conversation_search_lease() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.conversation_index_jobs set state='pending',lease_token=null,lease_until=null,
    next_attempt_at=clock_timestamp()+interval '5 minutes',updated_at=clock_timestamp()
    where family_id=old.family_id and member_user_id=old.user_id and state='leased';
  return old;
end;
$$;
revoke all on function public.revoke_conversation_search_lease() from public,anon,authenticated;
create trigger conversation_search_access_revoke after delete on public.family_members
  for each row execute function public.revoke_conversation_search_lease();
