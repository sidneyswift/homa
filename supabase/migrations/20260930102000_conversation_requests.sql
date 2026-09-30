-- A submitted intent, its canonical input and dispatch state commit together.
-- Runtime ownership is permanent once claimed. A delivery lease is not permission
-- to restart an execution whose outcome is unknown.
alter table public.conversation_records add column access_epoch uuid not null default gen_random_uuid();
create table public.conversation_requests (
  id uuid primary key,
  conversation_id uuid not null references public.conversation_records(id) on delete cascade,
  client_intent_id uuid not null,
  access_epoch uuid not null,
  acceptance_order bigint generated always as identity,
  payload_hash text check (payload_hash ~ '^[a-f0-9]{64}$'),
  canonical_message_id uuid unique references public.conversation_messages(id) on delete set null,
  episode_id uuid references public.conversation_episodes(id) on delete set null,
  state text not null default 'queued' check (state in
    ('queued', 'leased', 'executing', 'recovery_required', 'completed', 'failed', 'deleted', 'revoked')),
  lease_token uuid,
  lease_until timestamptz,
  execution_session_id text,
  execution_turn_id text,
  execution_sequence integer,
  accepted_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (conversation_id, client_intent_id),
  unique (execution_session_id, execution_turn_id, execution_sequence),
  check ((execution_session_id is null and execution_turn_id is null and execution_sequence is null)
    or (execution_session_id is not null and execution_turn_id is not null
      and execution_sequence is not null and execution_sequence >= 0)),
  check (state not in ('executing', 'recovery_required', 'completed', 'failed') or execution_session_id is not null),
  check (state <> 'leased' or (lease_token is not null and lease_until is not null)),
  check (state = 'deleted' or (canonical_message_id is not null and payload_hash is not null))
);
create index conversation_requests_pending_idx
  on public.conversation_requests(conversation_id, acceptance_order)
  where state in ('queued', 'leased', 'executing', 'recovery_required');
alter table public.conversation_requests enable row level security;
revoke all on public.conversation_requests from public, anon, authenticated;

-- Keep only the intent tombstone after message deletion. A reconnect must not
-- recreate erased text or dispatch erased work. No duplicate text lives here.
create function public.erase_conversation_request() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.conversation_requests
    set state = 'deleted', payload_hash = null, canonical_message_id = null,
        lease_token = null, lease_until = null, updated_at = clock_timestamp()
    where canonical_message_id = old.id;
  return old;
end;
$$;
revoke all on function public.erase_conversation_request() from public, anon, authenticated;
create trigger conversation_request_erase before delete on public.conversation_messages
  for each row execute function public.erase_conversation_request();

-- Access revocation is not history erasure. Rotate the admission generation so
-- rejoining never silently resumes a queue created under the old membership.
create function public.revoke_conversation_request_access() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare record_id uuid;
begin
  update public.conversation_records set access_epoch = gen_random_uuid()
    where family_id = old.family_id and member_user_id = old.user_id returning id into record_id;
  if record_id is not null then
    update public.conversation_requests
      set state = 'revoked', lease_token = null, lease_until = null, updated_at = clock_timestamp()
      where conversation_id = record_id and state in ('queued', 'leased');
  end if;
  return old;
end;
$$;
revoke all on function public.revoke_conversation_request_access() from public, anon, authenticated;
create trigger conversation_request_access_revoke after delete on public.family_members
  for each row execute function public.revoke_conversation_request_access();
