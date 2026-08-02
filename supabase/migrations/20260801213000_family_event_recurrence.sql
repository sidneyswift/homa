-- Weekly recurrence for Homa family calendar commitments. Planner remains
-- the source of truth; device calendars receive a parent-approved copy.

create or replace function public.is_valid_family_event_recurrence(
  value jsonb,
  starts_on date
) returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  weekday jsonb;
  seen integer[] := '{}';
  interval_value numeric;
  until_value date;
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) <> 'object' or value ->> 'frequency' <> 'weekly' then
    return false;
  end if;
  if jsonb_typeof(value -> 'interval') <> 'number'
     or (value ->> 'interval') !~ '^[0-9]+$' then
    return false;
  end if;
  interval_value := (value ->> 'interval')::numeric;
  if interval_value <> trunc(interval_value)
     or interval_value < 1 or interval_value > 52 then return false; end if;
  if jsonb_typeof(value -> 'weekdays') <> 'array'
     or jsonb_array_length(value -> 'weekdays') < 1
     or jsonb_array_length(value -> 'weekdays') > 7 then
    return false;
  end if;
  for weekday in select * from jsonb_array_elements(value -> 'weekdays') loop
    if jsonb_typeof(weekday) <> 'number'
       or weekday::text !~ '^[0-6]$'
       or (weekday::text)::integer = any(seen) then
      return false;
    end if;
    seen := array_append(seen, (weekday::text)::integer);
  end loop;
  if value ? 'until' and value -> 'until' <> 'null'::jsonb then
    if jsonb_typeof(value -> 'until') <> 'string' then return false; end if;
    begin
      until_value := (value ->> 'until')::date;
    exception when others then
      return false;
    end;
    if until_value < starts_on then return false; end if;
  end if;
  return (value - array['frequency', 'interval', 'weekdays', 'until']) = '{}'::jsonb;
end;
$$;

alter table public.family_events
  add column if not exists recurrence_rule jsonb;

alter table public.family_events
  drop constraint if exists family_events_recurrence_rule_check;
alter table public.family_events
  add constraint family_events_recurrence_rule_check
  check (public.is_valid_family_event_recurrence(recurrence_rule, starts_on));

comment on column public.family_events.recurrence_rule is
  'Optional validated weekly series: frequency, interval, weekdays (Sunday 0), and nullable until. Expanded by Planner reads; Homa remains source of truth.';
