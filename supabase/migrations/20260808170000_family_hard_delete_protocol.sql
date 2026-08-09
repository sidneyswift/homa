-- A family hard delete is the irreversible boundary for account deletion,
-- phone-family folding, and anonymous-lead cleanup. Install this guard before
-- the new ledgers and application code. CREATE TRIGGER drains in-flight table
-- writes; old deployments then fail closed until the new protocol is READY.

create or replace function public.guard_family_hard_delete_protocol()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delete_mode text := current_setting('homa.family_delete_mode', true);
  destination_family_id uuid;
  active_deletion_job_id uuid;
begin
  if delete_mode = 'family-fold-v2' then
    select prefix.owner_family_id
    into destination_family_id
    from public.family_artifact_prefixes prefix
    where prefix.artifact_family_id = old.id;

    if destination_family_id is null
      or not exists (
        select 1
        from public.families destination
        where destination.id = destination_family_id
      )
      or exists (
        select 1
        from public.family_artifact_prefixes prefix
        where prefix.owner_family_id = old.id
      )
      or exists (
        select 1
        from public.family_artifact_prefix_candidates candidate
        where candidate.owner_family_id = old.id
      )
      or exists (
        select 1
        from public.account_deletion_artifact_tombstones tombstone
        where tombstone.family_id in (old.id, destination_family_id)
      )
      or exists (
        select 1
        from public.family_artifact_prefixes prefix
        where prefix.artifact_family_id = destination_family_id
           or (
             prefix.artifact_family_id = old.id
             and prefix.owner_family_id <> destination_family_id
           )
      )
      or exists (
        select 1
        from public.family_artifact_prefix_candidates candidate
        where candidate.artifact_family_id in (
          old.id,
          destination_family_id
        )
      )
      or exists (
        select 1
        from public.family_artifact_prefix_candidates candidate
        join public.family_artifact_prefixes prefix
          on prefix.artifact_family_id = candidate.artifact_family_id
        where prefix.owner_family_id = destination_family_id
          and candidate.owner_family_id <> destination_family_id
      )
    then
      raise exception using
        errcode = '55000',
        message = 'family fold did not prove its artifact disposition';
    end if;
    return old;
  end if;

  if delete_mode = 'account-deletion-v2' then
    select job.id
    into active_deletion_job_id
    from public.account_deletion_jobs job
    where job.family_id = old.id
      and job.status = 'running';

    if active_deletion_job_id is null
      or old.status <> 'deleted'
      or not exists (
        select 1
        from public.account_deletion_artifact_tombstones tombstone
        where tombstone.family_id = old.id
          and tombstone.deletion_job_id = active_deletion_job_id
      )
      or exists (
        select 1
        from public.family_artifact_prefixes prefix
        left join public.account_deletion_artifact_tombstones tombstone
          on tombstone.family_id = prefix.artifact_family_id
         and tombstone.deletion_job_id = active_deletion_job_id
        where prefix.owner_family_id = old.id
          and tombstone.family_id is null
      )
      or exists (
        select 1
        from public.family_artifact_prefixes prefix
        join public.families live_artifact_family
          on live_artifact_family.id = prefix.artifact_family_id
        where prefix.owner_family_id = old.id
      )
      or exists (
        select 1
        from public.family_artifact_prefix_candidates candidate
        where candidate.owner_family_id = old.id
      )
      or exists (
        select 1
        from public.family_artifact_prefix_candidates candidate
        where candidate.owner_family_id <> old.id
          and (
            candidate.artifact_family_id = old.id
            or exists (
              select 1
              from public.family_artifact_prefixes prefix
              where prefix.owner_family_id = old.id
                and prefix.artifact_family_id = candidate.artifact_family_id
            )
          )
      )
    then
      raise exception using
        errcode = '55000',
        message = 'account deletion did not prove its artifact disposition';
    end if;
    return old;
  end if;

  if delete_mode = 'empty-anonymous-purge-v1' then
    raise exception using
      errcode = '55000',
      message = 'anonymous family purge is paused pending durable cleanup';
  end if;

  raise exception using
    errcode = '55000',
    message = 'family hard delete requires a recognized transaction protocol';
end;
$$;

revoke all on function public.guard_family_hard_delete_protocol()
  from public, anon, authenticated;

create trigger families_hard_delete_protocol_guard
before delete on public.families
for each row execute function public.guard_family_hard_delete_protocol();

-- The old deployment closes access in one transaction, then performs the
-- hard delete later. Reject that first irreversible status transition too,
-- so an old request arriving during the migration window rolls its job and
-- access change back together instead of creating a stranded deleted row.
create or replace function public.guard_family_deletion_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'deleted'
    and old.status is distinct from 'deleted'
    and current_setting('homa.family_delete_mode', true)
      is distinct from 'account-deletion-v2'
  then
    raise exception using
      errcode = '55000',
      message = 'family deletion acceptance requires the account deletion protocol';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_family_deletion_status_transition()
  from public, anon, authenticated;

create trigger families_deletion_status_protocol_guard
before update of status on public.families
for each row execute function public.guard_family_deletion_status_transition();
