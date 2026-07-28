-- App Review 5.1.1(v): the app must let a parent delete their account and
-- its data, not just deactivate it. This is the narrow, auditable
-- capability the deletion has to run as: a SECURITY DEFINER function
-- scoped to auth.uid() only, never a general service-role client in app
-- code (the standing tenancy law: RLS is the boundary, no broad
-- privilege escalation). See docs/homa-planning/plans/
-- 2026-07-28-ios-app-store-launch.md ARC B and .agents/skills/ios-release.
--
-- Cascade coverage: 29 of the 34 tables that reference families(id) are
-- already `on delete cascade`; every table that references auth.users(id)
-- directly is `on delete set null` (shared audit trails survive with the
-- actor anonymized, correct: that data belongs to the family, not to the
-- departing member). Three tables reference families(id) with NO delete
-- rule (defaults to RESTRICT) and would block a families delete:
-- conversation_signals, knowledge_gaps, response_engagement. This
-- function clears those explicitly before deleting a sole-member family.
--
-- Multi-member families: only the caller's own membership and identity
-- are removed (cascades via family_members.user_id -> auth.users
-- on delete cascade); shared family data stays intact for the remaining
-- parent(s). This is "delete my account", not "delete our family".

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sole_family_id uuid;
begin
  if uid is null then
    raise exception 'delete_own_account requires an authenticated caller';
  end if;

  -- Families where this caller is the only member: delete the whole
  -- family, not just the membership, or the family/children rows are
  -- orphaned (inaccessible via RLS, but not actually gone).
  for sole_family_id in
    select m.family_id
    from public.family_members m
    where m.user_id = uid
      and not exists (
        select 1
        from public.family_members other
        where other.family_id = m.family_id
          and other.user_id <> uid
      )
  loop
    delete from public.conversation_signals where family_id = sole_family_id;
    delete from public.knowledge_gaps where family_id = sole_family_id;
    delete from public.response_engagement where family_id = sole_family_id;
    delete from public.families where id = sole_family_id;
  end loop;

  -- The caller's own identity. Cascades their family_members row in any
  -- family they did not solely own (co-parented families), and every
  -- auth.users(id) reference elsewhere is on delete set null.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
