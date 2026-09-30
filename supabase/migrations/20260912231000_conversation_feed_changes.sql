-- Per-adult commit-ordered invalidations. No transcript or tool payload lives
-- here. A snapshot and this head are read in one repeatable-read transaction.
alter table public.conversation_records add column feed_position bigint not null default 0 check (feed_position >= 0);
create table public.conversation_feed_changes (
  conversation_id uuid not null references public.conversation_records(id) on delete cascade,
  position bigint not null check (position > 0),
  message_id uuid not null,
  source_session_id text not null,
  action text not null check (action in ('invalidate','delete')),
  primary key(conversation_id,position)
);
alter table public.conversation_feed_changes enable row level security;
revoke all on public.conversation_feed_changes from public,anon,authenticated;

create function public.append_conversation_feed_change(target_family uuid,target_adult uuid,target_message uuid,target_session text,target_action text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare record_id uuid; next_position bigint;
begin
  if target_adult is null or target_message is null or target_session is null then return; end if;
  select id into record_id from public.conversation_records
    where family_id=target_family and member_user_id=target_adult for update;
  if record_id is null then
    -- Legacy writers may precede the first v2 visit. Never recreate records
    -- during family/account deletion or invent ownership for null legacy rows.
    insert into public.conversation_records(family_id,member_user_id)
      select target_family,target_adult from public.family_members fm
      join public.families f on f.id=fm.family_id join auth.users u on u.id=fm.user_id
      where fm.family_id=target_family and fm.user_id=target_adult and f.status <> 'deleted'
      on conflict(family_id,member_user_id) do nothing;
    select id into record_id from public.conversation_records
      where family_id=target_family and member_user_id=target_adult for update;
  end if;
  if record_id is null then return; end if;
  update public.conversation_records set feed_position=feed_position+1 where id=record_id returning feed_position into next_position;
  insert into public.conversation_feed_changes(conversation_id,position,message_id,source_session_id,action)
    values(record_id,next_position,target_message,target_session,target_action);
end;
$$;
revoke all on function public.append_conversation_feed_change(uuid,uuid,uuid,text,text) from public,anon,authenticated;

create function public.invalidate_conversation_feed_message(target_message uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare message public.conversation_messages%rowtype;
begin
  select * into message from public.conversation_messages where id=target_message;
  if found and message.visibility='family' then
    perform public.append_conversation_feed_change(message.family_id,message.member_user_id,message.id,message.session_id,'invalidate');
  end if;
end;
$$;
revoke all on function public.invalidate_conversation_feed_message(uuid) from public,anon,authenticated;

create function public.track_conversation_feed_message() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op <> 'INSERT' and old.visibility='family' and old.member_user_id is not null then
    if tg_op='DELETE' then
      perform public.append_conversation_feed_change(old.family_id,old.member_user_id,old.id,old.session_id,'delete');
    elsif new.visibility <> 'family' or new.member_user_id is distinct from old.member_user_id or new.family_id <> old.family_id then
      perform public.append_conversation_feed_change(old.family_id,old.member_user_id,old.id,old.session_id,'delete');
    end if;
  end if;
  if tg_op <> 'DELETE' and new.visibility='family' and new.member_user_id is not null then
    perform public.append_conversation_feed_change(new.family_id,new.member_user_id,new.id,new.session_id,'invalidate');
  end if;
  return null;
end;
$$;
revoke all on function public.track_conversation_feed_message() from public,anon,authenticated;
create trigger conversation_feed_message_change after insert or update or delete on public.conversation_messages
  for each row execute function public.track_conversation_feed_message();

create function public.track_conversation_feed_question() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op <> 'INSERT' then perform public.invalidate_conversation_feed_message(old.canonical_message_id); end if;
  if tg_op <> 'DELETE' then perform public.invalidate_conversation_feed_message(new.canonical_message_id); end if;
  return null;
end;
$$;
revoke all on function public.track_conversation_feed_question() from public,anon,authenticated;
create trigger conversation_feed_question_change after insert or update or delete on public.conversation_question_cards
  for each row execute function public.track_conversation_feed_question();

create function public.track_conversation_feed_request() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare message_id uuid;
begin
  if tg_op <> 'INSERT' then perform public.invalidate_conversation_feed_message(old.canonical_message_id); end if;
  if tg_op <> 'DELETE' then
    perform public.invalidate_conversation_feed_message(new.canonical_message_id);
    for message_id in select m.id from public.conversation_messages m
      join public.conversation_records c on c.id=new.conversation_id
      where m.family_id=c.family_id and m.member_user_id=c.member_user_id and m.session_id=new.execution_session_id
        and m.role='assistant' and m.visibility='family'
    loop perform public.invalidate_conversation_feed_message(message_id); end loop;
  end if;
  return null;
end;
$$;
revoke all on function public.track_conversation_feed_request() from public,anon,authenticated;
create trigger conversation_feed_request_change after insert or update or delete on public.conversation_requests
  for each row execute function public.track_conversation_feed_request();

create function public.invalidate_conversation_feed_material_session(target_family uuid,target_session text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare message_id uuid;
begin
  -- One invalidation per adult/session reloads its material list, including an
  -- empty list after deletion. No other adult's conversation is inferred.
  for message_id in select distinct on(m.member_user_id) m.id from public.conversation_messages m
    where m.family_id=target_family and m.session_id=target_session and m.member_user_id is not null and m.visibility='family'
    order by m.member_user_id,m.created_at desc,m.id desc
  loop perform public.invalidate_conversation_feed_message(message_id); end loop;
end;
$$;
revoke all on function public.invalidate_conversation_feed_material_session(uuid,text) from public,anon,authenticated;
create function public.track_conversation_feed_material() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op <> 'INSERT' then perform public.invalidate_conversation_feed_material_session(old.family_id,old.generation->>'sessionId'); end if;
  if tg_op <> 'DELETE' then perform public.invalidate_conversation_feed_material_session(new.family_id,new.generation->>'sessionId'); end if;
  return null;
end;
$$;
revoke all on function public.track_conversation_feed_material() from public,anon,authenticated;
create trigger conversation_feed_material_change after insert or update or delete on public.materials
  for each row execute function public.track_conversation_feed_material();

create function public.track_conversation_feed_attachment() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare message_id uuid; attachment uuid;
begin
  attachment := case when tg_op='DELETE' then old.id else new.id end;
  for message_id in select r.canonical_message_id from public.conversation_requests r
    join public.conversation_request_attachments a on a.request_id=r.id
    where a.original_attachment_id=attachment
  loop perform public.invalidate_conversation_feed_message(message_id); end loop;
  return null;
end;
$$;
revoke all on function public.track_conversation_feed_attachment() from public,anon,authenticated;
create trigger conversation_feed_attachment_change after update or delete on public.chat_attachments
  for each row execute function public.track_conversation_feed_attachment();

create function public.track_conversation_feed_preparation() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare message_id uuid; attachment uuid;
begin
  attachment := case when tg_op='DELETE' then old.attachment_id else new.attachment_id end;
  for message_id in select r.canonical_message_id from public.conversation_requests r
    join public.conversation_request_attachments a on a.request_id=r.id
    where a.original_attachment_id=attachment
  loop perform public.invalidate_conversation_feed_message(message_id); end loop;
  return null;
end;
$$;
revoke all on function public.track_conversation_feed_preparation() from public,anon,authenticated;
create trigger conversation_feed_preparation_change after update or delete on public.conversation_attachment_preparations
  for each row execute function public.track_conversation_feed_preparation();

create function public.track_conversation_feed_delivery() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op <> 'INSERT' then perform public.invalidate_conversation_feed_message(old.message_id); end if;
  if tg_op <> 'DELETE' then perform public.invalidate_conversation_feed_message(new.message_id); end if;
  return null;
end;
$$;
revoke all on function public.track_conversation_feed_delivery() from public,anon,authenticated;
create trigger conversation_feed_delivery_change after insert or update or delete on public.conversation_deliveries
  for each row execute function public.track_conversation_feed_delivery();
