-- Prospective addressed content only. Existing canonical text is not evidence
-- of the bytes an adult received earlier, so there is deliberately no backfill.
create table public.conversation_delivery_snapshots (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null unique references public.conversation_deliveries(id) on delete cascade,
  conversation_id uuid not null references public.conversation_records(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  recipient_member_user_id uuid not null references auth.users(id) on delete cascade,
  access_epoch uuid not null,
  source_message_id uuid not null references public.conversation_messages(id) on delete cascade,
  channel text not null check (channel in ('web','sms','email')),
  content text not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  published_at timestamptz,
  check (content_hash=encode(sha256(convert_to(content,'UTF8')),'hex'))
);
create index conversation_delivery_snapshots_adult on public.conversation_delivery_snapshots(conversation_id,published_at desc,id desc);
create index conversation_delivery_snapshots_source on public.conversation_delivery_snapshots(source_message_id);
alter table public.conversation_delivery_snapshots enable row level security;
revoke all on public.conversation_delivery_snapshots from public,anon,authenticated;

create function public.guard_conversation_delivery_snapshot() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' then
    if row(new.id,new.delivery_id,new.conversation_id,new.family_id,new.recipient_member_user_id,new.access_epoch,
      new.source_message_id,new.channel,new.content,new.content_hash,new.created_at)
      is distinct from row(old.id,old.delivery_id,old.conversation_id,old.family_id,old.recipient_member_user_id,old.access_epoch,
      old.source_message_id,old.channel,old.content,old.content_hash,old.created_at)
      or (old.published_at is not null and new.published_at is distinct from old.published_at) then
      raise exception 'Immutable conversation delivery snapshot';
    end if;
  end if;
  if not exists (select 1 from public.conversation_deliveries d
    join public.conversation_messages m on m.id=d.message_id and m.family_id=d.family_id and m.episode_id=d.episode_id
    join public.conversation_records c on c.id=new.conversation_id and c.family_id=d.family_id
      and c.member_user_id=d.recipient_member_user_id and c.access_epoch=new.access_epoch
    join public.family_members fm on fm.family_id=c.family_id and fm.user_id=c.member_user_id
    join public.families f on f.id=c.family_id
    where d.id=new.delivery_id and d.family_id=new.family_id and d.recipient_member_user_id=new.recipient_member_user_id
      and d.message_id=new.source_message_id and d.channel=new.channel and m.role='assistant' and f.status<>'deleted'
      and (tg_op<>'INSERT' or (d.status='pending' and new.published_at is null))
      and (new.published_at is null or d.status='sent')) then
    raise exception 'Invalid conversation delivery snapshot scope';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_conversation_delivery_snapshot() from public,anon,authenticated;
create trigger conversation_delivery_snapshot_guard before insert or update on public.conversation_delivery_snapshots
  for each row execute function public.guard_conversation_delivery_snapshot();

create function public.track_conversation_feed_snapshot() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.conversation_rebuild_enabled() then return null; end if;
  if tg_op='DELETE' and old.published_at is not null then
    perform public.append_conversation_feed_change(old.family_id,old.recipient_member_user_id,old.id,'delivery:'||old.id::text,'delete');
  elsif tg_op<>'DELETE' and new.published_at is not null then
    perform public.append_conversation_feed_change(new.family_id,new.recipient_member_user_id,new.id,'delivery:'||new.id::text,'invalidate');
  end if;
  return null;
end;
$$;
revoke all on function public.track_conversation_feed_snapshot() from public,anon,authenticated;
create trigger conversation_feed_snapshot_change after insert or update or delete on public.conversation_delivery_snapshots
  for each row execute function public.track_conversation_feed_snapshot();

create function public.publish_conversation_delivery_snapshot() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare snapshot public.conversation_delivery_snapshots%rowtype;
begin
  if not public.conversation_rebuild_enabled() then return null; end if;
  if new.status='sent' then
    -- A removed/rejoined adult cannot regain an old pending grant. Recording
    -- provider completion still succeeds; the stale snapshot stays unpublished.
    update public.conversation_delivery_snapshots s set published_at=coalesce(new.sent_at,clock_timestamp())
      from public.conversation_records c,public.family_members fm,public.families f
      where s.delivery_id=new.id and s.published_at is null and s.recipient_member_user_id=new.recipient_member_user_id
        and c.id=s.conversation_id and c.access_epoch=s.access_epoch and fm.family_id=c.family_id and fm.user_id=c.member_user_id
        and f.id=c.family_id and f.status<>'deleted';
  end if;
  for snapshot in select * from public.conversation_delivery_snapshots where delivery_id=new.id and published_at is not null
  loop
    perform public.append_conversation_feed_change(snapshot.family_id,snapshot.recipient_member_user_id,snapshot.id,
      'delivery:'||snapshot.id::text,'invalidate');
  end loop;
  return null;
end;
$$;
revoke all on function public.publish_conversation_delivery_snapshot() from public,anon,authenticated;
create trigger conversation_delivery_snapshot_publish after update of status,sent_at,recipient_member_user_id on public.conversation_deliveries
  for each row execute function public.publish_conversation_delivery_snapshot();

create function public.track_conversation_snapshot_source_owner() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare snapshot public.conversation_delivery_snapshots%rowtype;
begin
  if not public.conversation_rebuild_enabled() then return null; end if;
  if new.member_user_id is distinct from old.member_user_id or new.family_id<>old.family_id then
    for snapshot in select * from public.conversation_delivery_snapshots where source_message_id=new.id and published_at is not null
    loop
      perform public.append_conversation_feed_change(snapshot.family_id,snapshot.recipient_member_user_id,snapshot.id,
        'delivery:'||snapshot.id::text,'invalidate');
    end loop;
  end if;
  return null;
end;
$$;
revoke all on function public.track_conversation_snapshot_source_owner() from public,anon,authenticated;
create trigger conversation_snapshot_source_owner after update of member_user_id,family_id on public.conversation_messages
  for each row execute function public.track_conversation_snapshot_source_owner();
