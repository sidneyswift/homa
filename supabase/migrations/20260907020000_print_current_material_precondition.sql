-- Print opts into an exact current-visible precondition. The two-argument
-- finalizer keeps its existing explicit Keep/history behavior unchanged.
create or replace function public.finalize_family_material(
  p_family_id uuid,
  p_material_id uuid,
  p_require_current_visible boolean
)
returns table (
  finalized boolean, transitioned boolean, title text,
  versions_superseded integer, draft_urls text[], current_visible boolean
)
language plpgsql
set search_path = ''
as $function$
declare
  chain_ids uuid[];
  previous_ids uuid[];
  visible_id uuid;
  attempt integer;
  stable boolean := false;
begin
  if not p_require_current_visible then
    return query select result.*, null::boolean
      from public.finalize_family_material(p_family_id, p_material_id) result;
    return;
  end if;
  if p_require_current_visible is null then
    return query select false, false, null::text, 0, array[]::text[], false;
    return;
  end if;
  if auth.uid() is null or not public.is_family_member(p_family_id) then
    raise exception 'Family access denied' using errcode = '42501';
  end if;

  -- Match the existing caller finalizer's lock order before entering it.
  perform 1 from public.materials material
    where material.family_id = p_family_id order by material.id for update;

  for attempt in 1..8 loop
    with recursive chain(id, revises) as (
      select material.id, material.revises from public.materials material
        where material.family_id = p_family_id and material.id = p_material_id
      union
      select next.id, next.revises from public.materials next
        join chain on next.id = chain.revises or next.revises = chain.id
        where next.family_id = p_family_id
    )
    select coalesce(array_agg(chain.id order by chain.id), array[]::uuid[])
      into chain_ids from chain;
    perform 1 from public.materials material
      where material.family_id = p_family_id and material.id = any(chain_ids)
      order by material.id for update;
    -- A revision inserted while waiting on a parent's FK lock is visible in
    -- the next statement snapshot. Two identical walks mean its rows are held.
    if previous_ids is not null and previous_ids = chain_ids then
      stable := true;
      exit;
    end if;
    previous_ids := chain_ids;
  end loop;
  if not stable then
    return query select false, false, null::text, 0, array[]::text[], false;
    return;
  end if;

  -- Malformed cyclic lineage has no single root; never choose one by luck.
  if (select count(*) from public.materials material
      where material.family_id = p_family_id and material.id = any(chain_ids)
        and (material.revises is null or not (material.revises = any(chain_ids)))) <> 1 then
    return query select false, false, null::text, 0, array[]::text[], false;
    return;
  end if;

  -- Same valid-chain ordering as selectParentVisibleMaterialRevisions:
  -- newest eligible draft or final wins; a failed draft cannot replace a final.
  -- Date.parse uses millisecond precision before its UUID tie-breaker.
  select material.id into visible_id from public.materials material
    where material.family_id = p_family_id and material.id = any(chain_ids)
      and (material.status = 'final' or (
        material.status = 'draft'
        and material.generation->'review'->>'pass' is distinct from 'false'
      ))
    order by date_trunc('milliseconds', material.created_at) desc, material.id desc
    limit 1;
  if visible_id is distinct from p_material_id then
    return query select false, false, null::text, 0, array[]::text[], false;
    return;
  end if;

  return query select result.*, true
    from public.finalize_family_material(p_family_id, p_material_id) result;
end;
$function$;
revoke all on function public.finalize_family_material(uuid, uuid, boolean) from public;
revoke execute on function public.finalize_family_material(uuid, uuid, boolean) from anon;
grant execute on function public.finalize_family_material(uuid, uuid, boolean) to authenticated;
