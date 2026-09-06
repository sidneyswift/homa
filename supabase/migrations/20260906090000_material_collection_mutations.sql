-- gh#1091, phase 1: passive functions may ship before the web deployment.
-- Activate revision inheritance only after the RPC-aware restore code is READY.
-- Collection removal retains every row, preview, PDF, and exact-ID history read.

-- Removing an already-visible lesson worksheet is not an approval. This
-- separate marker exposes its connected history only inside collection removal;
-- enforce_material_status_write_boundary still requires the finalization marker.
drop policy if exists "members read their materials" on public.materials;
create policy "members read their materials" on public.materials
for select to authenticated using (
  public.is_family_member(family_id) and (
    subject_lesson_id is null or status = 'final'
    or current_setting('homa.material_finalization_rpc', true) = 'allowed'
    or current_setting('homa.material_collection_rpc', true) = 'allowed'
  )
);
drop policy if exists "members update their materials" on public.materials;
create policy "members update their materials" on public.materials
for update to authenticated using (
  public.is_family_member(family_id) and (
    subject_lesson_id is null
    or current_setting('homa.material_finalization_rpc', true) = 'allowed'
    or current_setting('homa.material_collection_rpc', true) = 'allowed'
  )
) with check (
  public.is_family_member(family_id) and (
    subject_lesson_id is null
    or current_setting('homa.material_finalization_rpc', true) = 'allowed'
    or current_setting('homa.material_collection_rpc', true) = 'allowed'
  )
);

create or replace function public.remove_family_material_chain(
  p_family_id uuid,
  p_material_id uuid
)
returns table(result text, versions_removed integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  chain_ids uuid[];
  visible_count integer;
  removal_time timestamptz;
  previous_collection_scope text;
begin
  if auth.uid() is null or not public.is_family_member(p_family_id) then
    raise exception 'Family access denied' using errcode = '42501';
  end if;

  -- Inserts and explicit restores use this same transaction lock before any
  -- material row lock. Unlike locking the entire family, unrelated finalizes
  -- remain free to run. Existing finalize locks rows in ascending ID order.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('material-collection:' || p_family_id::text, 0)
  );

  -- The caller must already be able to see the requested material. Hidden
  -- automatic drafts are not a separate parent-facing deletion entry point.
  perform 1 from public.materials material
  where material.id = p_material_id and material.family_id = p_family_id;
  if not found then
    return query select 'not_found'::text, 0;
    return;
  end if;
  previous_collection_scope := current_setting('homa.material_collection_rpc', true);
  perform set_config('homa.material_collection_rpc', 'allowed', true);

  -- Evaluate the caller's RLS once per family row, not once per recursive
  -- step. The unbounded graph stays in Postgres and no unrelated row is locked.
  with recursive family_materials as materialized (
    select material.id, material.revises from public.materials material
    where material.family_id = p_family_id
  ), ancestors(id, revises) as (
    select material.id, material.revises from family_materials material
    where material.id = p_material_id
    union
    select parent.id, parent.revises from ancestors
    join family_materials parent on parent.id = ancestors.revises
  ), chain(id) as (
    select ancestors.id from ancestors
    union
    select child.id from chain
    join family_materials child on child.revises = chain.id
  )
  select array_agg(chain.id order by chain.id) into chain_ids from chain;

  perform 1 from public.materials material
  where material.id = any(chain_ids) and material.family_id = p_family_id
  order by material.id for update;

  select count(*)::integer into visible_count from public.materials material
  where material.id = any(chain_ids) and material.family_id = p_family_id
    and material.deleted_at is null;
  if visible_count = 0 then
    perform set_config('homa.material_collection_rpc', coalesce(previous_collection_scope, ''), true);
    return query select 'already_removed'::text, 0;
    return;
  end if;

  -- A fresh stamp on every connected row invalidates restores that began
  -- before this removal, including restores of an older tombstoned source.
  removal_time := clock_timestamp();
  update public.materials material set deleted_at = removal_time
  where material.id = any(chain_ids) and material.family_id = p_family_id;
  perform set_config('homa.material_collection_rpc', coalesce(previous_collection_scope, ''), true);
  return query select 'removed'::text, visible_count;
end;
$$;

revoke all on function public.remove_family_material_chain(uuid, uuid) from public, anon;
grant execute on function public.remove_family_material_chain(uuid, uuid) to authenticated;

-- The restore effect is atomic with the source's visibility check. Uploading
-- replacement bytes happens before this short transaction, never under a lock.
create or replace function public.restore_family_material_version(
  p_family_id uuid,
  p_source_material_id uuid,
  p_expected_deleted_at timestamptz,
  p_pdf_url text,
  p_preview_url text,
  p_generation jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_row public.materials%rowtype;
  restored_id uuid;
begin
  if auth.uid() is null or not public.is_family_member(p_family_id) then
    raise exception 'Family access denied' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('material-collection:' || p_family_id::text, 0)
  );
  select material.* into source_row from public.materials material
  where material.id = p_source_material_id and material.family_id = p_family_id
    and material.subject_lesson_id is null
    and material.deleted_at is not distinct from p_expected_deleted_at
  for update;
  if not found then return null; end if;

  insert into public.materials
    (family_id, child_id, title, kind, skill, subject, curriculum, theme,
     characters, tags, pdf_url, preview_url, html, source, status, revises,
     approved_at, channel, generation)
  values
    (p_family_id, source_row.child_id, source_row.title, source_row.kind,
     source_row.skill, source_row.subject, source_row.curriculum, source_row.theme,
     source_row.characters, source_row.tags, p_pdf_url, p_preview_url,
     source_row.html, source_row.source, 'final', source_row.id, now(), 'web', p_generation)
  returning id into restored_id;

  -- Only this newly inserted row is revived. The insert trigger still inherits
  -- deletion for every ordinary revision, regardless of generation.restore JSON.
  update public.materials material set deleted_at = null
  where material.id = restored_id and material.family_id = p_family_id;
  return restored_id;
end;
$$;

revoke all on function public.restore_family_material_version(uuid, uuid, timestamptz, text, text, jsonb) from public, anon;
grant execute on function public.restore_family_material_version(uuid, uuid, timestamptz, text, text, jsonb) to authenticated;
