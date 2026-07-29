-- Keep the preview of every superseded version forever (gh#350).
--
-- Founder ruling materials-version-retention, 2026-07-28: a parent can
-- see and compare every version she has been shown. The large print file
-- is still reclaimed at finalize and rebuilt on demand; the small preview
-- is what makes the history visible at all.
--
-- Until now finalize deleted BOTH bytes of every superseded draft, which
-- is why "as soon as she redoes it I can't see the old version, I have to
-- start screenshotting" was literally true: the rows survived and their
-- images did not.
--
-- This body is the deployed function with exactly one change, the
-- preview_url arm removed from the cleanup list. Every tenancy check,
-- owner-approval gate, lock, and receipt is byte-identical to what is
-- running, because rewriting a security-invoker finalize path by hand is
-- how one of those guards goes missing.
--
-- Deleting fewer files is safe in both deploy directions, so this may lead.

CREATE OR REPLACE FUNCTION public.finalize_family_material(p_family_id uuid, p_material_id uuid)
 RETURNS TABLE(finalized boolean, transitioned boolean, title text, versions_superseded integer, draft_urls text[])
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  target_row public.materials%rowtype;
  chain_ids uuid[];
  cleanup_urls text[];
  superseded_count integer;
begin
  if auth.uid() is null
    or not public.is_family_member(p_family_id)
  then
    raise exception 'Family access denied' using errcode = '42501';
  end if;

  perform set_config('homa.material_finalization_rpc', 'allowed', true);

  -- Lock in deterministic order before planning. This includes every row in
  -- the target's chain and prevents two approvals from splitting the writes.
  perform 1
  from public.materials material
  where material.family_id = p_family_id
  order by material.id
  for update;

  select material.*
  into target_row
  from public.materials material
  where material.id = p_material_id
    and material.family_id = p_family_id;

  if not found then
    return query
      select false, false, null::text, 0::integer, array[]::text[];
    return;
  end if;

  -- Ordinary family materials retain member approval. A worksheet stamped
  -- to an automatic lesson requires the authenticated account owner.
  if target_row.subject_lesson_id is null then
    null;
  elsif target_row.subject_lesson_id is not null
    and not exists (
    select 1
    from public.family_members member
    where member.family_id = p_family_id
      and member.user_id = auth.uid()
      and member.user_id = (
        select owner.user_id
        from public.family_members owner
        where owner.family_id = p_family_id
        order by owner.created_at, owner.user_id
        limit 1
      )
  ) then
    raise exception 'Account owner approval required'
      using errcode = '42501';
  end if;

  if target_row.status = 'final' then
    return query
      select true, false, target_row.title, 0::integer, array[]::text[];
    return;
  end if;

  -- A superseded draft may already have lost its Blob bytes. approved_at is
  -- the durable proof that this revision was previously final and retained.
  if target_row.status = 'superseded'
    and target_row.approved_at is null
  then
    return query
      select false, false, null::text, 0::integer, array[]::text[];
    return;
  end if;

  with recursive material_chain(id) as (
    select target_row.id
    union
    select candidate.id
    from material_chain current_chain
    join public.materials current_material
      on current_material.id = current_chain.id
      and current_material.family_id = p_family_id
    join public.materials candidate
      on candidate.family_id = p_family_id
      and (
        candidate.revises = current_material.id
        or candidate.id = current_material.revises
      )
  )
  select coalesce(
    array_agg(material_chain.id order by material_chain.id),
    array[]::uuid[]
  )
  into chain_ids
  from material_chain;

  if exists (
    select 1
    from public.materials material
    where material.id = any(chain_ids)
      and material.family_id = p_family_id
      and material.subject_lesson_id is not null
  ) and (
    target_row.subject_lesson_id is null
    or exists (
      select 1
      from public.materials material
      where material.id = any(chain_ids)
        and material.family_id = p_family_id
        and material.subject_lesson_id
          is distinct from target_row.subject_lesson_id
    )
  ) then
    return query
      select false, false, null::text, 0::integer, array[]::text[];
    return;
  end if;

  if exists (
    select 1
    from public.materials material
    where material.id = any(chain_ids)
      and material.family_id = p_family_id
      and material.subject_lesson_id is not null
  ) and not exists (
    select 1
    from public.family_members member
    where member.family_id = p_family_id
      and member.user_id = auth.uid()
      and member.user_id = (
        select owner.user_id
        from public.family_members owner
        where owner.family_id = p_family_id
        order by owner.created_at, owner.user_id
        limit 1
      )
  ) then
    raise exception 'Account owner approval required'
      using errcode = '42501';
  end if;

  perform 1
  from public.materials material
  where material.id = any(chain_ids)
    and material.family_id = p_family_id
  order by material.id
  for update;

  select coalesce(
    array_agg(distinct cleanup.url),
    array[]::text[]
  )
  into cleanup_urls
  from (
    select material.pdf_url as url
    from public.materials material
    where material.id = any(chain_ids)
      and material.id <> target_row.id
      and material.family_id = p_family_id
      and material.status = 'draft'
  ) cleanup
  where nullif(btrim(cleanup.url), '') is not null;

  select count(*)::integer
  into superseded_count
  from public.materials material
  where material.id = any(chain_ids)
    and material.id <> target_row.id
    and material.family_id = p_family_id
    and material.status <> 'superseded';

  update public.materials material
  set status = 'final',
      approved_at = now()
  where material.id = target_row.id
    and material.family_id = p_family_id
    and material.status <> 'final';

  if not found then
    raise exception 'Material finalization lost its locked transition';
  end if;

  update public.materials material
  set status = 'superseded'
  where material.id = any(chain_ids)
    and material.id <> target_row.id
    and material.family_id = p_family_id
    and material.status <> 'superseded';

  return query
    select true, true, target_row.title, superseded_count, cleanup_urls;
end;
$function$
