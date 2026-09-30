-- Model preparation belongs to the attachment receipt, never a browser URL.
-- Keep extracted private content outside the family-readable attachment table.
create table public.conversation_attachment_preparations (
  attachment_id uuid primary key references public.chat_attachments(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  blob_url text not null,
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  unique (family_id,member_user_id,blob_url)
);
alter table public.conversation_attachment_preparations enable row level security;
revoke all on public.conversation_attachment_preparations from public,anon,authenticated;

create table public.conversation_request_attachments (
  request_id uuid not null references public.conversation_requests(id) on delete cascade,
  ordinal integer not null check (ordinal between 0 and 5),
  original_attachment_id uuid not null,
  attachment_id uuid references public.conversation_attachment_preparations(attachment_id) on delete set null,
  primary key (request_id,ordinal),
  unique (request_id,original_attachment_id)
);
alter table public.conversation_request_attachments enable row level security;
revoke all on public.conversation_request_attachments from public,anon,authenticated;

-- Erasing a sent input also removes its attachment associations. Deleting a
-- library attachment leaves only an opaque tombstone and cannot restart work.
create function public.erase_conversation_request_attachments() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  delete from public.conversation_request_attachments a using public.conversation_requests r
    where a.request_id=r.id and r.canonical_message_id=old.id;
  return old;
end;
$$;
revoke all on function public.erase_conversation_request_attachments() from public,anon,authenticated;
create trigger conversation_attachment_associations_erase before delete on public.conversation_messages
  for each row execute function public.erase_conversation_request_attachments();

create function public.revoke_deleted_conversation_attachment() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  -- Derived input summaries contain private extraction, while canonical input
  -- retains the parent's exact words independently of the erased file.
  perform c.id from public.conversation_records c where exists (
    select 1 from public.conversation_requests r join public.conversation_request_attachments a on a.request_id=r.id
    where r.conversation_id=c.id and a.attachment_id=old.attachment_id) for update;
  insert into public.conversation_record_deletions(conversation_id,source_session_id,turn_id,message_sequence,role)
    select r.conversation_id,r.execution_session_id,r.execution_turn_id,r.execution_sequence,'user'
    from public.conversation_requests r join public.conversation_request_attachments a on a.request_id=r.id
    where a.attachment_id=old.attachment_id and r.execution_session_id is not null on conflict do nothing;
  delete from public.conversation_record_events e using public.conversation_requests r,public.conversation_request_attachments a
    where a.request_id=r.id and a.attachment_id=old.attachment_id and e.conversation_id=r.conversation_id
      and e.source_session_id=r.execution_session_id and e.turn_id=r.execution_turn_id
      and e.message_sequence=r.execution_sequence and e.role='user';
  update public.conversation_requests r set state='revoked',lease_token=null,lease_until=null,updated_at=clock_timestamp()
    where r.state in ('queued','leased') and exists (select 1 from public.conversation_request_attachments a
      where a.request_id=r.id and a.attachment_id=old.attachment_id);
  return old;
end;
$$;
revoke all on function public.revoke_deleted_conversation_attachment() from public,anon,authenticated;
create trigger conversation_attachment_revoke before delete on public.conversation_attachment_preparations
  for each row execute function public.revoke_deleted_conversation_attachment();
