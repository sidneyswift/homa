-- Migration #44: worksheets becomes materials, with metadata, lineage,
-- and finals (MS-3 in plans/2026-07-10-materials-studio-v2.md; founder
-- direction 2026-07-10: "design the capability, not the artifact").
-- Renamed while the table holds zero rows (verified via MCP before
-- applying), the last cheap moment for it.
--
-- New shape, on top of migration #42's columns:
--   kind        what the artifact is (worksheet, coloring, flashcards...)
--   subject / curriculum / theme / characters / tags
--               the retrieval metadata that makes finals reusable
--               ("same kind of page for Amalia, swap the character")
--   source      which creation path made it (html / image / hybrid)
--   status      draft -> final / superseded; the critique loop makes
--               drafts, approval finalizes exactly one
--   revises     self-FK revision chain (append-only versions)
--   approved_at when the parent approved it
--
-- Guarded by a DO block so the GitHub integration's replay after the
-- MCP apply is a no-op.

do $$
begin
  if exists (
    select from information_schema.tables
    where table_schema = 'public' and table_name = 'worksheets'
  ) then
    alter table public.worksheets rename to materials;
    alter index if exists worksheets_family_created_idx
      rename to materials_family_created_idx;
  end if;
end $$;

alter table public.materials
  add column if not exists kind text not null default 'worksheet'
    check (kind in ('worksheet','coloring','flashcards','reader','poster','infographic','game','other')),
  add column if not exists subject text check (char_length(subject) <= 80),
  add column if not exists curriculum text check (char_length(curriculum) <= 120),
  add column if not exists theme text check (char_length(theme) <= 120),
  add column if not exists characters text[] not null default '{}',
  add column if not exists tags text[] not null default '{}',
  add column if not exists source text not null default 'html'
    check (source in ('html','image','hybrid')),
  add column if not exists status text not null default 'draft'
    check (status in ('draft','final','superseded')),
  add column if not exists revises uuid references public.materials (id) on delete set null,
  add column if not exists approved_at timestamptz;

-- The library read path: finals by family and recency.
create index if not exists materials_family_status_idx
  on public.materials (family_id, status, created_at desc);

-- Policies: drop the worksheet-named set, recreate as materials. Same
-- posture (is_family_member; insert re-checks child coherence in-family;
-- update added for the finalize flow, status/approved_at edits ride it).
drop policy if exists "members read their worksheets" on public.materials;
drop policy if exists "members add worksheets" on public.materials;
drop policy if exists "members remove their worksheets" on public.materials;
drop policy if exists "members read their materials" on public.materials;
drop policy if exists "members add materials" on public.materials;
drop policy if exists "members update their materials" on public.materials;
drop policy if exists "members remove their materials" on public.materials;

create policy "members read their materials"
  on public.materials for select to authenticated
  using (public.is_family_member(family_id));

create policy "members add materials"
  on public.materials for insert to authenticated
  with check (
    public.is_family_member(family_id)
    and (
      child_id is null
      or exists (
        select 1 from public.children c
        where c.id = child_id and c.family_id = materials.family_id
      )
    )
  );

create policy "members update their materials"
  on public.materials for update to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy "members remove their materials"
  on public.materials for delete to authenticated
  using (public.is_family_member(family_id));
