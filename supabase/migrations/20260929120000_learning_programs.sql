-- gh#1201: programs describe context; subjects and Hours remain canonical.
create table public.learning_programs (
  id uuid primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  revision integer not null default 1 check (revision > 0),
  classes jsonb not null check (jsonb_typeof(classes)='array' and jsonb_array_length(classes) between 1 and 64 and octet_length(classes::text)<=65536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,family_id), unique(family_id,name)
);
create table public.learning_program_occurrences (
  family_id uuid not null references public.families(id) on delete cascade,
  program_id uuid not null,
  class_id uuid not null,
  child_id uuid not null,
  activity_date date not null,
  activity_id uuid,
  planned_minutes integer check(planned_minutes between 1 and 600),
  category text check(char_length(category) between 1 and 40),
  primary key(program_id,class_id,child_id,activity_date),
  foreign key(program_id,family_id) references public.learning_programs(id,family_id) on delete cascade,
  foreign key(child_id,family_id) references public.children(id,family_id) on delete cascade,
  foreign key(activity_id,family_id) references public.planner_learning_activities(id,family_id) on delete set null (activity_id),
  unique(activity_id)
);
alter table public.learning_programs enable row level security;
alter table public.learning_program_occurrences enable row level security;
create policy programs_read on public.learning_programs for select to authenticated using(public.is_family_member(family_id));
create policy program_occurrences_read on public.learning_program_occurrences for select to authenticated using(public.is_family_member(family_id));
grant select on public.learning_programs,public.learning_program_occurrences to authenticated;
revoke all on public.learning_programs,public.learning_program_occurrences from anon;

-- Internal leaves are only callable by the trusted server or authenticated wrappers.
create function public.save_learning_program_pinned(f uuid, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.learning_programs%rowtype; row jsonb; other jsonb; child uuid; ids uuid[] := '{}'; start_min int; end_min int;
begin
  perform 1 from public.families where id=f for key share;
  if not found then return jsonb_build_object('status','not_found'); end if;
  if jsonb_typeof(payload->'classes') is distinct from 'array' or jsonb_array_length(payload->'classes') not between 1 and 64
    or coalesce(char_length(btrim(payload->>'name')),0) not between 1 and 80 then
    return jsonb_build_object('status','invalid'); end if;
  for row in select value from jsonb_array_elements(payload->'classes') loop
    if (row->>'id')::uuid is null or (row->>'id')::uuid=any(ids)
      or coalesce(char_length(btrim(row->>'title')),0) not between 1 and 300
      or coalesce(row->>'subject','') not in ('reading','math','science','social studies','art','music','PE','co-op','life skills','other','spanish')
      or (row->>'weekday')::int is null or (row->>'weekday')::int not between 0 and 6
      or jsonb_typeof(row->'childIds') is distinct from 'array' or jsonb_array_length(row->'childIds') not between 1 and 12
      or (row->>'plannedMinutes')::int not between 1 and 600
      or char_length(row->>'category') not between 1 and 40
    then return jsonb_build_object('status','invalid'); end if;
    ids := ids || (row->>'id')::uuid;
    if (select count(distinct value) from jsonb_array_elements_text(row->'childIds')) <> jsonb_array_length(row->'childIds') then
      return jsonb_build_object('status','invalid'); end if;
    for child in select value::uuid from jsonb_array_elements_text(row->'childIds') loop
      perform 1 from public.children where id=child and family_id=f for key share;
      if not found then return jsonb_build_object('status','not_found'); end if;
    end loop;
    if (row->>'startTime') is not null or (row->>'endTime') is not null then
      if coalesce(row->>'startTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or coalesce(row->>'endTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return jsonb_build_object('status','invalid'); end if;
      start_min := split_part(row->>'startTime',':',1)::int*60+split_part(row->>'startTime',':',2)::int;
      end_min := split_part(row->>'endTime',':',1)::int*60+split_part(row->>'endTime',':',2)::int;
      if end_min-start_min not between 1 and 600 or ((row->>'plannedMinutes') is not null and (row->>'plannedMinutes')::int<>end_min-start_min)
        then return jsonb_build_object('status','invalid'); end if;
    end if;
    for other in select value from jsonb_array_elements(payload->'classes') loop
      if row->>'id'<>other->>'id' and row->>'weekday'=other->>'weekday'
        and row->>'startTime'<other->>'endTime' and other->>'startTime'<row->>'endTime'
        and exists(select 1 from jsonb_array_elements_text(row->'childIds') a join jsonb_array_elements_text(other->'childIds') b on a.value=b.value)
        then return jsonb_build_object('status','overlap'); end if;
    end loop;
  end loop;
  perform pg_advisory_xact_lock(hashtextextended(f::text||':programs',0));
  select * into p from public.learning_programs where id=(payload->>'id')::uuid and family_id=f for update;
  if found then
    if p.name=btrim(payload->>'name') and p.classes=payload->'classes' then return jsonb_build_object('status','saved','id',p.id,'revision',p.revision); end if;
    if p.revision is distinct from (payload->>'expectedRevision')::int then return jsonb_build_object('status','conflict'); end if;
    update public.learning_programs set name=btrim(payload->>'name'),classes=payload->'classes',revision=revision+1,updated_at=clock_timestamp()
      where id=p.id and family_id=f returning * into p;
  else
    if payload->>'expectedRevision' is not null then return jsonb_build_object('status','not_found'); end if;
    if (select count(*) from public.learning_programs where family_id=f)>=100 then return jsonb_build_object('status','limit'); end if;
    insert into public.learning_programs(id,family_id,name,classes) values((payload->>'id')::uuid,f,btrim(payload->>'name'),payload->'classes') returning * into p;
  end if;
  return jsonb_build_object('status','saved','id',p.id,'revision',p.revision);
exception when unique_violation then return jsonb_build_object('status','conflict');
  when invalid_text_representation or numeric_value_out_of_range or check_violation then return jsonb_build_object('status','invalid');
end $$;
revoke all on function public.save_learning_program_pinned(uuid,jsonb) from public,anon,authenticated,service_role;

create function public.schedule_learning_program_pinned(f uuid,pid uuid,rev int,first_date date,last_date date,excluded date[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.learning_programs%rowtype; row jsonb; day date; child uuid; aid uuid; key text; added int := 0; existing int := 0; minutes int;
begin
  if first_date is null or last_date is null or last_date<first_date or last_date-first_date>=90 or coalesce(cardinality(excluded),0)>90
    then return jsonb_build_object('status','invalid'); end if;
  select * into p from public.learning_programs where id=pid and family_id=f for update;
  if not found then return jsonb_build_object('status','not_found'); end if;
  if rev is distinct from p.revision then return jsonb_build_object('status','conflict'); end if;
  if (select count(*) from generate_series(first_date::timestamp,last_date::timestamp,interval '1 day') d
      cross join jsonb_array_elements(p.classes) c cross join jsonb_array_elements_text(c->'childIds') ch
      where extract(dow from d)::int=(c->>'weekday')::int and not d::date=any(coalesce(excluded,'{}'))) > 512
    then return jsonb_build_object('status','limit'); end if;
  for day in select d::date from generate_series(first_date::timestamp,last_date::timestamp,interval '1 day') d loop
    if day=any(coalesce(excluded,'{}')) then continue; end if;
    for row in select value from jsonb_array_elements(p.classes) where (value->>'weekday')::int=extract(dow from day)::int loop
      minutes := (row->>'plannedMinutes')::int;
      if row->>'startTime' is not null then
        minutes := extract(epoch from ((row->>'endTime')::time-(row->>'startTime')::time))::int/60;
      end if;
      for child in select value::uuid from jsonb_array_elements_text(row->'childIds') loop
        perform 1 from public.children where id=child and family_id=f for key share;
        if not found then raise exception 'Program participant no longer belongs to family' using errcode='42501'; end if;
        if exists(select 1 from public.learning_program_occurrences o where o.program_id=pid and o.class_id=(row->>'id')::uuid and o.child_id=child and o.activity_date=day) then
          existing := existing+1; continue;
        end if;
        key := 'program:'||pid::text||':'||(row->>'id')||':'||child::text||':'||day::text;
        aid := public.learning_mutation_uuid(key,'activity');
        insert into public.planner_learning_activities(id,family_id,title,subject,activity_date,status,source_channel,source_quote,idempotency_key)
          values(aid,f,row->>'title',row->>'subject',day,'planned','web','Saved program: '||p.name,key);
        insert into public.planner_learning_activity_children(family_id,activity_id,child_id) values(f,aid,child);
        insert into public.learning_program_occurrences(family_id,program_id,class_id,child_id,activity_date,activity_id,planned_minutes,category)
          values(f,pid,(row->>'id')::uuid,child,day,aid,minutes,row->>'category');
        added := added+1;
      end loop;
    end loop;
  end loop;
  return jsonb_build_object('status','scheduled','created',added,'existing',existing,'hoursAdded',0);
end $$;
revoke all on function public.schedule_learning_program_pinned(uuid,uuid,int,date,date,date[]) from public,anon,authenticated,service_role;

create function public.read_learning_programs_pinned(f uuid,first_date date,last_date date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare programs jsonb; occurrences jsonb;
begin
  if first_date is null or last_date is null or last_date<first_date or last_date-first_date>366 then raise exception 'Invalid program date range' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'revision',revision,'classes',classes) order by name),'[]') into programs from public.learning_programs where family_id=f;
  select coalesce(jsonb_agg(jsonb_build_object('programId',p.id,'programName',p.name,'classId',o.class_id,'childId',o.child_id,
    'activityId',o.activity_id,'date',o.activity_date,'title',a.title,'subject',a.subject,'status',coalesce(a.status,'removed'),
    'minutes',a.duration_minutes,'plannedMinutes',o.planned_minutes,'revision',a.updated_at) order by o.activity_date,a.title,o.child_id),'[]') into occurrences
  from public.learning_program_occurrences o join public.learning_programs p on p.id=o.program_id and p.family_id=o.family_id
  left join public.planner_learning_activities a on a.id=o.activity_id and a.family_id=o.family_id
  where o.family_id=f and o.activity_date between first_date and last_date;
  return jsonb_build_object('programs',programs,'occurrences',occurrences);
end $$;
revoke all on function public.read_learning_programs_pinned(uuid,date,date) from public,anon,authenticated,service_role;

-- Browser wrappers keep JWT membership in the database, not client-chosen tenancy.
create function public.save_learning_program(f uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.is_family_member(f) then raise exception 'Family unavailable' using errcode='42501'; end if;
  return public.save_learning_program_pinned(f,payload);
end $$;
create function public.schedule_learning_program(f uuid,pid uuid,rev int,first_date date,last_date date,excluded date[]) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.is_family_member(f) then raise exception 'Family unavailable' using errcode='42501'; end if;
  return public.schedule_learning_program_pinned(f,pid,rev,first_date,last_date,excluded);
end $$;
create function public.read_learning_programs(f uuid,first_date date,last_date date) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.is_family_member(f) then raise exception 'Family unavailable' using errcode='42501'; end if;
  return public.read_learning_programs_pinned(f,first_date,last_date);
end $$;
revoke all on function public.save_learning_program(uuid,jsonb),public.schedule_learning_program(uuid,uuid,int,date,date,date[]),public.read_learning_programs(uuid,date,date) from public,anon;
grant execute on function public.save_learning_program(uuid,jsonb),public.schedule_learning_program(uuid,uuid,int,date,date,date[]),public.read_learning_programs(uuid,date,date) to authenticated;

-- The existing completion paths create Hours before linking them. Add program
-- category at the link boundary so chat and manual completion use the same path.
create function public.apply_program_hours_category() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.hours_log h set custom_label=o.category
  from public.learning_program_occurrences o
  where o.activity_id=new.activity_id and o.family_id=new.family_id and h.id=new.hours_entry_id
    and h.family_id=new.family_id and o.category is not null;
  return new;
end $$;
revoke all on function public.apply_program_hours_category() from public,anon,authenticated,service_role;
create trigger program_hours_category after insert on public.planner_learning_activity_hours for each row execute function public.apply_program_hours_category();

create function public.change_program_occurrence(f uuid,aid uuid,revision timestamptz,operation text,minutes int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.planner_learning_activities%rowtype; receipt jsonb;
begin
  if not public.is_family_member(f) then raise exception 'Family unavailable' using errcode='42501'; end if;
  select * into a from public.planner_learning_activities where id=aid and family_id=f for update;
  if not found or not exists(select 1 from public.learning_program_occurrences where activity_id=aid and family_id=f) then return jsonb_build_object('result','not_found'); end if;
  if revision is distinct from a.updated_at then return jsonb_build_object('result','conflict'); end if;
  if operation='record' then
    if minutes is null or minutes not between 1 and 600 then return jsonb_build_object('result','invalid'); end if;
    return public.update_planner_learning_activity_record(aid,revision,a.title,a.note,minutes);
  elsif operation='cancel' then
    perform public.delete_planner_learning_activity(aid);
    return jsonb_build_object('result','applied');
  end if;
  return jsonb_build_object('result','invalid');
end $$;
revoke all on function public.change_program_occurrence(uuid,uuid,timestamptz,text,int) from public,anon;
grant execute on function public.change_program_occurrence(uuid,uuid,timestamptz,text,int) to authenticated;
