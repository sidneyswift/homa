-- Family-upload training provenance, export versions, and deletion actions
-- (gh#575). Training state stays outside the family-facing Library tables.
--
-- Copyright is intentionally absent from this schema. The founder ruling
-- `family-upload-copyright-training-open` says it is neither an intake gate
-- nor, by itself, a training exclusion. Privacy, secrets, source integrity,
-- and deletion propagation remain deterministic gates.

create schema if not exists training;
revoke all on schema training from public, anon, authenticated;

create table training.dataset_builds (
  id uuid primary key default gen_random_uuid(),
  dataset_version text not null unique
    check (char_length(btrim(dataset_version)) between 1 and 120),
  pipeline_version text not null
    check (char_length(btrim(pipeline_version)) between 1 and 120),
  status text not null default 'building'
    check (status in ('building', 'ready', 'withdrawal_required', 'retired')),
  output_manifest_sha256 text
    check (
      output_manifest_sha256 is null
      or output_manifest_sha256 ~ '^[0-9a-f]{64}$'
    ),
  record_count integer not null default 0 check (record_count >= 0),
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (status = 'ready' and ready_at is not null and output_manifest_sha256 is not null)
    or status <> 'ready'
  )
);

create table training.family_asset_sources (
  id uuid primary key default gen_random_uuid(),
  dataset_build_id uuid not null
    references training.dataset_builds (id) on delete restrict,
  family_id uuid not null,
  source_asset_id uuid not null,
  source_content_sha256 text
    check (
      source_content_sha256 is null
      or source_content_sha256 ~ '^[0-9a-f]{64}$'
    ),
  extracted_content_sha256 text
    check (
      extracted_content_sha256 is null
      or extracted_content_sha256 ~ '^[0-9a-f]{64}$'
    ),
  ingestion_version text not null
    check (char_length(btrim(ingestion_version)) between 1 and 120),
  safety_policy_version text not null
    check (char_length(btrim(safety_policy_version)) between 1 and 120),
  transform_manifest jsonb not null
    check (
      jsonb_typeof(transform_manifest) = 'object'
      and octet_length(transform_manifest::text) <= 8192
    ),
  decision text not null
    check (decision in ('eligible', 'excluded', 'source_deleted')),
  exclusion_reasons text[] not null default '{}'
    check (
      exclusion_reasons <@ array[
        'secret_detected',
        'child_identifier_detected',
        'sensitive_record_detected',
        'unsupported_source',
        'source_too_large',
        'unreadable_source',
        'truncated_source',
        'source_not_ready',
        'source_deleted',
        'operator_excluded'
      ]::text[]
    ),
  source_deleted_at timestamptz,
  idempotency_key text not null unique
    check (idempotency_key ~ '^[0-9a-f]{64}$'),
  decided_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (
      decision = 'eligible'
      and cardinality(exclusion_reasons) = 0
      and extracted_content_sha256 is not null
    )
    or (decision = 'excluded' and cardinality(exclusion_reasons) >= 1)
    or (
      decision = 'source_deleted'
      and source_deleted_at is not null
      and 'source_deleted' = any(exclusion_reasons)
    )
  )
);

create index family_asset_training_source_idx
  on training.family_asset_sources (family_id, source_asset_id, decided_at desc);
create index family_asset_training_source_build_idx
  on training.family_asset_sources (dataset_build_id, decision);

create table training.family_asset_exports (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null
    references training.family_asset_sources (id) on delete restrict,
  dataset_build_id uuid not null
    references training.dataset_builds (id) on delete restrict,
  record_sha256 text not null check (record_sha256 ~ '^[0-9a-f]{64}$'),
  transform_manifest jsonb not null
    check (
      jsonb_typeof(transform_manifest) = 'object'
      and octet_length(transform_manifest::text) <= 8192
    ),
  status text not null default 'staged'
    check (status in ('staged', 'included', 'removal_required', 'removed')),
  staged_at timestamptz not null default now(),
  included_at timestamptz,
  removal_required_at timestamptz,
  removed_at timestamptz,
  removal_evidence text
    check (
      removal_evidence is null
      or char_length(btrim(removal_evidence)) between 1 and 500
    ),
  updated_at timestamptz not null default now(),
  unique (source_id, dataset_build_id),
  check (
    (
      status = 'staged'
      and included_at is null
      and removal_required_at is null
      and removed_at is null
      and removal_evidence is null
    )
    or (
      status = 'included'
      and included_at is not null
      and removal_required_at is null
      and removed_at is null
      and removal_evidence is null
    )
    or (
      status = 'removal_required'
      and removal_required_at is not null
      and removed_at is null
      and removal_evidence is null
    )
    or (
      status = 'removed'
      and removal_required_at is not null
      and removed_at is not null
      and removal_evidence is not null
    )
  )
);

create index family_asset_training_export_build_idx
  on training.family_asset_exports (dataset_build_id, status);

create table training.family_asset_actions (
  id bigint generated always as identity primary key,
  source_id uuid not null
    references training.family_asset_sources (id) on delete restrict,
  export_id uuid
    references training.family_asset_exports (id) on delete restrict,
  family_id uuid not null,
  source_asset_id uuid not null,
  dataset_version text not null
    references training.dataset_builds (dataset_version) on delete restrict,
  action text not null
    check (action in (
      'eligibility_recorded',
      'exclusion_recorded',
      'source_deleted',
      'export_staged',
      'export_included',
      'downstream_removal_required',
      'downstream_removal_completed'
    )),
  reason_codes text[] not null default '{}'
    check (
      reason_codes <@ array[
        'secret_detected',
        'child_identifier_detected',
        'sensitive_record_detected',
        'unsupported_source',
        'source_too_large',
        'unreadable_source',
        'truncated_source',
        'source_not_ready',
        'source_deleted',
        'operator_excluded'
      ]::text[]
    ),
  created_at timestamptz not null default now(),
  check (
    (
      action in ('eligibility_recorded', 'exclusion_recorded', 'source_deleted')
      and export_id is null
    )
    or (
      action in (
        'export_staged',
        'export_included',
        'downstream_removal_required',
        'downstream_removal_completed'
      )
      and export_id is not null
    )
  )
);

create index family_asset_training_action_source_idx
  on training.family_asset_actions (family_id, source_asset_id, created_at);
create index family_asset_training_action_dataset_idx
  on training.family_asset_actions (dataset_version, created_at)
  where dataset_version is not null;

create or replace function training.validate_dataset_build_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, training
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '42501', message = 'training dataset builds are append-only';
  end if;

  if old.dataset_version is distinct from new.dataset_version
     or old.pipeline_version is distinct from new.pipeline_version
     or old.created_at is distinct from new.created_at then
    raise exception using errcode = '42501', message = 'training dataset identity is immutable';
  end if;
  if old.status <> 'building'
     and (
       old.output_manifest_sha256 is distinct from new.output_manifest_sha256
       or old.record_count is distinct from new.record_count
       or old.ready_at is distinct from new.ready_at
     ) then
    raise exception using errcode = '42501', message = 'finalized training dataset provenance is immutable';
  end if;

  if old.status = 'retired' and new.status <> 'retired' then
    raise exception using errcode = '23514', message = 'retired training datasets cannot be reopened';
  end if;
  if old.status = 'ready'
     and new.status not in ('ready', 'withdrawal_required') then
    raise exception using errcode = '23514', message = 'ready training datasets cannot be reopened';
  end if;
  if old.status = 'withdrawal_required'
     and new.status not in ('withdrawal_required', 'retired') then
    raise exception using errcode = '23514', message = 'a withdrawal-required dataset cannot return to service';
  end if;

  return new;
end;
$$;

create trigger validate_dataset_build_transition
before update or delete on training.dataset_builds
for each row execute function training.validate_dataset_build_transition();

create or replace function training.validate_family_asset_source()
returns trigger
language plpgsql
set search_path = pg_catalog, public, training
as $$
declare
  asset_deleted_at timestamptz;
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '42501', message = 'family asset training sources are append-only';
  end if;

  if tg_op = 'UPDATE' then
    if old.family_id is distinct from new.family_id
       or old.dataset_build_id is distinct from new.dataset_build_id
       or old.source_asset_id is distinct from new.source_asset_id
       or old.source_content_sha256 is distinct from new.source_content_sha256
       or old.extracted_content_sha256 is distinct from new.extracted_content_sha256
       or old.ingestion_version is distinct from new.ingestion_version
       or old.safety_policy_version is distinct from new.safety_policy_version
       or old.transform_manifest is distinct from new.transform_manifest
       or old.idempotency_key is distinct from new.idempotency_key
       or old.decided_at is distinct from new.decided_at then
      raise exception using errcode = '42501', message = 'family asset training provenance is immutable';
    end if;
    if old.decision is distinct from new.decision
       and new.decision <> 'source_deleted' then
      raise exception using errcode = '23514', message = 'training decisions are append-only';
    end if;
    if old.decision = 'source_deleted' and new.decision <> 'source_deleted' then
      raise exception using errcode = '23514', message = 'a deleted training source cannot become eligible again';
    end if;
    if new.decision <> 'source_deleted'
       and (
         old.exclusion_reasons is distinct from new.exclusion_reasons
         or old.source_deleted_at is distinct from new.source_deleted_at
       ) then
      raise exception using errcode = '42501', message = 'training exclusion provenance is immutable';
    end if;
    if old.decision = 'source_deleted'
       and (
         old.exclusion_reasons is distinct from new.exclusion_reasons
         or old.source_deleted_at is distinct from new.source_deleted_at
       ) then
      raise exception using errcode = '42501', message = 'training tombstone provenance is immutable';
    end if;
  end if;

  select asset.deleted_at
    into asset_deleted_at
  from public.family_assets asset
  where asset.id = new.source_asset_id
    and asset.family_id = new.family_id;

  if not found and new.decision <> 'source_deleted' then
    raise exception using errcode = '23503', message = 'training source does not belong to the recorded family';
  end if;
  if asset_deleted_at is not null and new.decision <> 'source_deleted' then
    raise exception using errcode = '23514', message = 'deleted family assets cannot enter a training export';
  end if;
  if new.decision = 'source_deleted'
     and asset_deleted_at is null
     and not (
       tg_op = 'UPDATE'
       and old.decision <> 'source_deleted'
       and new.decision = 'source_deleted'
     ) then
    raise exception using errcode = '23514', message = 'source_deleted requires a deleted family asset';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger validate_family_asset_source
before insert or update or delete on training.family_asset_sources
for each row execute function training.validate_family_asset_source();

create or replace function training.validate_family_asset_export()
returns trigger
language plpgsql
set search_path = pg_catalog, public, training
as $$
declare
  source_row training.family_asset_sources%rowtype;
  build_status text;
  live_asset boolean;
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '42501', message = 'family asset training exports are append-only';
  end if;

  if tg_op = 'UPDATE' then
    if old.source_id is distinct from new.source_id
       or old.dataset_build_id is distinct from new.dataset_build_id
       or old.record_sha256 is distinct from new.record_sha256
       or old.transform_manifest is distinct from new.transform_manifest
       or old.staged_at is distinct from new.staged_at then
      raise exception using errcode = '42501', message = 'family asset export provenance is immutable';
    end if;
    if old.included_at is not null
       and old.included_at is distinct from new.included_at then
      raise exception using errcode = '42501', message = 'training inclusion time is immutable';
    end if;
    if old.removal_required_at is not null
       and old.removal_required_at is distinct from new.removal_required_at then
      raise exception using errcode = '42501', message = 'training removal request time is immutable';
    end if;
    if old.removed_at is not null
       and old.removed_at is distinct from new.removed_at then
      raise exception using errcode = '42501', message = 'training removal time is immutable';
    end if;
    if old.removal_evidence is not null
       and old.removal_evidence is distinct from new.removal_evidence then
      raise exception using errcode = '42501', message = 'training removal evidence is immutable';
    end if;
    if old.status = 'staged'
       and new.status not in ('staged', 'included', 'removal_required') then
      raise exception using errcode = '23514', message = 'staged exports must be included or marked for removal first';
    end if;
    if old.status = 'included' and new.status not in ('included', 'removal_required') then
      raise exception using errcode = '23514', message = 'included exports can only move to removal_required';
    end if;
    if old.status = 'removal_required' and new.status not in ('removal_required', 'removed') then
      raise exception using errcode = '23514', message = 'removal-required exports can only be removed';
    end if;
    if old.status = 'removed' and new.status <> 'removed' then
      raise exception using errcode = '23514', message = 'removed exports cannot be restored';
    end if;
  end if;

  select * into source_row
  from training.family_asset_sources
  where id = new.source_id;
  if not found then
    raise exception using errcode = '23503', message = 'unknown family asset training source';
  end if;

  select build.status into build_status
  from training.dataset_builds build
  where build.id = new.dataset_build_id;
  if not found then
    raise exception using errcode = '23503', message = 'unknown training dataset build';
  end if;

  select exists (
    select 1
    from public.family_assets asset
    where asset.id = source_row.source_asset_id
      and asset.family_id = source_row.family_id
      and asset.deleted_at is null
  ) into live_asset;

  if new.status in ('staged', 'included') then
    if source_row.decision <> 'eligible' or not live_asset then
      raise exception using errcode = '23514', message = 'only a live eligible family asset may enter a training export';
    end if;
    if build_status <> 'building' then
      raise exception using errcode = '23514', message = 'training exports may only be added while a dataset is building';
    end if;
  end if;
  if source_row.dataset_build_id <> new.dataset_build_id then
    raise exception using errcode = '23514', message = 'training source decision belongs to another dataset build';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger validate_family_asset_export
before insert or update or delete on training.family_asset_exports
for each row execute function training.validate_family_asset_export();

create or replace function training.record_family_asset_source_action()
returns trigger
language plpgsql
set search_path = pg_catalog, training
as $$
declare
  action_name text;
  version text;
begin
  if tg_op = 'INSERT' then
    action_name := case
      when new.decision = 'eligible' then 'eligibility_recorded'
      when new.decision = 'source_deleted' then 'source_deleted'
      else 'exclusion_recorded'
    end;
  elsif old.decision is distinct from new.decision
        and new.decision = 'source_deleted' then
    action_name := 'source_deleted';
  else
    return new;
  end if;

  select dataset_version into version
  from training.dataset_builds
  where id = new.dataset_build_id;

  insert into training.family_asset_actions (
    source_id, family_id, source_asset_id, dataset_version,
    action, reason_codes
  ) values (
    new.id, new.family_id, new.source_asset_id, version, action_name,
    new.exclusion_reasons
  );
  return new;
end;
$$;

create trigger record_family_asset_source_action
after insert or update on training.family_asset_sources
for each row execute function training.record_family_asset_source_action();

create or replace function training.record_family_asset_export_action()
returns trigger
language plpgsql
set search_path = pg_catalog, training
as $$
declare
  source_row training.family_asset_sources%rowtype;
  version text;
  action_name text;
begin
  if tg_op = 'INSERT' then
    action_name := case new.status
      when 'included' then 'export_included'
      when 'removal_required' then 'downstream_removal_required'
      when 'removed' then 'downstream_removal_completed'
      else 'export_staged'
    end;
  elsif old.status is not distinct from new.status then
    return new;
  else
    action_name := case new.status
      when 'included' then 'export_included'
      when 'removal_required' then 'downstream_removal_required'
      when 'removed' then 'downstream_removal_completed'
      else null
    end;
  end if;
  if action_name is null then return new; end if;

  select * into source_row
  from training.family_asset_sources
  where id = new.source_id;
  select dataset_version into version
  from training.dataset_builds
  where id = new.dataset_build_id;

  insert into training.family_asset_actions (
    source_id, export_id, family_id, source_asset_id,
    dataset_version, action, reason_codes
  ) values (
    new.source_id, new.id, source_row.family_id, source_row.source_asset_id,
    version, action_name, source_row.exclusion_reasons
  );
  return new;
end;
$$;

create trigger record_family_asset_export_action
after insert or update on training.family_asset_exports
for each row execute function training.record_family_asset_export_action();

create or replace function training.propagate_family_asset_deletion()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, training
as $$
declare
  deleted_family_id uuid;
  deleted_asset_id uuid;
  deleted_time timestamptz;
  source_row record;
  export_row record;
begin
  deleted_family_id := old.family_id;
  deleted_asset_id := old.id;
  deleted_time := case when tg_op = 'DELETE' then now() else new.deleted_at end;

  if tg_op = 'UPDATE' and (old.deleted_at is not null or new.deleted_at is null) then
    return new;
  end if;

  for source_row in
    update training.family_asset_sources
    set decision = 'source_deleted',
        exclusion_reasons = case
          when 'source_deleted' = any(exclusion_reasons) then exclusion_reasons
          else array_append(exclusion_reasons, 'source_deleted')
        end,
        source_deleted_at = deleted_time,
        updated_at = now()
    where family_id = deleted_family_id
      and source_asset_id = deleted_asset_id
      and decision <> 'source_deleted'
    returning id
  loop
    for export_row in
      update training.family_asset_exports
      set status = 'removal_required',
          removal_required_at = coalesce(removal_required_at, deleted_time),
          updated_at = now()
      where source_id = source_row.id
        and status in ('staged', 'included')
      returning dataset_build_id
    loop
      update training.dataset_builds
      set status = case
            when status = 'retired' then status
            else 'withdrawal_required'
          end,
          updated_at = now()
      where id = export_row.dataset_build_id;
    end loop;
  end loop;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function training.propagate_family_asset_deletion()
  from public, anon, authenticated;

create trigger propagate_family_asset_soft_deletion
after update of deleted_at on public.family_assets
for each row execute function training.propagate_family_asset_deletion();

create trigger propagate_family_asset_hard_deletion
before delete on public.family_assets
for each row execute function training.propagate_family_asset_deletion();

create or replace function training.prevent_family_asset_action_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '42501', message = 'family asset training actions are append-only';
end;
$$;

create trigger prevent_family_asset_action_mutation
before update or delete on training.family_asset_actions
for each row execute function training.prevent_family_asset_action_mutation();

revoke all on all tables in schema training from public, anon, authenticated;
revoke all on all sequences in schema training from public, anon, authenticated;
revoke all on all functions in schema training from public, anon, authenticated;
alter default privileges in schema training
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema training
  revoke all on sequences from public, anon, authenticated;
alter default privileges in schema training
  revoke all on functions from public, anon, authenticated;
