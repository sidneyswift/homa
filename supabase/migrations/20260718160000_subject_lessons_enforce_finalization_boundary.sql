-- The CONTRACT half of the subject-lessons expand/contract split (see the
-- header comment in 20260718150000_subject_lessons.sql for the full
-- reasoning). This trigger has no subject_lesson_id exception: once it
-- exists, EVERY authenticated-role update to materials.status,
-- materials.approved_at, or materials.subject_lesson_id must go through
-- public.finalize_family_material (which sets the transaction-local
-- homa.material_finalization_rpc marker before writing), including the
-- direct-update path an unmigrated deploy would still be using for
-- ordinary, non-lesson materials.
--
-- DO NOT APPLY THIS MIGRATION until the RPC-aware finalizeMaterialCaller
-- (apps/web/lib/materials/library.ts, this same PR) is deployed to
-- production and confirmed READY. Applying it first breaks material
-- approval for every family, flag or no flag, immediately: today's live
-- finalizeMaterialCaller does a bare `.update({status, approved_at})`
-- with the caller's own JWT and no RPC involved. The migration before
-- this one (20260718150000) is safe to lead the deploy on its own; this
-- one is not.
create or replace function public.enforce_material_status_write_boundary()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
    and current_setting(
      'homa.material_finalization_rpc',
      true
    ) is distinct from 'allowed'
  then
    raise exception 'Use finalize_family_material for material approval'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_material_status_write_boundary()
  from public;

create trigger enforce_material_status_write_boundary
before update of status, approved_at, subject_lesson_id
on public.materials
for each row execute function
  public.enforce_material_status_write_boundary();
