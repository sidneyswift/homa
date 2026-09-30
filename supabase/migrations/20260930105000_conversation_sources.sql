-- Server-owned recovery cursor. No client can select or mutate runtime sources.
create table public.conversation_sources (
  session_id text primary key,
  conversation_id uuid not null references public.conversation_records(id) on delete cascade,
  request_id uuid not null unique,
  access_epoch uuid not null,
  next_source_index bigint not null default 0 check (next_source_index >= 0),
  state text not null default 'active' check (state in ('active','complete','blocked','revoked')),
  pending_input boolean not null default false,
  lease_token uuid,
  lease_until timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  foreign key(request_id,conversation_id) references public.conversation_requests(id,conversation_id) on delete cascade
);
alter table public.conversation_sources enable row level security;
revoke all on public.conversation_sources from public,anon,authenticated;
alter table public.conversation_messages add column recording_position bigint;

create function public.revoke_conversation_source_access() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.conversation_sources s set state='revoked',lease_token=null,lease_until=null
    from public.conversation_records c where c.id=s.conversation_id
      and c.family_id=old.family_id and c.member_user_id=old.user_id;
  return old;
end;
$$;
revoke all on function public.revoke_conversation_source_access() from public,anon,authenticated;
create trigger conversation_source_access_revoke after delete on public.family_members
  for each row execute function public.revoke_conversation_source_access();

-- Distinguish an absent final snapshot from an intentional empty revision.
alter table public.conversation_record_events add column snapshot_present boolean not null default true;
alter table public.conversation_record_events add column content_snapshot_hash text;

-- An explicit provider revision may clear a previously visible partial. Keep its
-- identity rather than deleting the row (deletion creates a privacy tombstone).
alter table public.conversation_messages drop constraint conversation_messages_content_check;
alter table public.conversation_messages add constraint conversation_messages_content_check check (char_length(content) >= 0);
