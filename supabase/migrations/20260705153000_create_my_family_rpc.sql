-- Migration #6: self-serve family creation (minimal M1-01/FR-1 slice).
-- No invite-code flow yet (MJ-09 is the full version); this lets any freshly
-- authenticated user create exactly one family for themselves. The "exactly
-- one" and "only if authenticated" rules live inside the function body
-- rather than as a general RLS policy, since "no existing membership row"
-- is a cross-table invariant that's simpler to enforce atomically here than
-- to split across two coordinated INSERT policies.

create or replace function public.create_my_family(family_name text default 'My family', family_us_state text default null)
returns table (family_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated to create a family';
  end if;

  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'You already belong to a family';
  end if;

  insert into public.families (name, us_state) values (family_name, family_us_state)
  returning id into new_family_id;

  insert into public.family_members (family_id, user_id, role) values (new_family_id, auth.uid(), 'parent');

  return query select new_family_id;
end;
$$;

-- Callable via /rest/v1/rpc/create_my_family by any signed-in user, by
-- design: the function's own body is the access control, not a broad RLS
-- policy. Flagged by the security advisor as expected; the double-creation
-- guard above is the actual guardrail.
revoke all on function public.create_my_family(text, text) from public;
revoke execute on function public.create_my_family(text, text) from anon;
grant execute on function public.create_my_family(text, text) to authenticated;
