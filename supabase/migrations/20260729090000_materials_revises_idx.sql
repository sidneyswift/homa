-- Revision-chain lookups need an index on the parent pointer (gh#346).
--
-- Finalizing a material used to lock every material row the family had,
-- so no index on `revises` was needed: the walk happened in memory over
-- rows that were already all in hand. That lock is now scoped to one
-- revision chain with a recursive walk over `revises`, which without an
-- index means a family-wide scan per recursion step, on the exact path
-- that was already timing out.
--
-- The same index serves the version rail (gh#350), which lists a
-- material's prior versions by walking children.
--
-- Additive and index-only, so it may lead its deploy.
create index if not exists materials_revises_idx
  on public.materials (revises)
  where revises is not null;
