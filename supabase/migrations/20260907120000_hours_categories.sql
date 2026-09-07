-- #1035. Additive catalog; existing writers keep their custom_label contract.
create table public.hours_categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  subject text not null check (subject in ('reading','math','science','social studies','art','music','PE','co-op','life skills','other','spanish')),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  unique(family_id, subject, name)
);
alter table public.hours_categories enable row level security;
create policy hours_categories_family_read on public.hours_categories for select to authenticated using (public.is_family_member(family_id));
create policy hours_categories_family_insert on public.hours_categories for insert to authenticated with check (public.is_family_member(family_id));
create policy hours_categories_family_update on public.hours_categories for update to authenticated using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
grant select,insert,update on public.hours_categories to authenticated;
revoke all on public.hours_categories from anon;

-- Exact spelling is intentional: this is identity verification, not interpretation.
insert into public.hours_categories(family_id,subject,name)
select distinct family_id,subject,custom_label from public.hours_log where custom_label is not null;

create function public.keep_hours_category() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.custom_label is not null then
    insert into public.hours_categories(family_id,subject,name) values(new.family_id,new.subject,new.custom_label)
      on conflict(family_id,subject,name) do nothing;
    perform id from public.hours_categories
      where family_id=new.family_id and subject=new.subject and name=new.custom_label for key share;
    if not found then raise exception 'Category changed while recording time. Retry with the current category.' using errcode='40001'; end if;
  end if;
  return new;
end $$;
revoke all on function public.keep_hours_category() from public,anon,authenticated,service_role;
create trigger hours_keep_category before insert or update of family_id,subject,custom_label on public.hours_log
for each row execute function public.keep_hours_category();

-- Category identity and parent subject are stable. Renaming moves every current
-- annotation in the same transaction, preserving all other fields and receipts.
create function public.rename_hours_category_entries() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.id <> old.id or new.family_id <> old.family_id or new.subject <> old.subject then
    raise exception 'Category identity and subject are immutable' using errcode='23000';
  end if;
  return new;
end $$;
revoke all on function public.rename_hours_category_entries() from public,anon,authenticated,service_role;
create trigger hours_category_rename before update on public.hours_categories
for each row execute function public.rename_hours_category_entries();

-- The category relationship is enforced even under concurrent old-client writes.
-- Cascading rename owns the complete graph; deferred validation permits family
-- deletion/transfer to finish its existing multi-table transaction.
alter table public.hours_log add constraint hours_log_category_fkey
foreign key(family_id,subject,custom_label) references public.hours_categories(family_id,subject,name)
on update cascade deferrable initially deferred;

-- Caller RLS handles access. Pinned server channels use their authenticated
-- family with the same deterministic primitive, never a model-provided family.
create function public.save_hours_category(target_family_id uuid,target_subject text,target_name text,target_category_id uuid default null,expected_name text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare category public.hours_categories%rowtype;
begin
  if target_name is null or char_length(btrim(target_name)) not between 1 and 40
    or target_subject is null or target_subject not in ('reading','math','science','social studies','art','music','PE','co-op','life skills','other','spanish') then
    return jsonb_build_object('status','invalid');
  end if;
  if not exists(select 1 from public.families where id=target_family_id) then return jsonb_build_object('status','not_found'); end if;
  if target_category_id is null then
    insert into public.hours_categories(family_id,subject,name) values(target_family_id,target_subject,btrim(target_name))
      on conflict(family_id,subject,name) do nothing;
    select * into category from public.hours_categories where family_id=target_family_id and subject=target_subject and name=btrim(target_name);
  else
    select * into category from public.hours_categories where id=target_category_id and family_id=target_family_id and subject=target_subject for update;
    if category.id is null then return jsonb_build_object('status','not_found'); end if;
    if expected_name is null or category.name <> expected_name then return jsonb_build_object('status','conflict'); end if;
    update public.hours_categories set name=btrim(target_name) where id=category.id and family_id=target_family_id returning * into category;
  end if;
  return jsonb_build_object('status','saved','category',jsonb_build_object('id',category.id,'subject',category.subject,'name',category.name));
exception when unique_violation then return jsonb_build_object('status','duplicate');
end $$;
revoke all on function public.save_hours_category(uuid,text,text,uuid,text) from public,anon;
grant execute on function public.save_hours_category(uuid,text,text,uuid,text) to authenticated;

-- #1095: exact scoped Hours totals and a bounded entry sample in one snapshot.
-- Caller JWT/RLS remains authoritative. Server channels supply only their
-- already-authenticated family ID through the existing pinned access path.
create or replace function public.read_hours_category_summary(
  target_family_id uuid,
  requested_period text default 'week',
  target_child_id uuid default null,
  include_shared boolean default true,
  from_on text default null,
  through_on text default null,
  target_subject text default null,
  entry_limit integer default 20,
  reference_at timestamptz default statement_timestamp(),
  target_category_id uuid default null, uncategorized_only boolean default false
) returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  family public.families%rowtype;
  zone text;
  today date;
  start_on date;
  end_on date;
  year_start date;
  anniversary date;
  roster_count bigint;
  roster_bytes bigint;
  year_number integer;
  offset_year integer;
  custom_range boolean := from_on is not null or through_on is not null;
  fallback boolean;
  result jsonb;
begin
  if target_family_id is null or requested_period is null
    or requested_period not in ('week','month','school_year','all')
    or include_shared is null or entry_limit is null or entry_limit < 1 or entry_limit > 50
    or reference_at is null or not isfinite(reference_at)
    or (target_subject is not null and target_subject not in
      ('reading','math','science','social studies','art','music','PE','co-op','life skills','other','spanish'))
  then return jsonb_build_object('status','invalid'); end if;

  if uncategorized_only is null or (uncategorized_only and target_category_id is not null) then return jsonb_build_object('status','invalid'); end if;
  if target_category_id is not null and not exists(select 1 from public.hours_categories where id=target_category_id and family_id=target_family_id and (target_subject is null or subject=target_subject)) then return jsonb_build_object('status','invalid'); end if;

  -- SECURITY INVOKER makes the family's, roster's and Hours' existing RLS
  -- apply to authenticated callers, including direct RPC requests. No
  -- service-role grant or SECURITY DEFINER data path is introduced.
  select * into family from public.families where id = target_family_id;
  if not found then return jsonb_build_object('status','not_found'); end if;
  zone := coalesce(nullif(family.time_zone, ''), 'America/Chicago');
  begin
    today := (reference_at at time zone zone)::date;
  exception when invalid_parameter_value then
    return jsonb_build_object('status','invalid');
  end;
  if today < date '0001-01-01' or today > date '9999-12-31' then
    return jsonb_build_object('status','invalid');
  end if;

  select count(*), coalesce(sum(octet_length(name)),0) into roster_count, roster_bytes
    from public.children where family_id = target_family_id;
  if roster_count > 1000 or roster_bytes > 1000000 then return jsonb_build_object('status','roster_too_large'); end if;
  if target_child_id is not null and not exists (
    select 1 from public.children where id = target_child_id and family_id = target_family_id
  ) then return jsonb_build_object('status','invalid'); end if;

  -- Mirror compliance/deadlines.ts schoolYearStartFor exactly: a Feb29
  -- anniversary remains Feb29, including the eight-year gap around2100.
  -- The caller validates this result against that canonical helper.
  if family.school_year_start_on between date '0001-01-01' and date '9999-12-31' then
    year_number := extract(year from today)::integer;
    for offset_year in 0..8 loop
      exit when year_number - offset_year < 1;
      begin
        anniversary := make_date(year_number - offset_year,
          extract(month from family.school_year_start_on)::integer,
          extract(day from family.school_year_start_on)::integer);
        if anniversary <= today then year_start := anniversary; exit; end if;
      exception when datetime_field_overflow then null;
      end;
    end loop;
  end if;
  fallback := requested_period = 'school_year' and year_start is null;
  start_on := case requested_period
    when 'week' then today - (extract(isodow from today)::integer - 1)
    when 'month' then make_date(extract(year from today)::integer, extract(month from today)::integer, 1)
    when 'school_year' then year_start
    else null end;
  end_on := today;
  begin
    if from_on is not null then
      if from_on = '' then start_on := null;
      elsif from_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return jsonb_build_object('status','invalid');
      else start_on := from_on::date; end if;
    end if;
    if through_on is not null then
      if through_on = '' then end_on := null;
      elsif through_on !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return jsonb_build_object('status','invalid');
      else end_on := through_on::date; end if;
    end if;
  exception when invalid_datetime_format or datetime_field_overflow then
    return jsonb_build_object('status','invalid');
  end;
  if (start_on is not null and (start_on < date '0001-01-01' or start_on > date '9999-12-31'))
    or (end_on is not null and (end_on < date '0001-01-01' or end_on > date '9999-12-31'))
    or (start_on is not null and end_on is not null and start_on > end_on)
  then return jsonb_build_object('status','invalid'); end if;

  with roster as materialized (
    select id, name, created_at from public.children where family_id = target_family_id
  ), matched as materialized (
    select h.id, h.child_id, h.subject, h.minutes, h.happened_on, h.created_at, h.source, h.note, h.custom_label, c.id as category_id
    from public.hours_log h left join public.hours_categories c on c.family_id=h.family_id and c.subject=h.subject and c.name=h.custom_label
    where h.family_id = target_family_id
      and (start_on is null or h.happened_on >= start_on)
      and (end_on is null or h.happened_on <= end_on)
      and (include_shared or h.child_id is not null)
      and (target_child_id is null or h.child_id = target_child_id or (include_shared and h.child_id is null))
      and (target_subject is null or h.subject = target_subject)
      and (target_category_id is null or c.id=target_category_id)
      and (not uncategorized_only or h.custom_label is null)
  ), totals as (
    select count(*) as count, coalesce(sum(minutes),0) as minutes,
      count(distinct happened_on) as days, min(happened_on) as first_day, max(happened_on) as last_day,
      coalesce(bool_or(minutes < 1 or (child_id is not null and not exists (select 1 from roster r where r.id = matched.child_id))),false) as invalid
    from matched
  ), recipients as (
    select id, name, created_at from roster where target_child_id is null or id = target_child_id
    union all select null::uuid, 'Whole family', null::timestamptz
      where roster_count = 0 and target_child_id is null
  ), child_totals as (
    select r.id, r.name, r.created_at, count(distinct m.happened_on) as days, coalesce(sum(m.minutes),0) as minutes
    from recipients r left join matched m on m.child_id is null or m.child_id = r.id
    group by r.id,r.name,r.created_at
  ), entry_scopes as (
    select child_id, sum(minutes) as minutes from matched group by child_id
  ), subjects as (
    select subject, sum(minutes) as minutes from matched group by subject
  ), categories as (
    select subject, category_id, custom_label, sum(minutes) as minutes from matched group by subject,category_id,custom_label
  ), sample as (
    select * from matched order by happened_on desc, created_at desc, id desc limit entry_limit
  ) select case when t.invalid then jsonb_build_object('status','record_invalid') else jsonb_build_object(
    'status','ready', 'familyId',target_family_id,
    'timeZone',zone, 'schoolYearStartOn',case when family.school_year_start_on between date '0001-01-01' and date '9999-12-31' then to_char(family.school_year_start_on,'YYYY-MM-DD') else null end,
    'today',to_char(today,'YYYY-MM-DD'),
    'window',jsonb_build_object('from',to_char(start_on,'YYYY-MM-DD'),'through',to_char(end_on,'YYYY-MM-DD'),
      'period',case when custom_range then 'custom' when fallback then 'all' else requested_period end,
      'schoolYearFallback',fallback and not custom_range),
    'children',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by created_at,id) from roster),'[]'::jsonb),
    'entryCount',t.count,'totalMinutes',t.minutes,'recordedDays',t.days,
    'firstDay',to_char(t.first_day,'YYYY-MM-DD'),'lastDay',to_char(t.last_day,'YYYY-MM-DD'),
    'byEntryScope',coalesce((select jsonb_agg(jsonb_build_object('childId',child_id,'minutes',minutes) order by minutes desc,child_id nulls first) from entry_scopes),'[]'::jsonb),
    'bySubject',coalesce((select jsonb_agg(jsonb_build_object('subject',subject,'minutes',minutes) order by minutes desc,subject) from subjects),'[]'::jsonb),
    'byCategory',coalesce((select jsonb_agg(jsonb_build_object('subject',subject,'categoryId',category_id,'name',custom_label,'minutes',minutes) order by subject,custom_label nulls first) from categories),'[]'::jsonb),
    'recordedDaysByChild',coalesce((select jsonb_agg(jsonb_build_object('childId',id,'childName',name,'recordedDays',days,'minutes',minutes) order by created_at,id) from child_totals),'[]'::jsonb),
    'entries',coalesce((select jsonb_agg(jsonb_build_object('childId',child_id,'subject',subject,'minutes',minutes,'categoryId',category_id,'customLabel',custom_label,
      'happenedOn',to_char(happened_on,'YYYY-MM-DD'),'source',source,
      'note',left(note,200),'noteTruncated',coalesce(char_length(note)>200,false))
      order by happened_on desc,created_at desc,id desc) from sample),'[]'::jsonb)
  ) end into result from totals t;
  return result;
end;
$$;
revoke all on function public.read_hours_category_summary(uuid,text,uuid,boolean,text,text,text,integer,timestamptz,uuid,boolean) from public, anon;
grant execute on function public.read_hours_category_summary(uuid,text,uuid,boolean,text,text,text,integer,timestamptz,uuid,boolean) to authenticated;
comment on function public.read_hours_category_summary(uuid,text,uuid,boolean,text,text,text,integer,timestamptz,uuid,boolean) is
  'Read-only stable snapshot of exact scoped Hours totals plus at most50 entries. Security invoker preserves caller RLS. Family ID comes from authenticated application context.';
