-- A weekly series stays canonical in family_events. This table records the
-- few dated occurrences a parent cancels or moves without copying the series.

create or replace function public.is_family_event_occurrence(
  recurrence_rule jsonb,
  series_starts_on date,
  occurrence_on date
) returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  elapsed_days integer;
  elapsed_weeks integer;
  occurrence_weekday integer;
  recurrence_until date;
begin
  if recurrence_rule is null or series_starts_on is null or occurrence_on is null then
    return false;
  end if;
  if not public.is_valid_family_event_recurrence(recurrence_rule, series_starts_on) then
    return false;
  end if;
  if occurrence_on < series_starts_on then return false; end if;

  if recurrence_rule ? 'until' and recurrence_rule -> 'until' <> 'null'::jsonb then
    recurrence_until := (recurrence_rule ->> 'until')::date;
    if occurrence_on > recurrence_until then return false; end if;
  end if;

  elapsed_days := occurrence_on - series_starts_on;
  elapsed_weeks := floor(elapsed_days / 7.0)::integer;
  occurrence_weekday := extract(dow from occurrence_on)::integer;

  return elapsed_weeks % ((recurrence_rule ->> 'interval')::integer) = 0
    and (recurrence_rule -> 'weekdays') @> to_jsonb(array[occurrence_weekday]);
end;
$$;

create table if not exists public.family_event_occurrence_exceptions (
  family_id uuid not null references public.families (id) on delete cascade,
  event_id uuid not null,
  occurrence_on date not null,
  kind text not null,
  starts_on date,
  ends_on date,
  start_time time,
  end_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, occurrence_on),
  foreign key (event_id, family_id)
    references public.family_events (id, family_id)
    on delete cascade,
  constraint family_event_occurrence_exception_kind
    check (kind in ('cancelled', 'moved')),
  constraint family_event_occurrence_exception_shape
    check (
      (
        kind = 'cancelled'
        and starts_on is null
        and ends_on is null
        and start_time is null
        and end_time is null
      )
      or
      (
        kind = 'moved'
        and starts_on is not null
        and ends_on is not null
        and ends_on >= starts_on
        and (
          start_time is null
          or end_time is null
          or ends_on > starts_on
          or end_time > start_time
        )
      )
    )
);

create index if not exists family_event_occurrence_exceptions_family_date_idx
  on public.family_event_occurrence_exceptions (family_id, occurrence_on, starts_on);

alter table public.family_event_occurrence_exceptions enable row level security;

drop policy if exists "members read their family event occurrence exceptions"
  on public.family_event_occurrence_exceptions;
create policy "members read their family event occurrence exceptions"
  on public.family_event_occurrence_exceptions for select to authenticated
  using (public.is_family_member(family_id));

revoke all on table public.family_event_occurrence_exceptions from anon;
revoke all on table public.family_event_occurrence_exceptions from authenticated;
grant select on table public.family_event_occurrence_exceptions to authenticated;

-- The client supplies family_id only for defense in depth. Membership, event
-- tenancy, recurrence membership, and the replacement timing are rechecked
-- before the security-definer function writes anything.
create or replace function public.save_family_event_occurrence_exception(
  p_event_id uuid,
  p_family_id uuid,
  p_occurrence_on date,
  p_kind text,
  p_starts_on date,
  p_ends_on date,
  p_start_time time,
  p_end_time time
) returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_starts_on date;
  event_recurrence_rule jsonb;
begin
  if not public.is_family_member(p_family_id) then
    raise exception using
      errcode = '42501',
      message = 'family event family is not available to this member';
  end if;

  select starts_on, recurrence_rule
  into event_starts_on, event_recurrence_rule
  from public.family_events
  where id = p_event_id
    and family_id = p_family_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'family event was not found in this family';
  end if;
  if not public.is_family_event_occurrence(
    event_recurrence_rule,
    event_starts_on,
    p_occurrence_on
  ) then
    raise exception using
      errcode = '22023',
      message = 'family event occurrence is not in this series';
  end if;
  if p_kind not in ('cancelled', 'moved') then
    raise exception using
      errcode = '22023',
      message = 'family event occurrence change must be cancelled or moved';
  end if;
  if p_kind = 'cancelled' and (
    p_starts_on is not null
    or p_ends_on is not null
    or p_start_time is not null
    or p_end_time is not null
  ) then
    raise exception using
      errcode = '22023',
      message = 'cancelled family event occurrence cannot carry replacement timing';
  end if;
  if p_kind = 'moved' and (
    p_starts_on is null
    or p_ends_on is null
    or p_ends_on < p_starts_on
    or (
      p_start_time is not null
      and p_end_time is not null
      and p_ends_on = p_starts_on
      and p_end_time <= p_start_time
    )
  ) then
    raise exception using
      errcode = '22023',
      message = 'moved family event occurrence timing is invalid';
  end if;

  insert into public.family_event_occurrence_exceptions (
    family_id,
    event_id,
    occurrence_on,
    kind,
    starts_on,
    ends_on,
    start_time,
    end_time
  ) values (
    p_family_id,
    p_event_id,
    p_occurrence_on,
    p_kind,
    p_starts_on,
    p_ends_on,
    p_start_time,
    p_end_time
  )
  on conflict (event_id, occurrence_on) do update
  set kind = excluded.kind,
      starts_on = excluded.starts_on,
      ends_on = excluded.ends_on,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      updated_at = now()
  where family_event_occurrence_exceptions.family_id = excluded.family_id;

  return p_occurrence_on;
end;
$$;

revoke all on function public.save_family_event_occurrence_exception(
  uuid, uuid, date, text, date, date, time, time
) from public;
grant execute on function public.save_family_event_occurrence_exception(
  uuid, uuid, date, text, date, date, time, time
) to authenticated;

comment on table public.family_event_occurrence_exceptions is
  'Dated cancellations and timing replacements for one occurrence of a recurring family event.';
