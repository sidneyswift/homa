-- Native first-use setup is one durable, idempotent server mutation.
-- The caller supplies a stable child id for retry identity, while the
-- function rechecks membership, creates the child, stamps the canonical
-- family completion flag, and returns the exact receipt in one transaction.

-- The create-family RPC's membership check is not enough against two
-- concurrent browser/native requests. One adult belongs to one family, so
-- make that invariant database-enforced before the native path relies on it.
create unique index if not exists family_members_one_family_per_user_idx
  on public.family_members (user_id);

create or replace function public.add_my_child_native_v1(
  p_child_id uuid,
  p_family_id uuid,
  p_name text,
  p_birth_date date,
  p_profile jsonb default '{}'::jsonb,
  p_time_zone text default null
)
returns table (
  child_id uuid,
  family_id uuid,
  child_name text,
  birth_date date,
  child_profile jsonb,
  profile_completed_at timestamptz,
  time_zone text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated to add a child';
  end if;

  if p_child_id is null or p_family_id is null then
    raise exception 'Child and family identifiers are required';
  end if;

  if not public.is_family_member(p_family_id) then
    raise exception 'Family is not available to this member';
  end if;

  if p_name is null or char_length(trim(p_name)) not between 1 and 80 then
    raise exception 'Child name must be between 1 and 80 characters';
  end if;

  if p_birth_date is null then
    raise exception 'Child birth date is required';
  end if;

  if jsonb_typeof(coalesce(p_profile, '{}'::jsonb)) <> 'object'
     or octet_length(coalesce(p_profile, '{}'::jsonb)::text) > 4000 then
    raise exception 'Child profile is invalid';
  end if;

  select c.family_id
    into existing_family_id
    from public.children c
   where c.id = p_child_id;

  if existing_family_id is not null and existing_family_id <> p_family_id then
    raise exception 'Child identifier belongs to another family';
  end if;

  insert into public.children (id, family_id, name, birth_month, profile)
  values (
    p_child_id,
    p_family_id,
    trim(p_name),
    p_birth_date,
    coalesce(p_profile, '{}'::jsonb)
  )
  on conflict (id) do nothing;

  update public.families f
     set profile_completed_at = coalesce(f.profile_completed_at, now()),
         context = case
           when f.context ? 'onboarding' then f.context
           else jsonb_set(
             coalesce(f.context, '{}'::jsonb),
             '{onboarding}',
             jsonb_build_object(
               'state', 'active',
               'beatsDone', '[]'::jsonb,
               'checklist', '{}'::jsonb,
               'updatedAt', to_jsonb(now()),
               'paywallShownAt', null
             ),
             true
           )
         end,
         time_zone = case
           when p_time_zone is not null
            and exists (
              select 1
                from pg_catalog.pg_timezone_names tz
               where tz.name = trim(p_time_zone)
            ) then trim(p_time_zone)
           else f.time_zone
         end,
         updated_at = now()
   where f.id = p_family_id;

  return query
  select c.id,
         c.family_id,
         c.name,
         c.birth_month,
         c.profile,
         f.profile_completed_at,
         f.time_zone
    from public.children c
    join public.families f on f.id = c.family_id
   where c.id = p_child_id
     and c.family_id = p_family_id;

  if not found then
    raise exception 'Child setup receipt was not available';
  end if;
end;
$$;

revoke all on function public.add_my_child_native_v1(uuid, uuid, text, date, jsonb, text)
  from public;
revoke execute on function public.add_my_child_native_v1(uuid, uuid, text, date, jsonb, text)
  from anon;
grant execute on function public.add_my_child_native_v1(uuid, uuid, text, date, jsonb, text)
  to authenticated;

-- Repairs an older family that already has a learner but was created before
-- the native setup receipt existed. It is intentionally no-argument so the
-- caller cannot choose a family outside the authenticated membership.
create or replace function public.complete_my_family_setup(
  p_time_zone text default null
)
returns table (
  family_id uuid,
  profile_completed_at timestamptz,
  time_zone text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated to complete family setup';
  end if;

  select f.id
    into caller_family_id
    from public.families f
    join public.family_members m on m.family_id = f.id
   where m.user_id = auth.uid()
   order by f.created_at asc
   limit 1;

  if caller_family_id is null then
    raise exception 'Family is not available to this member';
  end if;

  if not exists (
    select 1
      from public.children c
     where c.family_id = caller_family_id
  ) then
    raise exception 'A learner is required before family setup is complete';
  end if;

  update public.families f
     set profile_completed_at = coalesce(f.profile_completed_at, now()),
         context = case
           when f.context ? 'onboarding' then f.context
           else jsonb_set(
             coalesce(f.context, '{}'::jsonb),
             '{onboarding}',
             jsonb_build_object(
               'state', 'active',
               'beatsDone', '[]'::jsonb,
               'checklist', '{}'::jsonb,
               'updatedAt', to_jsonb(now()),
               'paywallShownAt', null
             ),
             true
           )
         end,
         time_zone = case
           when p_time_zone is not null
            and exists (
              select 1
                from pg_catalog.pg_timezone_names tz
               where tz.name = trim(p_time_zone)
            ) then trim(p_time_zone)
           else f.time_zone
         end,
         updated_at = now()
   where f.id = caller_family_id;

  return query
  select f.id, f.profile_completed_at, f.time_zone
    from public.families f
   where f.id = caller_family_id;
end;
$$;

revoke all on function public.complete_my_family_setup(text) from public;
revoke execute on function public.complete_my_family_setup(text) from anon;
grant execute on function public.complete_my_family_setup(text) to authenticated;
