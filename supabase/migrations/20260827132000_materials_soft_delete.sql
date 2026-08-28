-- Binder: let a parent delete a saved or in-progress material (Carolyng
-- feedback, 2026-08-27): "We should be able to delete in progress and
-- saved items from binder... As people keep using Homa the binder will
-- fill up and feel overwhelming."
--
-- Soft delete, not the hard-delete RLS policy this table already has:
-- materials form append-only revision chains (revisesId lineage), and
-- the house rule for collection removal is "never deletes a material or
-- its revision history" (gh#530's ruling). Hiding a row from every
-- browsing surface (Binder, the in-progress shelf, Homa's find_materials
-- search) while leaving it physically present means the version rail on
-- a surviving sibling still tells the truth, and restore_material_version
-- can still bring a mistakenly-deleted one back as a real undo path.
--
-- Print/share/revise links a parent already has open keep working after
-- a soft delete (looked up by exact id, never a listing), on purpose:
-- deleting it from the binder should not 404 a tab she still has open.

alter table public.materials
  add column if not exists deleted_at timestamptz;

create index if not exists materials_family_deleted_at_idx
  on public.materials (family_id, deleted_at);
