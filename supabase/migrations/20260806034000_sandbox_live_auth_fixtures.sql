-- Live isolation and continuity checks use real authenticated callers so RLS is
-- exercised against the deployed Supabase project. Mark their family inside
-- the same transaction as creation. A canceled CI process can skip cleanup,
-- but it can no longer leave a synthetic family in customer funnels.

create or replace function public.create_my_family(
  family_name text default 'My family',
  family_us_state text default null,
  parent_name text default null
)
returns table (family_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_family_id uuid;
  actor_email text;
  sandbox_fixture boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated to create a family';
  end if;

  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'You already belong to a family';
  end if;

  select coalesce(lower(email), '')
  into actor_email
  from auth.users
  where id = auth.uid();

  sandbox_fixture :=
    actor_email like '%+homatest%@%'
    or actor_email like 'isolation-%@example.com'
    or actor_email like 'continuity-%@example.com'
    or actor_email like 'parented-session-%@example.com';

  insert into public.families
    (name, us_state, parent_display_name, sandbox)
  values
    (family_name, family_us_state, nullif(trim(parent_name), ''), sandbox_fixture)
  returning id into new_family_id;

  insert into public.family_members (family_id, user_id, role)
  values (new_family_id, auth.uid(), 'parent');

  return query select new_family_id;
end;
$$;

revoke all on function public.create_my_family(text, text, text) from public;
revoke execute on function public.create_my_family(text, text, text) from anon;
revoke execute on function public.create_my_family(text, text, text) from service_role;
grant execute on function public.create_my_family(text, text, text) to authenticated;
