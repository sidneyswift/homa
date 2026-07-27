-- Fix the "members add materials" insert policy: the revises lineage check
-- from 20260718150000_subject_lessons.sql wrote "prior.id = revises", and
-- inside the exists subquery the bare column resolved against the aliased
-- materials table itself, becoming "prior.id = prior.revises". That predicate
-- is never true, so since 2026-07-18 every insert carrying a revisesId failed
-- row-level security and revision lineage has been silently dropped
-- (first observed on family c18d5def, 2026-07-19; agent retried without
-- revises so parents saw latency, and materials.revises stayed null).
-- The child scoping check only escaped the same capture because children has
-- no child_id column. Qualify both references to the new row explicitly.

drop policy if exists "members add materials" on public.materials;
create policy "members add materials"
  on public.materials for insert to authenticated
  with check (
    public.is_family_member(family_id)
    and subject_lesson_id is null
    and (
      revises is null
      or exists (
        select 1
        from public.materials prior
        where prior.id = materials.revises
          and prior.family_id = materials.family_id
          and prior.subject_lesson_id is null
      )
    )
    and (
      child_id is null
      or exists (
        select 1
        from public.children child
        where child.id = materials.child_id
          and child.family_id = materials.family_id
      )
    )
  );
