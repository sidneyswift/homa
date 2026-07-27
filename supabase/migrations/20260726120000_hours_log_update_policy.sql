-- Hours log update policy (issue #174, CG-02: parent-facing hours
-- surface). Migration #37 shipped select/insert/delete for hours_log
-- but never an update policy, because nothing read the table yet. The
-- new /app/hours page lets a parent fix a wrong subject, minutes, or
-- note on their own family's row, so the Data API needs a real UPDATE
-- grant. Same posture as "members update their materials" (migration
-- #44): is_family_member on both sides, plus the insert policy's own
-- child-coherence check re-applied in WITH CHECK so a forged child_id
-- can never ride an update either, even though the shipping UI only
-- ever changes subject/minutes/note.
--
-- Additive: leads the code deploy safely (no existing behavior depends
-- on update being absent).

drop policy if exists "members update their hours" on public.hours_log;
create policy "members update their hours"
  on public.hours_log for update to authenticated
  using (public.is_family_member(family_id))
  with check (
    public.is_family_member(family_id)
    and (
      child_id is null
      or exists (
        select 1 from public.children c
        where c.id = child_id and c.family_id = hours_log.family_id
      )
    )
  );
