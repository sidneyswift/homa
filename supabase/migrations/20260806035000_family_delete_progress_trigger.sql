-- #878 found that deleting a whole family can cascade through family_members
-- while an active progress check-in still names that adult. The ordinary
-- member-removal trigger then tries to write an event for a family that is
-- already being deleted, and the events family foreign key rejects it.
--
-- A whole-family deletion does not need the pause transition. The check-in,
-- its delivery state, and its events are all inside the same privacy boundary
-- and are deleted by the surrounding family cleanup. Removing one adult from
-- a family that still exists keeps the original pause and event behavior.

create or replace function private.pause_check_ins_for_removed_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  transition_at timestamptz := clock_timestamp();
begin
  if tg_op = 'UPDATE'
    and new.family_id is not distinct from old.family_id
    and new.user_id is not distinct from old.user_id
  then
    return new;
  end if;

  if not exists (
    select 1
    from public.families family
    where family.id = old.family_id
  ) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock_shared(
    private.child_progress_reconciliation_lock_key()
  );

  perform child.id
  from public.children child
  where child.family_id = old.family_id
    and exists (
      select 1
      from public.progress_check_ins check_in
      where check_in.child_id = child.id
        and check_in.family_id = child.family_id
        and check_in.state in ('active', 'paused')
        and (
          check_in.active_member_user_id = old.user_id
          or check_in.prompt_recipient_member_user_id = old.user_id
        )
    )
  order by child.id
  for update;

  insert into public.child_progress_revisions (
    child_id, family_id, revision, updated_at
  )
  select child.id, child.family_id, 0, transition_at
  from public.children child
  where child.family_id = old.family_id
    and exists (
      select 1
      from public.progress_check_ins check_in
      where check_in.child_id = child.id
        and check_in.family_id = child.family_id
        and check_in.state in ('active', 'paused')
        and (
          check_in.active_member_user_id = old.user_id
          or check_in.prompt_recipient_member_user_id = old.user_id
        )
    )
  order by child.id
  on conflict (child_id, family_id) do nothing;

  perform revision.child_id
  from public.child_progress_revisions revision
  where revision.family_id = old.family_id
    and exists (
      select 1
      from public.progress_check_ins check_in
      where check_in.child_id = revision.child_id
        and check_in.family_id = revision.family_id
        and check_in.state in ('active', 'paused')
        and (
          check_in.active_member_user_id = old.user_id
          or check_in.prompt_recipient_member_user_id = old.user_id
        )
    )
  order by revision.child_id
  for update;

  perform set_config(
    'homa.child_progress_member_removal',
    'on',
    true
  );

  with transitioned as (
    update public.progress_check_ins check_in
    set state = 'paused',
        pause_reason = 'member_removed',
        active_member_user_id = null,
        prompt_recipient_member_user_id = null,
        current_delivery_id = null,
        pending_runtime_session_id = null,
        pending_turn_id = null,
        revision = check_in.revision + 1,
        paused_at = transition_at,
        completed_at = null,
        stopped_at = null,
        updated_at = transition_at
    where check_in.family_id = old.family_id
      and check_in.state in ('active', 'paused')
      and (
        check_in.active_member_user_id = old.user_id
        or check_in.prompt_recipient_member_user_id = old.user_id
      )
    returning check_in.child_id, check_in.family_id
  )
  insert into public.events (name, props, family_id)
  select
    'progress.checkin_paused',
    pg_catalog.jsonb_build_object(
      'family_id', transitioned.family_id,
      'child_id', transitioned.child_id,
      'reason', 'member_removed'
    ),
    transitioned.family_id
  from transitioned;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

revoke all on function private.pause_check_ins_for_removed_member()
  from public, anon, authenticated;
