-- gh#1091, phase 2: apply only AFTER the web deployment using
-- restore_family_material_version is READY. Old restore code inserts a row
-- without the explicit, transaction-scoped restore effect in phase 1.
create or replace function public.inherit_material_collection_visibility()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_deleted_at timestamptz;
begin
  -- Every insertion participates, including a new root. Acquire before the
  -- FK's row lock so an in-flight revision cannot escape a concurrent removal.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('material-collection:' || new.family_id::text, 0)
  );
  if new.revises is not null then
    select material.deleted_at into parent_deleted_at
    from public.materials material
    where material.id = new.revises and material.family_id = new.family_id;
    if found and parent_deleted_at is not null then
      new.deleted_at := parent_deleted_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger materials_inherit_collection_visibility
before insert on public.materials
for each row execute function public.inherit_material_collection_visibility();
