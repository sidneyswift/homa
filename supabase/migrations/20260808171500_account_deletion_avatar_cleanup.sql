-- Account deletion must remove adult avatars from Supabase Storage and stop
-- already-issued JWTs from writing new objects after auth.users is erased.
-- The deletion job retains only the exact user folders needed by the Storage
-- retry, then clears them when every artifact store confirms deletion.

alter table public.account_deletion_jobs
  add column storage_user_ids uuid[],
  add column final_cleanup_after timestamptz,
  add column artifact_quiet_since timestamptz;

-- Vercel Blob client tokens default to one hour, and Family Library
-- deliberately issues six-hour multipart tokens. Keep sweeping beyond that
-- maximum before the job can certify that permanent deletion is complete.
update public.account_deletion_jobs
set final_cleanup_after = requested_at + interval '6 hours 30 minutes'
where final_cleanup_after is null;

alter table public.account_deletion_jobs
  alter column final_cleanup_after
    set default (now() + interval '6 hours 30 minutes'),
  alter column final_cleanup_after set not null;

-- Billing preparation is durable before any provider mutation. Include that
-- phase in the same retry index as artifact cleanup so a process exit after
-- the fence commits cannot strand the family indefinitely.
drop index if exists public.account_deletion_jobs_pending_idx;
create index account_deletion_jobs_pending_idx
  on public.account_deletion_jobs (updated_at, requested_at, id)
  where status in ('preparing', 'waiting_for_artifacts', 'retryable_failed');

-- A deleted family UUID is retained only as a write-denial and Blob-prefix
-- cleanup marker. It has no family foreign key and no parent-facing data, so
-- the normal family cascade cannot erase the safety boundary with the data.
create table public.account_deletion_artifact_tombstones (
  family_id uuid primary key,
  deletion_job_id uuid not null unique
    references public.account_deletion_jobs (id) on delete restrict,
  created_at timestamptz not null default now(),
  last_swept_at timestamptz
);

create index account_deletion_artifact_tombstones_sweep_idx
  on public.account_deletion_artifact_tombstones
    (last_swept_at asc nulls first, created_at);

alter table public.account_deletion_artifact_tombstones enable row level security;
revoke all on table public.account_deletion_artifact_tombstones
  from public, anon, authenticated;

-- The hard-delete guard deliberately leads this migration. An old deployment
-- may therefore have created a deletion job and closed family access before
-- its unguarded DELETE failed. Give every such job the durable primary prefix
-- that the new worker needs to recover it, including a job whose family row
-- disappeared just before the guard was installed.
insert into public.account_deletion_artifact_tombstones (
  family_id,
  deletion_job_id,
  created_at
)
select
  deletion_job.family_id,
  deletion_job.id,
  deletion_job.requested_at
from public.account_deletion_jobs deletion_job
where deletion_job.family_id is not null
  and deletion_job.status <> 'complete';

-- Preserve every Auth identity still recoverable from a legacy job before a
-- later family cascade removes its membership rows. requested_by_user_id is a
-- final fallback for an already-absent family.
update public.account_deletion_jobs deletion_job
set storage_user_ids = array(
  select identity.user_id
  from (
    select member.user_id
    from public.family_members member
    where member.family_id = deletion_job.family_id
    union
    select deletion_job.requested_by_user_id
    where deletion_job.requested_by_user_id is not null
  ) identity
  order by identity.user_id
)
where deletion_job.status <> 'complete'
  and deletion_job.storage_user_ids is null;

-- Old code identifies its already-canceled Stripe handoff with this exact
-- provider_summary. Capture member identities inside the old insertion
-- transaction, before that code marks the family deleted.
create or replace function public.capture_legacy_deletion_storage_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.family_id is not null
    and new.status <> 'complete'
    and new.storage_user_ids is null
    and new.provider_summary ->> 'stripe' = 'canceled'
  then
    new.storage_user_ids := array(
      select identity.user_id
      from (
        select member.user_id
        from public.family_members member
        where member.family_id = new.family_id
        union
        select new.requested_by_user_id
        where new.requested_by_user_id is not null
      ) identity
      order by identity.user_id
    );
  end if;
  return new;
end;
$$;

revoke all on function public.capture_legacy_deletion_storage_users()
  from public, anon, authenticated;

create trigger account_deletion_jobs_capture_legacy_users
before insert or update of
  family_id,
  requested_by_user_id,
  status,
  provider_summary
on public.account_deletion_jobs
for each row execute function public.capture_legacy_deletion_storage_users();

-- Keep the primary tombstone current for a job created after this migration
-- but before the new application deployment is READY. The function is
-- expanded after the folded-prefix table exists in the later migration.
create or replace function public.ensure_account_deletion_job_tombstones()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ensured_family_id uuid;
begin
  if new.family_id is not null and new.status <> 'complete' then
    insert into public.account_deletion_artifact_tombstones (
      family_id,
      deletion_job_id,
      created_at
    )
    values (new.family_id, new.id, new.requested_at)
    on conflict (family_id) do update
    set created_at = least(
      public.account_deletion_artifact_tombstones.created_at,
      excluded.created_at
    )
    where public.account_deletion_artifact_tombstones.deletion_job_id
      = excluded.deletion_job_id
    returning family_id into ensured_family_id;

    if ensured_family_id is null then
      raise exception using
        errcode = '55000',
        message = 'account deletion primary tombstone belongs to another job';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.ensure_account_deletion_job_tombstones()
  from public, anon, authenticated;

create trigger account_deletion_jobs_ensure_tombstones
after insert or update of family_id, status
on public.account_deletion_jobs
for each row execute function public.ensure_account_deletion_job_tombstones();

create or replace function public.current_auth_user_exists()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from auth.users auth_user
      where auth_user.id = (select auth.uid())
    )
    and not exists (
      select 1
      from public.account_deletion_jobs deletion_job
      where deletion_job.status <> 'complete'
        and (select auth.uid()) = any(
          coalesce(deletion_job.storage_user_ids, '{}'::uuid[])
        )
    );
$$;

revoke all on function public.current_auth_user_exists() from public, anon;
grant execute on function public.current_auth_user_exists() to authenticated;

-- An Auth identity awaiting provider cleanup cannot be attached to a new
-- family by a stale JWT, an old client, or a server writer. Locking the Auth
-- row first serializes this check behind the deletion transaction, which
-- already holds those rows FOR UPDATE before it publishes storage_user_ids.
create or replace function public.reject_deleting_user_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1
  from auth.users auth_user
  where auth_user.id = new.user_id
  for key share;

  if exists (
    select 1
    from public.account_deletion_jobs deletion_job
    where deletion_job.status <> 'complete'
      and new.user_id = any(
        coalesce(deletion_job.storage_user_ids, '{}'::uuid[])
      )
  ) then
    raise exception 'family membership is unavailable during account deletion'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_deleting_user_membership()
  from public, anon, authenticated;

create trigger family_members_reject_deleting_user
before insert or update of user_id on public.family_members
for each row execute function public.reject_deleting_user_membership();

drop policy if exists "avatar owners upload" on storage.objects;
create policy "avatar owners upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and (select public.current_auth_user_exists())
  );

drop policy if exists "avatar owners update" on storage.objects;
create policy "avatar owners update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and (select public.current_auth_user_exists())
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and (select public.current_auth_user_exists())
  );

drop policy if exists "avatar owners delete" on storage.objects;
create policy "avatar owners delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and (select public.current_auth_user_exists())
  );

-- The full account-deletion release is paused until its artifact, billing,
-- and production gates are complete. Keep the historical signature so old
-- clients fail closed, but remove every destructive statement and grant.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'account deletion is temporarily unavailable';
end;
$$;

-- CREATE OR REPLACE preserves existing ACLs, so this revoke is required
-- after the replacement rather than relying on the function body alone.
revoke all on function public.delete_own_account()
  from public, anon, authenticated, service_role;
