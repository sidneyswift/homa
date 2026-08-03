-- One canonical family event may belong to several children. The event row
-- still owns timing, recurrence, title, and deletion. Child links own only
-- audience, so editing a shared appointment can never split into drifting
-- duplicate events.

create unique index if not exists family_events_family_identity_idx
  on public.family_events (id, family_id);

create table if not exists public.family_event_children (
  family_id uuid not null references public.families (id) on delete cascade,
  event_id uuid not null,
  child_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (event_id, child_id),
  foreign key (event_id, family_id)
    references public.family_events (id, family_id)
    on delete cascade,
  foreign key (child_id, family_id)
    references public.children (id, family_id)
    on delete cascade
);

create index if not exists family_event_children_family_child_idx
  on public.family_event_children (family_id, child_id, event_id);

insert into public.family_event_children (family_id, event_id, child_id)
select family_id, id, child_id
from public.family_events
where child_id is not null
on conflict (event_id, child_id) do nothing;

alter table public.family_event_children enable row level security;

drop policy if exists "members read their family event children"
  on public.family_event_children;
create policy "members read their family event children"
  on public.family_event_children for select to authenticated
  using (public.is_family_member(family_id));

drop policy if exists "members add their family event children"
  on public.family_event_children;
create policy "members add their family event children"
  on public.family_event_children for insert to authenticated
  with check (public.is_family_member(family_id));

drop policy if exists "members remove their family event children"
  on public.family_event_children;
create policy "members remove their family event children"
  on public.family_event_children for delete to authenticated
  using (public.is_family_member(family_id));

revoke all on table public.family_event_children from anon;
grant select, insert, delete on table public.family_event_children to authenticated;

-- Saves one event and its child audience in one database transaction. The
-- caller supplies family_id for defense-in-depth scoping, but membership and
-- every child relationship are rechecked in the database. Empty child_ids
-- means the whole family. child_id remains a one-child compatibility marker
-- for older clients; family_event_children is the multi-child source.
create or replace function public.save_family_event_with_children(
  p_mode text,
  p_event_id uuid,
  p_family_id uuid,
  p_title text,
  p_starts_on date,
  p_ends_on date,
  p_start_time time,
  p_end_time time,
  p_note text,
  p_recurrence_rule jsonb,
  p_child_ids uuid[]
) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  normalized_child_ids uuid[];
  legacy_child_id uuid;
  saved_event_id uuid;
begin
  if p_mode not in ('create', 'update') then
    raise exception using
      errcode = '22023',
      message = 'family event save mode must be create or update';
  end if;

  if not public.is_family_member(p_family_id) then
    raise exception using
      errcode = '42501',
      message = 'family event family is not available to this member';
  end if;

  if cardinality(coalesce(p_child_ids, '{}'::uuid[])) > 100
     or array_position(coalesce(p_child_ids, '{}'::uuid[]), null) is not null then
    raise exception using
      errcode = '22023',
      message = 'family event child list is invalid';
  end if;

  select coalesce(array_agg(candidate.child_id order by candidate.child_id), '{}'::uuid[])
  into normalized_child_ids
  from (
    select distinct requested.child_id
    from unnest(coalesce(p_child_ids, '{}'::uuid[])) requested(child_id)
  ) candidate;

  if exists (
    select 1
    from unnest(normalized_child_ids) requested(child_id)
    left join public.children child
      on child.id = requested.child_id
     and child.family_id = p_family_id
    where child.id is null
  ) then
    raise exception using
      errcode = '23503',
      message = 'family event child is not in this family';
  end if;

  legacy_child_id := normalized_child_ids[1];

  if p_mode = 'create' then
    insert into public.family_events (
      id,
      family_id,
      child_id,
      title,
      starts_on,
      ends_on,
      start_time,
      end_time,
      note,
      recurrence_rule
    ) values (
      p_event_id,
      p_family_id,
      legacy_child_id,
      p_title,
      p_starts_on,
      p_ends_on,
      p_start_time,
      p_end_time,
      p_note,
      p_recurrence_rule
    )
    on conflict (id) do update
    set child_id = excluded.child_id,
        title = excluded.title,
        starts_on = excluded.starts_on,
        ends_on = excluded.ends_on,
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        note = excluded.note,
        recurrence_rule = excluded.recurrence_rule
    where family_events.family_id = excluded.family_id
    returning id into saved_event_id;
  else
    update public.family_events
    set child_id = legacy_child_id,
        title = p_title,
        starts_on = p_starts_on,
        ends_on = p_ends_on,
        start_time = p_start_time,
        end_time = p_end_time,
        note = p_note,
        recurrence_rule = p_recurrence_rule
    where id = p_event_id
      and family_id = p_family_id
    returning id into saved_event_id;
  end if;

  if saved_event_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'family event was not found in this family';
  end if;

  delete from public.family_event_children
  where event_id = saved_event_id
    and family_id = p_family_id;

  insert into public.family_event_children (family_id, event_id, child_id)
  select p_family_id, saved_event_id, requested.child_id
  from unnest(normalized_child_ids) requested(child_id);

  return saved_event_id;
end;
$$;

revoke all on function public.save_family_event_with_children(
  text, uuid, uuid, text, date, date, time, time, text, jsonb, uuid[]
) from public;
grant execute on function public.save_family_event_with_children(
  text, uuid, uuid, text, date, date, time, time, text, jsonb, uuid[]
) to authenticated;

comment on table public.family_event_children is
  'Children explicitly included in one family event. No rows means the event is for the whole family.';
