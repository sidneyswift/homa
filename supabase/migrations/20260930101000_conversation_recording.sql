-- Conversation recording is infrastructure, not a model-selected save action.
-- Expanding the content constraint is compatible with existing writers/readers.
alter table public.conversation_messages
  drop constraint conversation_messages_content_check;
alter table public.conversation_messages
  add constraint conversation_messages_content_check check (char_length(content) >= 1);

-- A permanent adult-scoped record, independent of replaceable runtime sessions.
create table public.conversation_records (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  next_position bigint not null default 0 check (next_position >= 0),
  created_at timestamptz not null default now(),
  unique (family_id, member_user_id)
);

-- Content-only events. Never credentials, hidden reasoning, tool arguments or audio.
-- Keep revisions as evidence; readable canonical messages remain the public history.
create table public.conversation_record_events (
  conversation_id uuid not null references public.conversation_records(id) on delete cascade,
  position bigint not null check (position > 0),
  source_session_id text not null,
  source_event_key text not null,
  event_kind text not null check (event_kind in ('message.received', 'message.appended', 'message.completed')),
  role text not null check (role in ('user', 'assistant')),
  turn_id text not null,
  message_sequence integer not null,
  step_index integer not null,
  content_offset integer not null check (content_offset >= 0),
  content text not null,
  finish_reason text,
  canonical_message_id uuid references public.conversation_messages(id) on delete cascade,
  recorded_at timestamptz not null default clock_timestamp(),
  primary key (conversation_id, position),
  unique (conversation_id, source_session_id, source_event_key)
);
create index conversation_record_events_message_idx on public.conversation_record_events(canonical_message_id)
  where canonical_message_id is not null;
create index conversation_record_events_source_idx on public.conversation_record_events
  (conversation_id, source_session_id, turn_id, message_sequence);

alter table public.conversation_records enable row level security;
alter table public.conversation_record_events enable row level security;
revoke all on public.conversation_records, public.conversation_record_events from public, anon, authenticated;
-- Raw revisions are server-only. Published history continues through existing RLS.
grant select on public.conversation_records to authenticated;
create policy conversation_records_own on public.conversation_records for select to authenticated
  using (member_user_id = auth.uid() and public.is_family_member(family_id));

-- Content-free source identities prevent a later source replay from restoring a
-- deleted message. They disappear with the adult's record on account erasure.
create table public.conversation_record_deletions (
  conversation_id uuid not null references public.conversation_records(id) on delete cascade,
  source_session_id text not null,
  turn_id text not null,
  message_sequence integer not null,
  role text not null check (role in ('user', 'assistant')),
  primary key (conversation_id, source_session_id, turn_id, message_sequence, role)
);
alter table public.conversation_record_deletions enable row level security;
revoke all on public.conversation_record_deletions from public, anon, authenticated;

-- Delete by source identity as well as FK. A crash between canonical commit and
-- linking must not leave unlinked revisions behind. Serialize against the same
-- adult record lock used by the recorder before writing the deletion marker.
create function public.erase_conversation_recording() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare record_id uuid;
begin
  if old.member_user_id is null or old.turn_id is null then return old; end if;
  -- Deletion can precede the first recorder write. Create the content-free
  -- owner record so a later durable-source replay still finds the tombstone.
  -- During actual account/family erasure the parent may already be gone.
  -- Off: no rebuild record exists to tombstone, and account erasure must never
  -- insert rows beneath a family it is deleting.
  if public.conversation_rebuild_enabled() then
    insert into public.conversation_records(family_id, member_user_id)
      select old.family_id, old.member_user_id
      where exists (select 1 from public.families where id = old.family_id)
        and exists (select 1 from auth.users where id = old.member_user_id)
      on conflict (family_id, member_user_id) do nothing;
  end if;
  select id into record_id from public.conversation_records
    where family_id = old.family_id and member_user_id = old.member_user_id
    for update;
  if record_id is null then return old; end if;
  insert into public.conversation_record_deletions
    (conversation_id, source_session_id, turn_id, message_sequence, role)
    values (record_id, old.session_id, old.turn_id, old.sequence, old.role)
    on conflict do nothing;
  delete from public.conversation_record_events
    where conversation_id = record_id and source_session_id = old.session_id
      and turn_id = old.turn_id and message_sequence = old.sequence and role = old.role;
  return old;
end;
$$;
revoke all on function public.erase_conversation_recording() from public, anon, authenticated;
create trigger conversation_recording_erase before delete on public.conversation_messages
  for each row execute function public.erase_conversation_recording();
