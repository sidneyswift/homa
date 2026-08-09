\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

begin;

set local lock_timeout = '5s';
set local statement_timeout = '180s';
set local idle_in_transaction_session_timeout = '210s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'homa:issue:878:account-deletion-schema-release',
    0
  )
);

lock table supabase_migrations.schema_migrations
  in share row exclusive mode;
lock table auth.users in share row exclusive mode;
lock table public.families in share row exclusive mode;
lock table public.family_members in share row exclusive mode;
lock table public.account_deletion_jobs in share row exclusive mode;
lock table public.materials in share row exclusive mode;
lock table public.lesson_recordings in share row exclusive mode;
lock table public.lesson_segments in share row exclusive mode;
lock table public.lesson_media in share row exclusive mode;
lock table storage.objects in share row exclusive mode;

do $lock_existing_release_relations$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'public.account_deletion_artifact_tombstones',
    'public.family_artifact_prefixes',
    'public.family_artifact_prefix_candidates',
    'public.apple_purchase_interlocks'
  ]
  loop
    if to_regclass(relation_name) is not null then
      execute pg_catalog.format(
        'lock table %s in share row exclusive mode',
        relation_name
      );
    end if;
  end loop;
end
$lock_existing_release_relations$;

create temporary table issue_878_schema_release_state (
  ledger_count integer not null,
  applied boolean not null
) on commit drop;

insert into issue_878_schema_release_state (ledger_count, applied)
select
  count(*)::integer,
  count(*) = 0
from supabase_migrations.schema_migrations
where version in (
  '20260808170000',
  '20260808171500',
  '20260808183000',
  '20260808184500'
);

do $prerequisites$
declare
  target_ledger_count integer;
  target_artifact_exists boolean;
  containment_function record;
  postgres_oid oid;
begin
  select ledger_count
  into strict target_ledger_count
  from issue_878_schema_release_state;

  if target_ledger_count not in (0, 4) then
    raise exception
      'issue 878 schema release is mixed; all four reviewed ledger rows must be absent or present';
  end if;

  select (
    to_regclass('public.account_deletion_artifact_tombstones') is not null
    or to_regclass('public.family_artifact_prefixes') is not null
    or to_regclass('public.family_artifact_prefix_candidates') is not null
    or to_regclass('public.apple_purchase_interlocks') is not null
    or to_regclass('public.account_deletion_artifact_tombstones_sweep_idx') is not null
    or to_regclass('public.account_deletion_artifact_tombstones_job_idx') is not null
    or to_regclass('public.family_artifact_prefixes_owner_idx') is not null
    or to_regclass('public.apple_purchase_interlocks_family_idx') is not null
    or to_regclass('public.apple_purchase_interlocks_one_active_family_idx') is not null
    or to_regclass('public.apple_purchase_interlocks_updated_idx') is not null
    or to_regprocedure('public.guard_family_hard_delete_protocol()') is not null
    or to_regprocedure('public.guard_family_deletion_status_transition()') is not null
    or to_regprocedure('public.capture_legacy_deletion_storage_users()') is not null
    or to_regprocedure('public.ensure_account_deletion_job_tombstones()') is not null
    or to_regprocedure('public.current_auth_user_exists()') is not null
    or to_regprocedure('public.reject_deleting_user_membership()') is not null
    or to_regprocedure('public.guard_family_apple_purchase_interlock()') is not null
    or exists (
      select 1
      from pg_catalog.pg_attribute attribute
      where attribute.attrelid = 'public.account_deletion_jobs'::regclass
        and attribute.attname in (
          'storage_user_ids',
          'final_cleanup_after',
          'artifact_quiet_since'
        )
        and not attribute.attisdropped
    )
    or exists (
      select 1
      from pg_catalog.pg_attribute attribute
      where attribute.attrelid = 'public.families'::regclass
        and attribute.attname = 'apple_provider_observed_at'
        and not attribute.attisdropped
    )
  ) into target_artifact_exists;

  if target_ledger_count = 0 and target_artifact_exists then
    raise exception
      'issue 878 schema release is mixed; absent ledgers require every reviewed schema artifact to be absent';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260809030000'
      and name = 'pause_legacy_account_deletion'
      and statements = array[
        pg_catalog.format(
          E'/* Homa issue 878: exact 20260809030000_pause_legacy_account_deletion.sql applied atomically. */\n/* sha256=d654b9c3666a67fadcf667861063850394e805aee5d9522e9ea62407c075b96a */\n%s',
          pg_catalog.pg_get_functiondef(
            'public.delete_own_account()'::regprocedure
          )
        ),
        'revoke all on function public.delete_own_account() from public, anon, authenticated, service_role'
      ]::text[]
  ) then
    raise exception
      'issue 878 containment ledger prerequisite is absent or altered';
  end if;

  select oid into postgres_oid
  from pg_catalog.pg_roles
  where rolname = 'postgres';

  if postgres_oid is null
    or not exists (
      select 1 from pg_catalog.pg_roles where rolname = 'anon'
    )
    or not exists (
      select 1 from pg_catalog.pg_roles where rolname = 'authenticated'
    )
    or not exists (
      select 1 from pg_catalog.pg_roles where rolname = 'service_role'
    )
  then
    raise exception
      'issue 878 schema release requires postgres and the Supabase Data API roles';
  end if;

  select procedure.*
  into containment_function
  from pg_catalog.pg_proc procedure
  where procedure.oid = to_regprocedure('public.delete_own_account()');

  if not found
    or containment_function.proowner <> postgres_oid
    or not containment_function.prosecdef
    or containment_function.proconfig
      is distinct from array['search_path=""']::text[]
    or pg_catalog.btrim(
      containment_function.prosrc,
      E' \n\r\t'
    ) is distinct from
      $expected$begin
  raise exception using
    errcode = '55000',
    message = 'account deletion is temporarily unavailable';
end;$expected$
  then
    raise exception
      'issue 878 containment RPC prerequisite differs from the paused contract';
  end if;

  if pg_catalog.has_function_privilege(
      'anon',
      'public.delete_own_account()',
      'execute'
    )
    or pg_catalog.has_function_privilege(
      'authenticated',
      'public.delete_own_account()',
      'execute'
    )
    or pg_catalog.has_function_privilege(
      'service_role',
      'public.delete_own_account()',
      'execute'
    )
  then
    raise exception
      'issue 878 containment RPC prerequisite exposes a client execute grant';
  end if;

  if exists (
    select 1
    from public.account_deletion_jobs
    where status <> 'complete'
  ) then
    raise exception
      'issue 878 schema release requires zero non-complete account deletion jobs';
  end if;

  if exists (
    select 1
    from public.families
    where apple_original_transaction_id is not null
  ) then
    raise exception
      'issue 878 schema release requires zero active App Store billing records';
  end if;
end
$prerequisites$;

create or replace function pg_temp.issue_878_schema_1700_statements()
returns text[]
language sql
immutable
as $ledger$
  select array[
    $issue_878_1700$/* Homa issue 878 schema release. source_sha256=2f7c819b27e77195aef1db8a4068aea03fd10dd578cf07d3d8c86f9bafda12a6 */
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
$issue_878_1700$
  ]::text[]
$ledger$;

create or replace function pg_temp.issue_878_schema_1715_statements()
returns text[]
language sql
immutable
as $ledger$
  select array[
    $issue_878_1715$/* Homa issue 878 schema release. source_sha256=915b6bc4bd5e644718f7364f886a331b8a20bcb674610e42ee71091c50471a25 */
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
$issue_878_1715$
  ]::text[]
$ledger$;

create or replace function pg_temp.issue_878_schema_1830_statements()
returns text[]
language sql
immutable
as $ledger$
  select array[
    $issue_878_1830$/* Homa issue 878 schema release. source_sha256=6eb9de43748106f4e6af46e9b188ece91ce5adab5b57ccc1c52e8da0821c35aa */
-- Family folds move relational records to the surviving family, but existing
-- Vercel Blob objects keep the family UUID embedded in their path. Retain each
-- historical UUID as a cleanup prefix so a later account deletion can remove
-- every artifact that belongs to the surviving family.

create table public.family_artifact_prefixes (
  artifact_family_id uuid primary key,
  owner_family_id uuid not null
    references public.families (id) on delete cascade,
  inherited_at timestamptz not null default now(),
  check (artifact_family_id <> owner_family_id)
);

create index family_artifact_prefixes_owner_idx
  on public.family_artifact_prefixes (owner_family_id, artifact_family_id);

alter table public.family_artifact_prefixes enable row level security;
revoke all on table public.family_artifact_prefixes
  from public, anon, authenticated;

-- Historical rows can reveal a likely pre-fold Blob prefix, but they are not
-- authoritative ownership records. Persist only privacy-light evidence for a
-- human-reviewed audit. Nothing in this migration promotes a candidate into
-- the deletion ledger automatically.
create table public.family_artifact_prefix_candidates (
  owner_family_id uuid not null,
  artifact_family_id uuid not null,
  evidence_kind text not null
    check (evidence_kind in ('material_output', 'lesson_audio')),
  evidence_count integer not null check (evidence_count > 0),
  observed_at timestamptz not null default now(),
  primary key (owner_family_id, artifact_family_id, evidence_kind),
  foreign key (owner_family_id)
    references public.families (id),
  check (artifact_family_id <> owner_family_id)
);

alter table public.family_artifact_prefix_candidates enable row level security;
revoke all on table public.family_artifact_prefix_candidates
  from public, anon, authenticated;

with surviving_references as (
  select family_id as owner_family_id, pdf_url as artifact_ref,
    'material_output'::text as evidence_kind
  from public.materials
  union all
  select family_id, preview_url, 'material_output'
  from public.materials
  union all
  select recording.family_id, segment.blob_url, 'lesson_audio'
  from public.lesson_segments segment
  join public.lesson_recordings recording on recording.id = segment.lesson_id
  union all
  select recording.family_id, media.blob_url, 'lesson_audio'
  from public.lesson_media media
  join public.lesson_recordings recording on recording.id = media.lesson_id
), exact_references as (
  select
    reference.owner_family_id,
    reference.evidence_kind,
    substring(
      reference.artifact_ref
      from '^https://[a-zA-Z0-9-]+\.(?:public|private)\.blob\.vercel-storage\.com/families/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/'
    ) as artifact_family_id
  from surviving_references reference
)
insert into public.family_artifact_prefix_candidates (
  owner_family_id,
  artifact_family_id,
  evidence_kind,
  evidence_count
)
select
  reference.owner_family_id,
  reference.artifact_family_id::uuid,
  reference.evidence_kind,
  count(*)::integer
from exact_references reference
where reference.artifact_family_id is not null
  and reference.artifact_family_id::uuid <> reference.owner_family_id
group by
  reference.owner_family_id,
  reference.artifact_family_id,
  reference.evidence_kind;

-- One deletion job may now own several historical Blob prefixes. Each prefix
-- gets its own permanent tombstone so delayed uploads are swept as well.
alter table public.account_deletion_artifact_tombstones
  drop constraint account_deletion_artifact_tombstones_deletion_job_id_key;

create index account_deletion_artifact_tombstones_job_idx
  on public.account_deletion_artifact_tombstones (deletion_job_id, family_id);

insert into public.account_deletion_artifact_tombstones (
  family_id,
  deletion_job_id,
  created_at
)
select
  prefix.artifact_family_id,
  deletion_job.id,
  deletion_job.requested_at
from public.account_deletion_jobs deletion_job
join public.family_artifact_prefixes prefix
  on prefix.owner_family_id = deletion_job.family_id
where deletion_job.status <> 'complete';

-- From this point onward, a compatibility job created by the old deployment
-- must snapshot both its primary UUID and every folded Blob prefix. Replace
-- the earlier primary-only trigger body now that the alias table exists.
create or replace function public.ensure_account_deletion_job_tombstones()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_artifact_family_id uuid;
  ensured_family_id uuid;
begin
  if new.family_id is not null and new.status <> 'complete' then
    ensured_family_id := null;
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

    for target_artifact_family_id in
      select prefix.artifact_family_id
      from public.family_artifact_prefixes prefix
      where prefix.owner_family_id = new.family_id
      order by prefix.artifact_family_id
    loop
      ensured_family_id := null;
      insert into public.account_deletion_artifact_tombstones (
        family_id,
        deletion_job_id,
        created_at
      )
      values (target_artifact_family_id, new.id, new.requested_at)
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
          message = 'account deletion artifact tombstone belongs to another job';
      end if;
    end loop;
  end if;
  return new;
end;
$$;
$issue_878_1830$
  ]::text[]
$ledger$;

create or replace function pg_temp.issue_878_schema_1845_statements()
returns text[]
language sql
immutable
as $ledger$
  select array[
    $issue_878_1845$/* Homa issue 878 schema release. source_sha256=58d41cc2a770cd64e9c5968565e25a9317bf2b10c07a59b519369cd29a3e6e28 */
-- StoreKit charges before the mobile client can submit Apple's signed
-- transaction to Homa. This family-locked marker closes that gap: account
-- deletion blocks while a purchase may be in flight, then verified provider
-- evidence or an exact client cancellation removes the marker.

alter table public.families
  add column apple_provider_observed_at timestamptz;

update public.families
set apple_provider_observed_at = coalesce(billing_updated_at, updated_at)
where apple_original_transaction_id is not null;

create table public.apple_purchase_interlocks (
  attempt_id uuid primary key,
  family_id uuid not null
    references public.families (id) on delete cascade,
  product_id text not null check (char_length(product_id) between 1 and 200),
  state text not null default 'prepared'
    check (state in (
      'prepared',
      'store_started',
      'cancel_pending',
      'canceled',
      'resolved'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  canceled_at timestamptz,
  check ((state = 'resolved') = (resolved_at is not null)),
  check ((state = 'canceled') = (canceled_at is not null))
);

create index apple_purchase_interlocks_family_idx
  on public.apple_purchase_interlocks (family_id, state, created_at, attempt_id);

create unique index apple_purchase_interlocks_one_active_family_idx
  on public.apple_purchase_interlocks (family_id)
  where state in ('prepared', 'store_started', 'cancel_pending');

create index apple_purchase_interlocks_updated_idx
  on public.apple_purchase_interlocks (updated_at);

alter table public.apple_purchase_interlocks enable row level security;
revoke all on table public.apple_purchase_interlocks
  from public, anon, authenticated;

-- The general hard-delete protocol is installed before this table exists.
-- This second guard makes every present and future delete path fail closed if
-- application code ever forgets to check an active StoreKit handoff.
create or replace function public.guard_family_apple_purchase_interlock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.apple_purchase_interlocks interlock
    where interlock.family_id = old.id
      and interlock.state in ('prepared', 'store_started', 'cancel_pending')
  ) then
    raise exception using
      errcode = '55000',
      message = 'family hard delete is blocked by an active App Store purchase';
  end if;
  return old;
end;
$$;

revoke all on function public.guard_family_apple_purchase_interlock()
  from public, anon, authenticated;

create trigger families_apple_purchase_interlock_guard
before delete on public.families
for each row execute function public.guard_family_apple_purchase_interlock();
$issue_878_1845$
  ]::text[]
$ledger$;

select applied as issue_878_schema_apply
from issue_878_schema_release_state
\gset

\if :issue_878_schema_apply
\ir ../supabase/migrations/20260808170000_family_hard_delete_protocol.sql
insert into supabase_migrations.schema_migrations (
  version,
  statements,
  name
)
values (
  '20260808170000',
  pg_temp.issue_878_schema_1700_statements(),
  'family_hard_delete_protocol'
);

\ir ../supabase/migrations/20260808171500_account_deletion_avatar_cleanup.sql
insert into supabase_migrations.schema_migrations (
  version,
  statements,
  name
)
values (
  '20260808171500',
  pg_temp.issue_878_schema_1715_statements(),
  'account_deletion_avatar_cleanup'
);

\ir ../supabase/migrations/20260808183000_folded_family_artifact_prefixes.sql
insert into supabase_migrations.schema_migrations (
  version,
  statements,
  name
)
values (
  '20260808183000',
  pg_temp.issue_878_schema_1830_statements(),
  'folded_family_artifact_prefixes'
);

\ir ../supabase/migrations/20260808184500_apple_purchase_interlock.sql
insert into supabase_migrations.schema_migrations (
  version,
  statements,
  name
)
values (
  '20260808184500',
  pg_temp.issue_878_schema_1845_statements(),
  'apple_purchase_interlock'
);

-- Reassert containment after every reviewed schema statement. This remains
-- deliberate even while migration 1715 also carries the paused RPC.
\ir ../supabase/migrations/20260809030000_pause_legacy_account_deletion.sql
\endif

create or replace function pg_temp.assert_issue_878_security_function(
  signature text,
  expected_language text,
  authenticated_may_execute boolean,
  required_source_fragments text[]
)
returns void
language plpgsql
as $assert$
declare
  function_oid oid := to_regprocedure(signature);
  function_contract record;
  postgres_oid oid;
  source_fragment text;
begin
  select oid into postgres_oid
  from pg_catalog.pg_roles
  where rolname = 'postgres';

  if function_oid is null then
    raise exception 'reviewed function % is absent', signature;
  end if;

  select procedure.*
  into strict function_contract
  from pg_catalog.pg_proc procedure
  where procedure.oid = function_oid;

  if function_contract.proowner <> postgres_oid
    or not function_contract.prosecdef
    or function_contract.prolang <> (
      select oid
      from pg_catalog.pg_language
      where lanname = expected_language
    )
    or function_contract.proconfig
      is distinct from array['search_path=""']::text[]
  then
    raise exception 'reviewed function % metadata differs', signature;
  end if;

  if pg_catalog.has_function_privilege('anon', function_oid, 'execute')
    or pg_catalog.has_function_privilege(
      'service_role',
      function_oid,
      'execute'
    )
    or pg_catalog.has_function_privilege(
      'authenticated',
      function_oid,
      'execute'
    ) is distinct from authenticated_may_execute
  then
    raise exception 'reviewed function % ACL differs', signature;
  end if;

  foreach source_fragment in array required_source_fragments
  loop
    if pg_catalog.strpos(function_contract.prosrc, source_fragment) = 0 then
      raise exception
        'reviewed function % body is missing a required contract fragment',
        signature;
    end if;
  end loop;
end
$assert$;

create or replace function pg_temp.assert_issue_878_relation(
  relation_name text,
  expected_columns text[],
  expected_types text[],
  expected_not_null boolean[],
  expected_constraint_types text,
  expected_index_count integer
)
returns void
language plpgsql
as $assert$
declare
  relation_oid oid := to_regclass(relation_name);
  relation_contract record;
  actual_columns text[];
  actual_types text[];
  actual_not_null boolean[];
  actual_constraint_types text;
  postgres_oid oid;
  anon_oid oid;
  authenticated_oid oid;
begin
  select oid into postgres_oid
  from pg_catalog.pg_roles
  where rolname = 'postgres';
  select oid into anon_oid
  from pg_catalog.pg_roles
  where rolname = 'anon';
  select oid into authenticated_oid
  from pg_catalog.pg_roles
  where rolname = 'authenticated';

  if relation_oid is null then
    raise exception 'reviewed relation % is absent', relation_name;
  end if;

  select relation.*
  into strict relation_contract
  from pg_catalog.pg_class relation
  where relation.oid = relation_oid;

  if relation_contract.relkind <> 'r'
    or relation_contract.relpersistence <> 'p'
    or relation_contract.relispartition
    or relation_contract.relowner <> postgres_oid
    or not relation_contract.relrowsecurity
    or relation_contract.relforcerowsecurity
    or exists (
      select 1
      from pg_catalog.pg_inherits inheritance
      where inheritance.inhrelid = relation_oid
        or inheritance.inhparent = relation_oid
    )
  then
    raise exception 'reviewed relation % metadata differs', relation_name;
  end if;

  select
    pg_catalog.array_agg(attribute.attname order by attribute.attnum),
    pg_catalog.array_agg(
      pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
      order by attribute.attnum
    ),
    pg_catalog.array_agg(attribute.attnotnull order by attribute.attnum)
  into actual_columns, actual_types, actual_not_null
  from pg_catalog.pg_attribute attribute
  where attribute.attrelid = relation_oid
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if actual_columns is distinct from expected_columns
    or actual_types is distinct from expected_types
    or actual_not_null is distinct from expected_not_null
  then
    raise exception 'reviewed relation % columns differ', relation_name;
  end if;

  select pg_catalog.string_agg(
    constraint_record.contype::text,
    '' order by constraint_record.contype, constraint_record.conname
  )
  into actual_constraint_types
  from pg_catalog.pg_constraint constraint_record
  where constraint_record.conrelid = relation_oid;

  if actual_constraint_types is distinct from expected_constraint_types
    or exists (
      select 1
      from pg_catalog.pg_constraint constraint_record
      where constraint_record.conrelid = relation_oid
        and (
          not constraint_record.convalidated
          or constraint_record.condeferrable
          or constraint_record.condeferred
        )
    )
  then
    raise exception 'reviewed relation % constraints differ', relation_name;
  end if;

  if (
    select count(*)
    from pg_catalog.pg_index index_record
    where index_record.indrelid = relation_oid
  ) <> expected_index_count
  then
    raise exception 'reviewed relation % index count differs', relation_name;
  end if;

  if (
    select count(*)
    from pg_catalog.pg_policy policy
    where policy.polrelid = relation_oid
  ) <> 0
  then
    raise exception 'reviewed relation % exposes an unexpected policy', relation_name;
  end if;

  if exists (
    select 1
    from pg_catalog.aclexplode(
      coalesce(
        relation_contract.relacl,
        pg_catalog.acldefault('r', relation_contract.relowner)
      )
    ) privilege
    where privilege.grantee in (0::oid, anon_oid, authenticated_oid)
  ) then
    raise exception 'reviewed relation % ACL exposes a client role', relation_name;
  end if;
end
$assert$;

create or replace function pg_temp.assert_issue_878_check_fragment(
  relation_name text,
  required_fragment text
)
returns void
language plpgsql
as $assert$
declare
  relation_oid oid := to_regclass(relation_name);
begin
  if relation_oid is null or not exists (
    select 1
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid = relation_oid
      and constraint_record.contype = 'c'
      and pg_catalog.strpos(
        pg_catalog.pg_get_expr(
          constraint_record.conbin,
          constraint_record.conrelid
        ),
        required_fragment
      ) > 0
  ) then
    raise exception
      'reviewed relation % is missing check fragment %',
      relation_name,
      required_fragment;
  end if;
end
$assert$;

create or replace function pg_temp.assert_issue_878_index(
  index_name text,
  expected_table text,
  expected_unique boolean,
  required_definition_fragments text[]
)
returns void
language plpgsql
as $assert$
declare
  index_oid oid := to_regclass(index_name);
  table_oid oid := to_regclass(expected_table);
  index_contract record;
  definition_fragment text;
begin
  if index_oid is null or table_oid is null then
    raise exception 'reviewed index % or table % is absent', index_name, expected_table;
  end if;

  select
    index_record.*,
    index_relation.relowner as index_owner,
    index_relation.relkind as index_kind,
    table_relation.relowner as table_owner,
    access_method.amname as access_method_name
  into strict index_contract
  from pg_catalog.pg_index index_record
  join pg_catalog.pg_class index_relation
    on index_relation.oid = index_record.indexrelid
  join pg_catalog.pg_class table_relation
    on table_relation.oid = index_record.indrelid
  join pg_catalog.pg_am access_method
    on access_method.oid = index_relation.relam
  where index_record.indexrelid = index_oid;

  if index_contract.indrelid <> table_oid
    or index_contract.index_owner <> index_contract.table_owner
    or index_contract.index_kind <> 'i'
    or index_contract.access_method_name <> 'btree'
    or index_contract.indisunique is distinct from expected_unique
    or not index_contract.indisvalid
    or not index_contract.indisready
    or not index_contract.indislive
    or index_contract.indisexclusion
  then
    raise exception 'reviewed index % metadata differs', index_name;
  end if;

  foreach definition_fragment in array required_definition_fragments
  loop
    if pg_catalog.strpos(
      pg_catalog.pg_get_indexdef(index_oid),
      definition_fragment
    ) = 0
      and pg_catalog.strpos(
        coalesce(
          pg_catalog.pg_get_expr(index_contract.indpred, table_oid),
          ''
        ),
        definition_fragment
      ) = 0
    then
      raise exception
        'reviewed index % is missing a required definition fragment',
        index_name;
    end if;
  end loop;
end
$assert$;

create or replace function pg_temp.assert_issue_878_trigger(
  relation_name text,
  trigger_name text,
  function_signature text,
  expected_type integer,
  expected_update_columns text[]
)
returns void
language plpgsql
as $assert$
declare
  relation_oid oid := to_regclass(relation_name);
  function_oid oid := to_regprocedure(function_signature);
  trigger_contract record;
  update_columns text[];
begin
  if relation_oid is null or function_oid is null then
    raise exception 'reviewed trigger % prerequisite is absent', trigger_name;
  end if;

  select trigger.*
  into trigger_contract
  from pg_catalog.pg_trigger trigger
  where trigger.tgrelid = relation_oid
    and trigger.tgname = trigger_name
    and not trigger.tgisinternal;

  if not found
    or trigger_contract.tgfoid <> function_oid
    or trigger_contract.tgenabled <> 'O'
    or trigger_contract.tgtype <> expected_type
    or trigger_contract.tgconstraint <> 0
    or trigger_contract.tgnargs <> 0
    or trigger_contract.tgqual is not null
    or trigger_contract.tgdeferrable
    or trigger_contract.tginitdeferred
  then
    raise exception 'reviewed trigger % metadata differs', trigger_name;
  end if;

  select coalesce(
    pg_catalog.array_agg(attribute.attname order by update_attribute.position),
    '{}'::text[]
  )
  into update_columns
  from unnest(trigger_contract.tgattr::smallint[])
    with ordinality update_attribute(attnum, position)
  join pg_catalog.pg_attribute attribute
    on attribute.attrelid = relation_oid
    and attribute.attnum = update_attribute.attnum;

  if update_columns is distinct from expected_update_columns then
    raise exception 'reviewed trigger % update columns differ', trigger_name;
  end if;
end
$assert$;

create or replace function pg_temp.assert_issue_878_schema_release()
returns void
language plpgsql
as $assert$
declare
  authenticated_oid oid;
  delete_function record;
  storage_policy record;
  account_job_column_names text[];
  account_job_column_types text[];
  account_job_column_not_null boolean[];
  account_job_column_defaults text[];
  apple_column record;
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260808170000'
      and name = 'family_hard_delete_protocol'
      and statements = pg_temp.issue_878_schema_1700_statements()
  ) or not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260808171500'
      and name = 'account_deletion_avatar_cleanup'
      and statements = pg_temp.issue_878_schema_1715_statements()
  ) or not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260808183000'
      and name = 'folded_family_artifact_prefixes'
      and statements = pg_temp.issue_878_schema_1830_statements()
  ) or not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260808184500'
      and name = 'apple_purchase_interlock'
      and statements = pg_temp.issue_878_schema_1845_statements()
  ) then
    raise exception 'issue 878 schema release ledger evidence is absent or altered';
  end if;

  perform pg_temp.assert_issue_878_security_function(
    'public.guard_family_hard_delete_protocol()',
    'plpgsql',
    false,
    array[
      'family-fold-v2',
      'account-deletion-v2',
      'empty-anonymous-purge-v1',
      'family hard delete requires a recognized transaction protocol'
    ]
  );
  perform pg_temp.assert_issue_878_security_function(
    'public.guard_family_deletion_status_transition()',
    'plpgsql',
    false,
    array[
      'account-deletion-v2',
      'family deletion acceptance requires the account deletion protocol'
    ]
  );
  perform pg_temp.assert_issue_878_security_function(
    'public.capture_legacy_deletion_storage_users()',
    'plpgsql',
    false,
    array['provider_summary', 'stripe', 'canceled', 'storage_user_ids']
  );
  perform pg_temp.assert_issue_878_security_function(
    'public.ensure_account_deletion_job_tombstones()',
    'plpgsql',
    false,
    array[
      'family_artifact_prefixes',
      'account deletion artifact tombstone belongs to another job'
    ]
  );
  perform pg_temp.assert_issue_878_security_function(
    'public.current_auth_user_exists()',
    'sql',
    true,
    array['auth.uid()', 'storage_user_ids', 'status <> ''complete''']
  );
  perform pg_temp.assert_issue_878_security_function(
    'public.reject_deleting_user_membership()',
    'plpgsql',
    false,
    array[
      'for key share',
      'family membership is unavailable during account deletion'
    ]
  );
  perform pg_temp.assert_issue_878_security_function(
    'public.guard_family_apple_purchase_interlock()',
    'plpgsql',
    false,
    array[
      'apple_purchase_interlocks',
      'family hard delete is blocked by an active App Store purchase'
    ]
  );
  perform pg_temp.assert_issue_878_security_function(
    'public.delete_own_account()',
    'plpgsql',
    false,
    array['account deletion is temporarily unavailable']
  );

  select procedure.*
  into strict delete_function
  from pg_catalog.pg_proc procedure
  where procedure.oid = 'public.delete_own_account()'::regprocedure;

  if pg_catalog.btrim(delete_function.prosrc, E' \n\r\t') is distinct from
    $expected$begin
  raise exception using
    errcode = '55000',
    message = 'account deletion is temporarily unavailable';
end;$expected$
  then
    raise exception 'delete_own_account body no longer preserves containment';
  end if;

  if pg_catalog.has_function_privilege(
      'anon',
      'public.delete_own_account()',
      'execute'
    )
    or pg_catalog.has_function_privilege(
      'authenticated',
      'public.delete_own_account()',
      'execute'
    )
    or pg_catalog.has_function_privilege(
      'service_role',
      'public.delete_own_account()',
      'execute'
    )
  then
    raise exception 'delete_own_account exposes a client execute grant';
  end if;

  select
    pg_catalog.array_agg(attribute.attname order by attribute.attnum),
    pg_catalog.array_agg(
      pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
      order by attribute.attnum
    ),
    pg_catalog.array_agg(attribute.attnotnull order by attribute.attnum),
    pg_catalog.array_agg(
      coalesce(
        pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid),
        '<none>'
      )
      order by attribute.attnum
    )
  into
    account_job_column_names,
    account_job_column_types,
    account_job_column_not_null,
    account_job_column_defaults
  from pg_catalog.pg_attribute attribute
  left join pg_catalog.pg_attrdef default_value
    on default_value.adrelid = attribute.attrelid
    and default_value.adnum = attribute.attnum
  where attribute.attrelid = 'public.account_deletion_jobs'::regclass
    and attribute.attname in (
      'storage_user_ids',
      'final_cleanup_after',
      'artifact_quiet_since'
    )
    and not attribute.attisdropped;

  if account_job_column_names is distinct from array[
      'storage_user_ids',
      'final_cleanup_after',
      'artifact_quiet_since'
    ]::text[]
    or account_job_column_types is distinct from array[
      'uuid[]',
      'timestamp with time zone',
      'timestamp with time zone'
    ]::text[]
    or account_job_column_not_null is distinct from array[
      false,
      true,
      false
    ]::boolean[]
    or account_job_column_defaults[1] <> '<none>'
    or account_job_column_defaults[3] <> '<none>'
    or pg_catalog.strpos(account_job_column_defaults[2], '06:30:00') = 0
  then
    raise exception 'account_deletion_jobs release columns differ';
  end if;

  select
    pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) as type_name,
    attribute.attnotnull as not_null,
    default_value.oid is not null as has_default
  into apple_column
  from pg_catalog.pg_attribute attribute
  left join pg_catalog.pg_attrdef default_value
    on default_value.adrelid = attribute.attrelid
    and default_value.adnum = attribute.attnum
  where attribute.attrelid = 'public.families'::regclass
    and attribute.attname = 'apple_provider_observed_at'
    and not attribute.attisdropped;

  if not found
    or apple_column.type_name <> 'timestamp with time zone'
    or apple_column.not_null
    or apple_column.has_default
  then
    raise exception 'families.apple_provider_observed_at differs';
  end if;

  perform pg_temp.assert_issue_878_relation(
    'public.account_deletion_artifact_tombstones',
    array['family_id', 'deletion_job_id', 'created_at', 'last_swept_at'],
    array['uuid', 'uuid', 'timestamp with time zone', 'timestamp with time zone'],
    array[true, true, true, false],
    'fp',
    3
  );
  perform pg_temp.assert_issue_878_relation(
    'public.family_artifact_prefixes',
    array['artifact_family_id', 'owner_family_id', 'inherited_at'],
    array['uuid', 'uuid', 'timestamp with time zone'],
    array[true, true, true],
    'cfp',
    2
  );
  perform pg_temp.assert_issue_878_relation(
    'public.family_artifact_prefix_candidates',
    array[
      'owner_family_id',
      'artifact_family_id',
      'evidence_kind',
      'evidence_count',
      'observed_at'
    ],
    array[
      'uuid',
      'uuid',
      'text',
      'integer',
      'timestamp with time zone'
    ],
    array[true, true, true, true, true],
    'cccfp',
    1
  );
  perform pg_temp.assert_issue_878_relation(
    'public.apple_purchase_interlocks',
    array[
      'attempt_id',
      'family_id',
      'product_id',
      'state',
      'created_at',
      'updated_at',
      'resolved_at',
      'canceled_at'
    ],
    array[
      'uuid',
      'uuid',
      'text',
      'text',
      'timestamp with time zone',
      'timestamp with time zone',
      'timestamp with time zone',
      'timestamp with time zone'
    ],
    array[true, true, true, true, true, true, false, false],
    'ccccfp',
    4
  );

  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid =
        'public.account_deletion_artifact_tombstones'::regclass
      and constraint_record.conname =
        'account_deletion_artifact_tombstones_deletion_job_id_fkey'
      and constraint_record.contype = 'f'
      and constraint_record.conkey = array[2]::smallint[]
      and constraint_record.confrelid =
        'public.account_deletion_jobs'::regclass
      and constraint_record.confkey = array[1]::smallint[]
      and constraint_record.confdeltype = 'r'
  ) or not exists (
    select 1
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid =
        'public.family_artifact_prefixes'::regclass
      and constraint_record.conname =
        'family_artifact_prefixes_owner_family_id_fkey'
      and constraint_record.contype = 'f'
      and constraint_record.conkey = array[2]::smallint[]
      and constraint_record.confrelid = 'public.families'::regclass
      and constraint_record.confkey = array[1]::smallint[]
      and constraint_record.confdeltype = 'c'
  ) or not exists (
    select 1
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid =
        'public.family_artifact_prefix_candidates'::regclass
      and constraint_record.conname =
        'family_artifact_prefix_candidates_owner_family_id_fkey'
      and constraint_record.contype = 'f'
      and constraint_record.conkey = array[1]::smallint[]
      and constraint_record.confrelid = 'public.families'::regclass
      and constraint_record.confkey = array[1]::smallint[]
      and constraint_record.confdeltype = 'a'
  ) or not exists (
    select 1
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid =
        'public.apple_purchase_interlocks'::regclass
      and constraint_record.conname =
        'apple_purchase_interlocks_family_id_fkey'
      and constraint_record.contype = 'f'
      and constraint_record.conkey = array[2]::smallint[]
      and constraint_record.confrelid = 'public.families'::regclass
      and constraint_record.confkey = array[1]::smallint[]
      and constraint_record.confdeltype = 'c'
  ) then
    raise exception 'reviewed account deletion foreign-key contract differs';
  end if;

  perform pg_temp.assert_issue_878_check_fragment(
    'public.family_artifact_prefixes',
    'artifact_family_id <> owner_family_id'
  );
  perform pg_temp.assert_issue_878_check_fragment(
    'public.family_artifact_prefix_candidates',
    'artifact_family_id <> owner_family_id'
  );
  perform pg_temp.assert_issue_878_check_fragment(
    'public.family_artifact_prefix_candidates',
    'evidence_count > 0'
  );
  perform pg_temp.assert_issue_878_check_fragment(
    'public.family_artifact_prefix_candidates',
    '''material_output''::text'
  );
  perform pg_temp.assert_issue_878_check_fragment(
    'public.family_artifact_prefix_candidates',
    '''lesson_audio''::text'
  );
  perform pg_temp.assert_issue_878_check_fragment(
    'public.apple_purchase_interlocks',
    'char_length(product_id) >= 1'
  );
  perform pg_temp.assert_issue_878_check_fragment(
    'public.apple_purchase_interlocks',
    'char_length(product_id) <= 200'
  );
  perform pg_temp.assert_issue_878_check_fragment(
    'public.apple_purchase_interlocks',
    '''cancel_pending''::text'
  );
  perform pg_temp.assert_issue_878_check_fragment(
    'public.apple_purchase_interlocks',
    'resolved_at IS NOT NULL'
  );
  perform pg_temp.assert_issue_878_check_fragment(
    'public.apple_purchase_interlocks',
    'canceled_at IS NOT NULL'
  );

  perform pg_temp.assert_issue_878_index(
    'public.account_deletion_artifact_tombstones_sweep_idx',
    'public.account_deletion_artifact_tombstones',
    false,
    array['last_swept_at', 'created_at']
  );
  perform pg_temp.assert_issue_878_index(
    'public.account_deletion_artifact_tombstones_job_idx',
    'public.account_deletion_artifact_tombstones',
    false,
    array['deletion_job_id', 'family_id']
  );
  perform pg_temp.assert_issue_878_index(
    'public.family_artifact_prefixes_owner_idx',
    'public.family_artifact_prefixes',
    false,
    array['owner_family_id', 'artifact_family_id']
  );
  perform pg_temp.assert_issue_878_index(
    'public.apple_purchase_interlocks_family_idx',
    'public.apple_purchase_interlocks',
    false,
    array['family_id', 'state', 'created_at', 'attempt_id']
  );
  perform pg_temp.assert_issue_878_index(
    'public.apple_purchase_interlocks_one_active_family_idx',
    'public.apple_purchase_interlocks',
    true,
    array['family_id', 'prepared', 'store_started', 'cancel_pending']
  );
  perform pg_temp.assert_issue_878_index(
    'public.apple_purchase_interlocks_updated_idx',
    'public.apple_purchase_interlocks',
    false,
    array['updated_at']
  );
  perform pg_temp.assert_issue_878_index(
    'public.account_deletion_jobs_pending_idx',
    'public.account_deletion_jobs',
    false,
    array[
      'updated_at',
      'requested_at',
      'preparing',
      'waiting_for_artifacts',
      'retryable_failed'
    ]
  );

  perform pg_temp.assert_issue_878_trigger(
    'public.families',
    'families_hard_delete_protocol_guard',
    'public.guard_family_hard_delete_protocol()',
    11,
    '{}'::text[]
  );
  perform pg_temp.assert_issue_878_trigger(
    'public.families',
    'families_deletion_status_protocol_guard',
    'public.guard_family_deletion_status_transition()',
    19,
    array['status']
  );
  perform pg_temp.assert_issue_878_trigger(
    'public.account_deletion_jobs',
    'account_deletion_jobs_capture_legacy_users',
    'public.capture_legacy_deletion_storage_users()',
    23,
    array['family_id', 'requested_by_user_id', 'status', 'provider_summary']
  );
  perform pg_temp.assert_issue_878_trigger(
    'public.account_deletion_jobs',
    'account_deletion_jobs_ensure_tombstones',
    'public.ensure_account_deletion_job_tombstones()',
    21,
    array['family_id', 'status']
  );
  perform pg_temp.assert_issue_878_trigger(
    'public.family_members',
    'family_members_reject_deleting_user',
    'public.reject_deleting_user_membership()',
    23,
    array['user_id']
  );
  perform pg_temp.assert_issue_878_trigger(
    'public.families',
    'families_apple_purchase_interlock_guard',
    'public.guard_family_apple_purchase_interlock()',
    11,
    '{}'::text[]
  );

  select oid into authenticated_oid
  from pg_catalog.pg_roles
  where rolname = 'authenticated';

  for storage_policy in
    select policy.*
    from pg_catalog.pg_policy policy
    where policy.polrelid = 'storage.objects'::regclass
      and policy.polname in (
        'avatar owners upload',
        'avatar owners update',
        'avatar owners delete'
      )
  loop
    if not storage_policy.polpermissive
      or storage_policy.polroles
        is distinct from array[authenticated_oid]::oid[]
      or storage_policy.polcmd is distinct from (
        case storage_policy.polname
          when 'avatar owners upload' then 'a'::"char"
          when 'avatar owners update' then 'w'::"char"
          when 'avatar owners delete' then 'd'::"char"
        end
      )
      or pg_catalog.strpos(
        coalesce(
          pg_catalog.pg_get_expr(
            storage_policy.polqual,
            storage_policy.polrelid
          ),
          ''
        ) || coalesce(
          pg_catalog.pg_get_expr(
            storage_policy.polwithcheck,
            storage_policy.polrelid
          ),
          ''
        ),
        'current_auth_user_exists()'
      ) = 0
      or pg_catalog.strpos(
        coalesce(
          pg_catalog.pg_get_expr(
            storage_policy.polqual,
            storage_policy.polrelid
          ),
          ''
        ) || coalesce(
          pg_catalog.pg_get_expr(
            storage_policy.polwithcheck,
            storage_policy.polrelid
          ),
          ''
        ),
        'bucket_id = ''avatars''::text'
      ) = 0
      or pg_catalog.strpos(
        coalesce(
          pg_catalog.pg_get_expr(
            storage_policy.polqual,
            storage_policy.polrelid
          ),
          ''
        ) || coalesce(
          pg_catalog.pg_get_expr(
            storage_policy.polwithcheck,
            storage_policy.polrelid
          ),
          ''
        ),
        'storage.foldername(name)'
      ) = 0
    then
      raise exception 'avatar storage policy % differs', storage_policy.polname;
    end if;
  end loop;

  if (
    select count(*)
    from pg_catalog.pg_policy policy
    where policy.polrelid = 'storage.objects'::regclass
      and policy.polname in (
        'avatar owners upload',
        'avatar owners update',
        'avatar owners delete'
      )
  ) <> 3
  then
    raise exception 'the three reviewed avatar storage policies are not exact';
  end if;
end
$assert$;

select pg_temp.assert_issue_878_schema_release();

create temporary table issue_878_schema_probe_ids on commit drop as
select
  pg_catalog.gen_random_uuid() as primary_family_id,
  pg_catalog.gen_random_uuid() as inherited_family_id,
  pg_catalog.gen_random_uuid() as fold_source_family_id,
  pg_catalog.gen_random_uuid() as fold_destination_family_id,
  pg_catalog.gen_random_uuid() as apple_family_id,
  pg_catalog.gen_random_uuid() as first_job_id,
  pg_catalog.gen_random_uuid() as inherited_job_id,
  pg_catalog.gen_random_uuid() as apple_job_id,
  pg_catalog.gen_random_uuid() as apple_attempt_id;

savepoint issue_878_schema_behavior_probes;

insert into public.families (id, name, sandbox)
select primary_family_id, 'Issue 878 schema primary probe', true
from issue_878_schema_probe_ids
union all
select inherited_family_id, 'Issue 878 schema inherited probe', true
from issue_878_schema_probe_ids
union all
select fold_source_family_id, 'Issue 878 schema fold source probe', true
from issue_878_schema_probe_ids
union all
select fold_destination_family_id, 'Issue 878 schema fold destination probe', true
from issue_878_schema_probe_ids
union all
select apple_family_id, 'Issue 878 schema Apple probe', true
from issue_878_schema_probe_ids;

insert into public.account_deletion_jobs (id, family_id, status)
select first_job_id, primary_family_id, 'running'
from issue_878_schema_probe_ids;

select pg_catalog.set_config(
  'homa.family_delete_mode',
  'account-deletion-v2',
  true
);

update public.families family
set status = 'deleted'
from issue_878_schema_probe_ids probe
where family.id = probe.primary_family_id;

delete from public.families family
using issue_878_schema_probe_ids probe
where family.id = probe.primary_family_id;

do $primary_probe$
begin
  if exists (
    select 1
    from public.families family
    join issue_878_schema_probe_ids probe
      on family.id = probe.primary_family_id
  ) or not exists (
    select 1
    from public.account_deletion_artifact_tombstones tombstone
    join issue_878_schema_probe_ids probe
      on tombstone.family_id = probe.primary_family_id
      and tombstone.deletion_job_id = probe.first_job_id
  ) then
    raise exception 'primary account deletion protocol probe failed';
  end if;
end
$primary_probe$;

insert into public.family_artifact_prefixes (
  artifact_family_id,
  owner_family_id
)
select
  fold_source_family_id,
  fold_destination_family_id
from issue_878_schema_probe_ids;

select pg_catalog.set_config(
  'homa.family_delete_mode',
  'family-fold-v2',
  true
);

delete from public.families family
using issue_878_schema_probe_ids probe
where family.id = probe.fold_source_family_id;

do $fold_probe$
begin
  if exists (
    select 1
    from public.families family
    join issue_878_schema_probe_ids probe
      on family.id = probe.fold_source_family_id
  ) or not exists (
    select 1
    from public.family_artifact_prefixes prefix
    join issue_878_schema_probe_ids probe
      on prefix.artifact_family_id = probe.fold_source_family_id
      and prefix.owner_family_id = probe.fold_destination_family_id
  ) then
    raise exception 'family fold artifact-prefix protocol probe failed';
  end if;
end
$fold_probe$;

insert into public.family_artifact_prefixes (
  artifact_family_id,
  owner_family_id
)
select
  pg_catalog.gen_random_uuid(),
  inherited_family_id
from issue_878_schema_probe_ids;

insert into public.account_deletion_jobs (id, family_id, status)
select inherited_job_id, inherited_family_id, 'running'
from issue_878_schema_probe_ids;

do $inherited_tombstone_probe$
begin
  if (
    select count(*)
    from public.account_deletion_artifact_tombstones tombstone
    join issue_878_schema_probe_ids probe
      on tombstone.deletion_job_id = probe.inherited_job_id
  ) <> 2 then
    raise exception 'folded artifact tombstone expansion probe failed';
  end if;
end
$inherited_tombstone_probe$;

insert into public.apple_purchase_interlocks (
  attempt_id,
  family_id,
  product_id,
  state
)
select
  apple_attempt_id,
  apple_family_id,
  'com.homa.issue878.schema.probe',
  'prepared'
from issue_878_schema_probe_ids;

insert into public.account_deletion_jobs (id, family_id, status)
select apple_job_id, apple_family_id, 'running'
from issue_878_schema_probe_ids;

select pg_catalog.set_config(
  'homa.family_delete_mode',
  'account-deletion-v2',
  true
);

update public.families family
set status = 'deleted'
from issue_878_schema_probe_ids probe
where family.id = probe.apple_family_id;

do $apple_interlock_probe$
declare
  target_family_id uuid;
begin
  select apple_family_id
  into strict target_family_id
  from issue_878_schema_probe_ids;

  begin
    delete from public.families
    where id = target_family_id;
    raise exception 'active App Store interlock did not block deletion';
  exception
    when sqlstate '55000' then
      if sqlerrm <> 'family hard delete is blocked by an active App Store purchase' then
        raise;
      end if;
  end;
end
$apple_interlock_probe$;

update public.apple_purchase_interlocks interlock
set
  state = 'resolved',
  resolved_at = pg_catalog.now(),
  updated_at = pg_catalog.now()
from issue_878_schema_probe_ids probe
where interlock.attempt_id = probe.apple_attempt_id;

delete from public.families family
using issue_878_schema_probe_ids probe
where family.id = probe.apple_family_id;

rollback to savepoint issue_878_schema_behavior_probes;

do $zero_probe_residue$
begin
  if exists (
    select 1
    from public.families family
    join issue_878_schema_probe_ids probe
      on family.id in (
        probe.primary_family_id,
        probe.inherited_family_id,
        probe.fold_source_family_id,
        probe.fold_destination_family_id,
        probe.apple_family_id
      )
  ) or exists (
    select 1
    from public.account_deletion_jobs job
    join issue_878_schema_probe_ids probe
      on job.id in (
        probe.first_job_id,
        probe.inherited_job_id,
        probe.apple_job_id
      )
  ) or exists (
    select 1
    from public.apple_purchase_interlocks interlock
    join issue_878_schema_probe_ids probe
      on interlock.attempt_id = probe.apple_attempt_id
  ) or exists (
    select 1
    from public.account_deletion_artifact_tombstones tombstone
    join issue_878_schema_probe_ids probe
      on tombstone.deletion_job_id in (
        probe.first_job_id,
        probe.inherited_job_id,
        probe.apple_job_id
      )
  ) or exists (
    select 1
    from public.family_artifact_prefixes prefix
    join issue_878_schema_probe_ids probe
      on prefix.artifact_family_id = probe.fold_source_family_id
      or prefix.owner_family_id in (
        probe.inherited_family_id,
        probe.fold_destination_family_id
      )
  ) then
    raise exception 'issue 878 schema release left behavior-probe residue';
  end if;
end
$zero_probe_residue$;

select pg_temp.assert_issue_878_schema_release();

select 'ISSUE_878_ACCOUNT_DELETION_SCHEMA=' || case
  when applied then 'applied'
  else 'verified_noop'
end
from issue_878_schema_release_state;

commit;
